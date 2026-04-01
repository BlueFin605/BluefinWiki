import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent, getUserContext, UserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { PageChildDetail, PageSummary, PageContent } from '../types/index.js';
import { StoragePlugin } from '../storage/StoragePlugin.js';

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

/**
 * Recursively collect descendants matching a specific page type.
 * Each result includes parentTitle for context.
 */
async function collectDescendantsByType(
  storagePlugin: StoragePlugin,
  parentGuid: string,
  parentTitle: string,
  targetTypeGuid: string,
  remainingDepth: number,
  user: UserContext,
): Promise<PageChildDetail[]> {
  if (remainingDepth <= 0) return [];

  const allChildren = await storagePlugin.listChildren(parentGuid);
  const children = filterDrafts(allChildren.filter(child => child.status !== 'archived'), user);

  const results: PageChildDetail[] = [];

  for (const child of children) {
    let fullPage: PageContent | null = null;
    try {
      fullPage = await storagePlugin.loadPage(child.guid);
    } catch {
      // Skip pages that can't be loaded
      continue;
    }

    // If this child matches the target type, include it
    if (fullPage.pageType === targetTypeGuid) {
      results.push({
        ...child,
        ...(fullPage.pageType ? { pageType: fullPage.pageType } : {}),
        ...(fullPage.properties && Object.keys(fullPage.properties).length > 0
          ? { properties: fullPage.properties }
          : {}),
        parentTitle,
      });
    }

    // Recurse into children regardless (the target type may be deeper)
    if (child.hasChildren && remainingDepth > 1) {
      const deeper = await collectDescendantsByType(
        storagePlugin,
        child.guid,
        fullPage.title,
        targetTypeGuid,
        remainingDepth - 1,
        user,
      );
      results.push(...deeper);
    }
  }

  return results;
}

/**
 * Enrich a list of direct children with pageType and properties.
 */
async function enrichChildrenWithProperties(
  storagePlugin: StoragePlugin,
  children: PageSummary[],
): Promise<PageChildDetail[]> {
  return Promise.all(
    children.map(async (child) => {
      try {
        const fullPage = await storagePlugin.loadPage(child.guid);
        const detail: PageChildDetail = {
          ...child,
          ...(fullPage.pageType ? { pageType: fullPage.pageType } : {}),
          ...(fullPage.properties && Object.keys(fullPage.properties).length > 0
            ? { properties: fullPage.properties }
            : {}),
        };
        return detail;
      } catch {
        return child as PageChildDetail;
      }
    })
  );
}

/**
 * Lambda: pages-list-children
 * GET /pages/children or GET /pages/{guid}/children
 *
 * Lists child pages of a parent page, or root-level pages if no parent specified.
 *
 * Query Parameters:
 * - include=properties — enrich each child with pageType and properties
 * - type={typeGuid} — filter to descendants matching this page type (requires include=properties)
 * - depth={1-10} — how many levels deep to search (default 1, requires type)
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
    const targetTypeGuid = event.queryStringParameters?.type || null;
    const depthParam = parseInt(event.queryStringParameters?.depth || '1', 10);
    const depth = Math.min(Math.max(isNaN(depthParam) ? 1 : depthParam, 1), MAX_DEPTH);

    // Validate type GUID format
    if (targetTypeGuid && !UUID_REGEX.test(targetTypeGuid)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid type GUID format' }),
      };
    }

    let responseChildren: PageChildDetail[] | PageSummary[];

    if (includeProperties && targetTypeGuid && depth > 1 && parentGuid) {
      // Deep fetch: recursively collect descendants matching the target type
      responseChildren = await collectDescendantsByType(
        storagePlugin,
        parentGuid,
        parentTitle,
        targetTypeGuid,
        depth,
        user,
      );
    } else {
      // Standard: list direct children
      const allChildren = await storagePlugin.listChildren(parentGuid);
      const children = filterDrafts(allChildren.filter(child => child.status !== 'archived'), user);

      if (includeProperties) {
        responseChildren = await enrichChildrenWithProperties(storagePlugin, children);
      } else {
        responseChildren = children;
      }
    }

    console.log('Children listed:', {
      parentGuid,
      childCount: responseChildren.length,
      includeProperties,
      targetTypeGuid,
      depth,
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
