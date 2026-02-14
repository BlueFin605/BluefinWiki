import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent, getUserContext } from '../middleware/auth.js';
import { getStoragePlugin } from '../storage/StoragePluginRegistry.js';
import { PageSummary } from '../types/index.js';
import type { StoragePlugin } from '../storage/StoragePlugin.js';

/**
 * Lambda: links-resolve
 * POST /pages/links/resolve
 * 
 * Resolves wiki links to pages by title or GUID.
 * Implements fuzzy matching and confidence scoring for link resolution.
 * 
 * Request Body:
 * {
 *   "query": "Page Title or GUID",
 *   "maxResults": 10  // Optional, default 10
 * }
 * 
 * Response:
 * {
 *   "query": "Page Title",
 *   "matches": [
 *     {
 *       "guid": "page-guid",
 *       "title": "Page Title",
 *       "parentGuid": "parent-guid-or-null",
 *       "status": "published",
 *       "confidence": 1.0,  // 0.0 to 1.0
 *       "path": "Parent > Page Title"  // Human-readable path
 *     }
 *   ],
 *   "exactMatch": true,  // True if confidence === 1.0
 *   "ambiguous": false   // True if multiple high-confidence matches
 * }
 */

interface LinkResolveRequest {
  query: string;
  maxResults?: number;
}

interface LinkMatch {
  guid: string;
  title: string;
  parentGuid: string | null;
  status: string;
  confidence: number;
  path: string;
}

interface LinkResolveResponse {
  query: string;
  matches: LinkMatch[];
  exactMatch: boolean;
  ambiguous: boolean;
  exists: boolean;  // True if at least one match found
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of page titles
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Calculate distances
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate confidence score for a match
 * Returns a value between 0.0 and 1.0
 * 
 * Scoring factors:
 * - Exact match (case-insensitive): 1.0
 * - Partial match (contains query): 0.8
 * - Fuzzy match: 1.0 - (levenshtein_distance / max_length)
 */
function calculateConfidence(query: string, title: string): number {
  const queryLower = query.toLowerCase().trim();
  const titleLower = title.toLowerCase().trim();

  // Exact match (case-insensitive)
  if (queryLower === titleLower) {
    return 1.0;
  }

  // Exact case-sensitive match gets slightly higher score
  if (query.trim() === title.trim()) {
    return 1.0;
  }

  // Substring match
  if (titleLower.includes(queryLower)) {
    // Score based on how much of the title is the query
    const ratio = queryLower.length / titleLower.length;
    return 0.7 + (ratio * 0.25); // 0.7 to 0.95
  }

  if (queryLower.includes(titleLower)) {
    return 0.75;
  }

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(queryLower, titleLower);
  const maxLength = Math.max(queryLower.length, titleLower.length);
  const similarity = 1.0 - (distance / maxLength);

  // Only return if similarity is above threshold
  if (similarity < 0.5) {
    return 0.0;
  }

  return similarity * 0.7; // Scale to 0.0-0.7 for fuzzy matches
}

/**
 * Build human-readable path for a page
 * Recursively traverses parent hierarchy
 */
async function buildPagePath(
  guid: string,
  parentGuid: string | null,
  pageMap: Map<string, PageSummary>
): Promise<string> {
  const page = pageMap.get(guid);
  if (!page) {
    return 'Unknown';
  }

  if (!parentGuid) {
    return page.title;
  }

  const parent = pageMap.get(parentGuid);
  if (!parent) {
    return page.title;
  }

  // Recursively build path
  const parentPath = await buildPagePath(parent.guid, parent.parentGuid, pageMap);
  return `${parentPath} > ${page.title}`;
}

/**
 * Check if a GUID exists directly
 */
function isValidGuid(query: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(query);
}

/**
 * Recursively collect all pages from storage
 */
async function collectPages(
  parentGuid: string | null,
  storagePlugin: StoragePlugin,
  allPages: PageSummary[],
  pageMap: Map<string, PageSummary>
): Promise<void> {
  const children = await storagePlugin.listChildren(parentGuid);
  for (const child of children) {
    allPages.push(child);
    pageMap.set(child.guid, child);
    if (child.hasChildren) {
      await collectPages(child.guid, storagePlugin, allPages, pageMap);
    }
  }
}

export const handler = withAuth(async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    const body: LinkResolveRequest = event.body 
      ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body)
      : {};

    const { query, maxResults = 10 } = body;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Query parameter is required and must be a non-empty string' 
        }),
      };
    }

    if (maxResults < 1 || maxResults > 100) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'maxResults must be between 1 and 100' 
        }),
      };
    }

    // Get authenticated user context
    const user = getUserContext(event);

    // Get storage plugin instance
    const storagePlugin = getStoragePlugin();

    // Check if query is a valid GUID first
    if (isValidGuid(query)) {
      try {
        const page = await storagePlugin.loadPage(query);
        const path = await buildPagePath(
          page.guid, 
          page.folderId || null, 
          new Map([[page.guid, {
            guid: page.guid,
            title: page.title,
            parentGuid: page.folderId || null,
            status: (page.status === 'deleted' ? 'archived' : page.status) as 'draft' | 'published' | 'archived',
            modifiedAt: page.modifiedAt,
            modifiedBy: page.modifiedBy,
            hasChildren: false
          }]])
        );

        // Found exact match by GUID
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            matches: [{
              guid: page.guid,
              title: page.title,
              parentGuid: page.folderId || null,
              status: page.status,
              confidence: 1.0,
              path
            }],
            exactMatch: true,
            ambiguous: false,
            exists: true
          }),
        };
      } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code !== 'PAGE_NOT_FOUND') {
          throw err;
        }
        // GUID not found, continue with title search
      }
    }

    // Fetch all pages for title matching
    // Note: In production, this should be optimized with an index or search service
    // For now, we list all pages recursively
    const allPages: PageSummary[] = [];
    const pageMap = new Map<string, PageSummary>();

    // Start from root level
    await collectPages(null, storagePlugin, allPages, pageMap);

    // Calculate confidence scores for all pages
    const matches: LinkMatch[] = [];

    for (const page of allPages) {
      const confidence = calculateConfidence(query, page.title);
      
      if (confidence > 0) {
        const path = await buildPagePath(page.guid, page.parentGuid, pageMap);
        matches.push({
          guid: page.guid,
          title: page.title,
          parentGuid: page.parentGuid,
          status: page.status,
          confidence,
          path
        });
      }
    }

    // Sort by confidence (descending) and limit results
    matches.sort((a, b) => b.confidence - a.confidence);
    const topMatches = matches.slice(0, maxResults);

    // Determine if exact match and ambiguous
    const exactMatch = topMatches.length > 0 && topMatches[0].confidence === 1.0;
    const ambiguous = topMatches.length > 1 && 
      topMatches[0].confidence === topMatches[1].confidence &&
      topMatches[0].confidence >= 0.8;

    // Log activity
    console.log('Link resolved:', {
      query,
      matchCount: topMatches.length,
      exactMatch,
      ambiguous,
      topConfidence: topMatches[0]?.confidence,
      requestedBy: user.userId,
      timestamp: new Date().toISOString(),
    });

    // Return response
    const response: LinkResolveResponse = {
      query,
      matches: topMatches,
      exactMatch,
      ambiguous,
      exists: topMatches.length > 0
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (err: unknown) {
    console.error('Error resolving link:', err);
    const error = err as { code?: string; statusCode?: number; message?: string };

    return {
      statusCode: error.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_ERROR',
      }),
    };
  }
});
