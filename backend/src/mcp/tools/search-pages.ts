/**
 * MCP Tool: search_pages
 *
 * Semantic search for wiki pages using S3 Vectors and Bedrock Titan V2 embeddings.
 * Replaces the previous Fuse.js keyword search with meaning-based similarity search.
 *
 * Flow: query string → Bedrock embed → S3 Vectors QueryVectors → results from metadata
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

interface SearchResult {
  title: string;
  guid: string;
  s3Key: string;
  displayPath: string;
  score: number;
}

/**
 * Generate an embedding for the given text using Bedrock Titan V2.
 */
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

/**
 * Search for pages matching a query string using semantic similarity.
 */
export async function searchPages(query: string): Promise<SearchResult[]> {
  if (!query || query.trim() === '') {
    return [];
  }

  const queryEmbedding = await generateEmbedding(query);

  const response = await s3VectorsClient.send(new QueryVectorsCommand({
    vectorBucketName,
    indexName: vectorIndexName,
    queryVector: { float32: queryEmbedding },
    topK: 20,
    returnDistance: true,
    returnMetadata: true,
  }));

  if (!response.vectors) {
    return [];
  }

  return response.vectors.map(vector => {
    const meta = vector.metadata as Record<string, string> | undefined;
    return {
      title: meta?.title ?? '',
      guid: meta?.guid ?? vector.key ?? '',
      s3Key: meta?.s3Key ?? '',
      displayPath: meta?.displayPath ?? '',
      // Cosine distance: 0 = identical, 2 = opposite. Convert to score where higher = more relevant.
      score: vector.distance != null ? 1 - (vector.distance / 2) : 0,
    };
  });
}
