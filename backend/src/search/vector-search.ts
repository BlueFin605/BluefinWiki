/**
 * Vector Search
 *
 * Shared semantic-search implementation backed by Bedrock Titan V2 embeddings
 * and S3 Vectors. Used by both the MCP `search_pages` tool and the wiki's
 * GET /search HTTP endpoint.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  S3VectorsClient,
  QueryVectorsCommand,
} from '@aws-sdk/client-s3vectors';

const region = process.env.AWS_REGION || 'ap-southeast-2';
const vectorBucketName = process.env.VECTOR_BUCKET_NAME!;
const vectorIndexName = process.env.VECTOR_INDEX_NAME || 'wiki-pages';
const embeddingModelId = process.env.EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';

const bedrockClient = new BedrockRuntimeClient({ region });
const s3VectorsClient = new S3VectorsClient({ region });

export interface VectorSearchResult {
  guid: string;
  title: string;
  displayPath: string;
  s3Key: string;
  tags: string[];
  snippet: string;
  score: number;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: embeddingModelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text,
      dimensions: 256,
      normalize: true,
    }),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embedding;
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

export async function vectorSearch(
  query: string,
  topK = 20,
): Promise<VectorSearchResult[]> {
  if (!query || query.trim() === '') {
    return [];
  }

  const queryEmbedding = await generateEmbedding(query);

  const response = await s3VectorsClient.send(new QueryVectorsCommand({
    vectorBucketName,
    indexName: vectorIndexName,
    queryVector: { float32: queryEmbedding },
    topK,
    returnDistance: true,
    returnMetadata: true,
  }));

  if (!response.vectors) {
    return [];
  }

  return response.vectors.map(vector => {
    const meta = vector.metadata as Record<string, string> | undefined;
    return {
      guid: meta?.guid ?? vector.key ?? '',
      title: meta?.title ?? '',
      displayPath: meta?.displayPath ?? '',
      s3Key: meta?.s3Key ?? '',
      tags: parseTags(meta?.tags),
      snippet: meta?.snippet ?? '',
      // Cosine distance: 0 = identical, 2 = opposite. Convert to score where higher = more relevant.
      score: vector.distance != null ? 1 - (vector.distance / 2) : 0,
    };
  });
}
