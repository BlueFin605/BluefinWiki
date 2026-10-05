import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent, getUserContext, UserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { PageChildDetail, PageSummary } from '../types/index.js';
import { StoragePlugin } from '../storage/StoragePlugin.js';
import { mapWithConcurrency } from '../storage/concurrency.js';

/**
 * Filter out draft pages unless the user is the author or an admin.
 */
function filterDrafts<T extends PageSummary>(pages: T[], user: UserContext): T[] {
  return pages.filter(page =>
    page.status !== 'draft' || user.role === 'Admin' || page.createdBy === user.userId
  );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DEPTH = 10;
const MAX_PARALLEL_CHILD_LISTS = 8;
const DEFAULT_LIMIT = 200;
// Bounded by Lambda's ~6MB response payload cap, not by fetch cost — listChildren
// now fetches children concurrently, so a bigger page is cheap on the backend.
const MAX_LIMIT = 1000;

function parseLimit(value: string | undefined): number {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function encodeCursor(offset: number): string {
  return String(offset);
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor || cursor.length === 0) return 0;

  try {
    const offset = Number.parseInt(cursor, 10);
    if (!Number.isFinite(offset) || offset < 0) {
      throw new Error('Invalid cursor value');
    }
    return offset;
  } catch {
    throw new Error('Invalid cursor format');
  }
}

/** `type=a,b,c` → Set of non-empty, trimmed guids. Empty set = no type filter. */
function parseTypeList(raw: string | undefined | null): Set<string> {
  return new Set((raw ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0));
}

/**
 * Recursively collect descendants matching any of the target page types.
 * Each result includes parentTitle for context.
 */
async function collectDescendantsByType(
  storagePlugin: StoragePlugin,
  parentGuid: string,
  parentTitle: string,
  targetTypeGuids: ReadonlySet<string>,
  remainingDepth: number,
  user: UserContext,
  offset: number,
  limit: number,
): Promise<{ children: PageChildDetail[]; hasMore: boolean }> {
  if (remainingDepth <= 0) {
    return { children: [], hasMore: false };
  }

  const windowSizeWithSentinel = limit + 1;
  const stopAfterMatchIndex = offset + windowSizeWithSentinel;
  const results: PageChildDetail[] = [];
  let seenMatches = 0;

  let frontier: Array<{ guid: string; title: string; depth: number }> = [
    { guid: parentGuid, title: parentTitle, depth: remainingDepth },
  ];

  while (frontier.length > 0 && seenMatches < stopAfterMatchIndex) {
    const currentLevel = frontier;
    frontier = [];

    const levelChildren = await mapWithConcurrency(
      currentLevel,
      MAX_PARALLEL_CHILD_LISTS,
      async (node) => {
        const allChildren = await storagePlugin.listChildren(node.guid);
        const children = filterDrafts(allChildren.filter(child => child.status !== 'archived'), user);
        return { node, children };
      },
    );

    const matches: Array<{ child: PageSummary; parentTitle: string }> = [];

    for (const { node, children } of levelChildren) {
      for (const child of children) {
        if (child.pageType && targetTypeGuids.has(child.pageType)) {
          if (seenMatches >= offset && seenMatches < stopAfterMatchIndex) {
            matches.push({ child, parentTitle: node.title });
          }
          seenMatches += 1;
        }

        if (seenMatches >= stopAfterMatchIndex) {
          break;
        }

        if (child.hasChildren && node.depth > 1) {
          frontier.push({ guid: child.guid, title: child.title, depth: node.depth - 1 });
        }
      }

      if (seenMatches >= stopAfterMatchIndex) {
        break;
      }
    }

    // listChildren already returns pageType/properties on each summary, so
    // no second per-match loadPage() is needed here.
    const levelResults: PageChildDetail[] = matches.map(({ child, parentTitle: immediateParentTitle }) => ({
      ...child,
      parentTitle: immediateParentTitle,
    }));

    results.push(...levelResults);
  }

  const hasMore = results.length > limit;
  return {
    children: hasMore ? results.slice(0, limit) : results,
    hasMore,
  };
}

/**
 * Strip the `properties` field for callers that didn't ask for it —
 * listChildren() always populates it when available, but the response
 * contract only includes it when `include=properties` is set.
 */
function withoutProperties(children: PageSummary[]): PageSummary[] {
  return children.map((child) => {
    const copy = { ...child };
    delete copy.properties;
    return copy;
  });
}

/**
 * Lambda: pages-list-children
 * GET /pages/children or GET /pages/{guid}/children
 *
 * Lists child pages of a parent page, or root-level pages if no parent specified.
 *
 * Query Parameters:
 * - include=properties — enrich each child with pageType and properties
 * - type={guid[,guid...]} — filter to descendants matching any of these page types (requires include=properties)
 * - depth={1-10} — how many levels deep to search (default 1, requires type)
 * - limit={1-1000} — page size (default 200)
 * - cursor={opaque} — pagination cursor from previous response
 */
export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    let parentGuid: string | null = event.pathParameters?.guid || null;

    if (parentGuid === 'root' || parentGuid === '') {
      parentGuid = null;
    }

    if (parentGuid !== null) {
      if (!UUID_REGEX.test(parentGuid)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid parent GUID format' }),
        };
      }
    }

    const user = getUserContext(event);
    const storagePlugin = getStoragePlugin();

    // Verify parent exists
    let parentTitle = '';
    if (parentGuid !== null) {
      try {
        const parentPage = await storagePlugin.loadPage(parentGuid);
        parentTitle = parentPage.title;
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        if (error.code === 'PAGE_NOT_FOUND') {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Parent page not found' }),
          };
        }
        throw error;
      }
    }

    const includeProperties = event.queryStringParameters?.include === 'properties';
    const targetTypeGuids = parseTypeList(event.queryStringParameters?.type);
    const depthParam = parseInt(event.queryStringParameters?.depth || '1', 10);
    const depth = Math.min(Math.max(isNaN(depthParam) ? 1 : depthParam, 1), MAX_DEPTH);
    const limit = parseLimit(event.queryStringParameters?.limit);

    let offset = 0;
    try {
      offset = decodeCursor(event.queryStringParameters?.cursor);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid cursor format' }),
      };
    }

    // Validate type GUID format
    if ([...targetTypeGuids].some((g) => !UUID_REGEX.test(g))) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid type GUID format' }),
      };
    }

    let responseChildren: PageChildDetail[] | PageSummary[];
    let hasMore = false;

    if (includeProperties && targetTypeGuids.size > 0 && parentGuid) {
      // Typed fetch (any depth >= 1): collect descendants matching the target types.
      // Depth 1 used to fall through to the standard path and ignore the filter.
      const pagedResult = await collectDescendantsByType(
        storagePlugin,
        parentGuid,
        parentTitle,
        targetTypeGuids,
        depth,
        user,
        offset,
        limit,
      );
      responseChildren = pagedResult.children;
      hasMore = pagedResult.hasMore;
    } else {
      // Standard: list direct children. listChildren() already fetches each
      // child's full content internally, so pageType/properties are already
      // populated — no second per-child loadPage() needed here.
      const allChildren = await storagePlugin.listChildren(parentGuid);
      const children = filterDrafts(allChildren.filter(child => child.status !== 'archived'), user);

      responseChildren = includeProperties ? children : withoutProperties(children);

      const pagedChildren = responseChildren.slice(offset, offset + limit + 1);
      hasMore = pagedChildren.length > limit;
      responseChildren = hasMore ? pagedChildren.slice(0, limit) : pagedChildren;
    }

    const nextCursor = hasMore ? encodeCursor(offset + limit) : null;

    console.log('Children listed:', {
      parentGuid,
      childCount: responseChildren.length,
      includeProperties,
      targetTypeGuids: [...targetTypeGuids],
      depth,
      limit,
      offset,
      hasMore,
      requestedBy: user.userId,
      timestamp: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentGuid,
        children: responseChildren,
        count: responseChildren.length,
        hasMore,
        nextCursor,
      }),
    };
  } catch (err: unknown) {
    console.error('Error listing children:', err);
    const error = err as { code?: string; statusCode?: number; message?: string };

    if (error.code) {
      return {
        statusCode: error.statusCode || 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          code: error.code,
        }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to list children' }),
    };
  }
});
