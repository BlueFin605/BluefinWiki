/**
 * MCP Tool: search_pages
 *
 * Semantic search for wiki pages using S3 Vectors and Bedrock Titan V2 embeddings.
 * Delegates to the shared vectorSearch implementation.
 *
 * Flow: query string → Bedrock embed → S3 Vectors QueryVectors → results from metadata
 */

import { vectorSearch } from '../../search/vector-search.js';

interface SearchResult {
  title: string;
  guid: string;
  s3Key: string;
  displayPath: string;
  score: number;
}

export async function searchPages(query: string): Promise<SearchResult[]> {
  const results = await vectorSearch(query, 20);
  return results.map(({ title, guid, s3Key, displayPath, score }) => ({
    title,
    guid,
    s3Key,
    displayPath,
    score,
  }));
}
