/**
 * Lambda: search-query
 *
 * GET /search?q={query}&scope={path}&limit={n}&offset={n}
 *
 * Authenticated semantic search over the wiki. Embeds the query via Bedrock
 * Titan V2, queries S3 Vectors, optionally filters by folder scope, and
 * returns paginated results in the shape the frontend renders.
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { vectorSearch } from './vector-search.js';

const TOP_K = 100;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 500;

interface SearchResultDto {
  pageId: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  matchCount: number;
  path: string;
  tags: string[];
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

export const handler = withAuth(async (
  event: AuthenticatedEvent,
): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  const rawQuery = event.queryStringParameters?.q ?? '';
  const sanitized = rawQuery.replace(/[<>]/g, '').slice(0, MAX_QUERY_LENGTH).trim();

  if (sanitized === '') {
    return jsonResponse(200, { results: [], totalResults: 0, executionTimeMs: 0 });
  }

  const scope = event.queryStringParameters?.scope ?? 'all';
  const limit = Math.min(
    Math.max(parseInt(event.queryStringParameters?.limit || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(parseInt(event.queryStringParameters?.offset || '0', 10) || 0, 0);

  try {
    let hits = await vectorSearch(sanitized, TOP_K);

    if (scope && scope !== 'all') {
      hits = hits.filter(hit => hit.displayPath.startsWith(scope));
    }

    const totalResults = hits.length;
    const paginated = hits.slice(offset, offset + limit);

    const results: SearchResultDto[] = paginated.map(hit => ({
      pageId: hit.guid,
      title: hit.title,
      snippet: hit.snippet,
      // Score is 0-1 from cosine distance; scale to 0-1000 for the existing UI contract.
      relevanceScore: Math.round(hit.score * 1000),
      matchCount: 0,
      path: hit.displayPath,
      tags: hit.tags,
    }));

    return jsonResponse(200, {
      results,
      totalResults,
      executionTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('search-query failed:', error);
    return jsonResponse(500, {
      error: 'Search unavailable',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
