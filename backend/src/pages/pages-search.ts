/**
 * Lambda: pages-search
 * 
 * GET /pages/search?q={query}&limit={limit}
 * 
 * Search for pages by title (fuzzy matching)
 * Used for link autocomplete and search features
 * 
 * Query Parameters:
 * - q: Search query string (required)
 * - limit: Max results to return (optional, default: 10, max: 50)
 * 
 * Response:
 * {
 *   "results": [
 *     {
 *       "guid": "...",
 *       "title": "...",
 *       "path": "Parent > Child > Page",  // Hierarchical path
 *       "folderId": "..." | null
 *     }
 *   ]
 * }
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PageSummary } from '../types/index.js';
import type { StoragePlugin } from '../storage/StoragePlugin.js';
import { getStoragePlugin } from '../storage/index.js';

interface SearchResult {
  guid: string;
  title: string;
  path: string;
  folderId: string | null;
}

/**
 * Build hierarchical path for a page (e.g., "Parent > Child > Page")
 */
async function buildPagePath(
  pageGuid: string,
  storagePlugin: StoragePlugin
): Promise<string> {
  try {
    const ancestors = await storagePlugin.getAncestors(pageGuid);
    const page = await storagePlugin.loadPage(pageGuid);
    
    const pathParts = [...ancestors.map(a => a.title), page.title];
    return pathParts.join(' > ');
  } catch (error) {
    console.error(`Failed to build path for ${pageGuid}:`, error);
    // Fallback: just return the page title
    try {
      const page = await storagePlugin.loadPage(pageGuid);
      return page.title;
    } catch {
      return 'Unknown';
    }
  }
}

/**
 * Flatten page tree into a list of all pages
 */
function flattenPageTree(pages: PageSummary[]): PageSummary[] {
  // PageSummary doesn't have children property, so just return the array
  return pages;
}

/**
 * Simple fuzzy search implementation
 * Checks if all characters in query appear in order in the target string
 */
function fuzzyMatch(query: string, target: string): boolean {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();
  
  let queryIndex = 0;
  let targetIndex = 0;
  
  while (queryIndex < queryLower.length && targetIndex < targetLower.length) {
    if (queryLower[queryIndex] === targetLower[targetIndex]) {
      queryIndex++;
    }
    targetIndex++;
  }
  
  return queryIndex === queryLower.length;
}

/**
 * Calculate fuzzy match score (higher is better)
 * Prioritizes exact matches and early matches
 */
function calculateScore(query: string, target: string): number {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();
  
  // Exact match: highest score
  if (targetLower === queryLower) {
    return 1000;
  }
  
  // Starts with query: high score
  if (targetLower.startsWith(queryLower)) {
    return 900;
  }
  
  // Contains query as substring: medium-high score
  const index = targetLower.indexOf(queryLower);
  if (index !== -1) {
    return 800 - index; // Earlier matches score higher
  }
  
  // Fuzzy match: lower score based on character positions
  let queryIndex = 0;
  let targetIndex = 0;
  let score = 500;
  
  while (queryIndex < queryLower.length && targetIndex < targetLower.length) {
    if (queryLower[queryIndex] === targetLower[targetIndex]) {
      score -= targetIndex - queryIndex; // Penalize gaps
      queryIndex++;
    }
    targetIndex++;
  }
  
  return Math.max(score, 0);
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract query parameters
    const query = event.queryStringParameters?.q;
    const limitParam = event.queryStringParameters?.limit;
    
    if (!query || query.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Missing required query parameter: q',
        }),
      };
    }
    
    const limit = Math.min(
      parseInt(limitParam || '10', 10),
      50 // Max limit
    );
    
    const storagePlugin = getStoragePlugin();
    
    // Get all pages from storage
    const pageTree = await storagePlugin.buildPageTree();
    const allPages = flattenPageTree(pageTree);
    
    // Filter pages by fuzzy matching on title
    const matchedPages = allPages
      .filter(page => fuzzyMatch(query, page.title))
      .map(page => ({
        page,
        score: calculateScore(query, page.title),
      }))
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, limit)
      .map(item => item.page);
    
    // Build search results with hierarchical paths
    const results: SearchResult[] = await Promise.all(
      matchedPages.map(async (page) => ({
        guid: page.guid,
        title: page.title,
        path: await buildPagePath(page.guid, storagePlugin),
        folderId: page.parentGuid,
      }))
    );
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ results }),
    };
  } catch (error) {
    console.error('Search error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to search pages',
        message: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
