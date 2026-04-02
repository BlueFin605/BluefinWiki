/**
 * Lambda: vector-index-builder
 *
 * Maintains the S3 Vectors index for semantic search.
 * Triggered by S3 events on page create/update/delete.
 *
 * Flow:
 * 1. Parse S3 event to determine which page changed
 * 2. For create/update: load page, embed via Bedrock Titan V2, upsert into S3 Vectors
 * 3. For delete: remove the vector by page GUID
 *
 * Also supports full re-index via direct invocation with { "reindexAll": true }.
 */

import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  S3VectorsClient,
  PutVectorsCommand,
  DeleteVectorsCommand,
} from '@aws-sdk/client-s3vectors';
import { stripMarkdown } from './markdown-stripper.js';
import { getStoragePlugin } from '../storage/index.js';
import { PageSummary } from '../types/index.js';

const region = process.env.AWS_REGION || 'ap-southeast-2';
const pagesBucket = process.env.PAGES_BUCKET || process.env.S3_PAGES_BUCKET!;
const vectorBucketName = process.env.VECTOR_BUCKET_NAME!;
const vectorIndexName = process.env.VECTOR_INDEX_NAME || 'wiki-pages';
const embeddingModelId = process.env.EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';

const s3Client = new S3Client({ region });
const bedrockClient = new BedrockRuntimeClient({ region });
const s3VectorsClient = new S3VectorsClient({ region });

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
 * Parse YAML frontmatter from a markdown file.
 * Returns the frontmatter as key-value pairs and the content body.
 */
function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content: raw };
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: match[2] };
}

/**
 * Extract the page GUID from an S3 key.
 * Keys follow pattern: {guid}/{guid}.md or {parent}/{guid}/{guid}.md
 */
function extractGuidFromKey(key: string): string | null {
  const match = key.match(/([a-f0-9-]{36})\/\1\.md$/);
  return match ? match[1] : null;
}

/**
 * Build the hierarchical display path for a page.
 */
async function buildDisplayPath(pageGuid: string): Promise<string> {
  try {
    const storagePlugin = getStoragePlugin();
    const ancestors = await storagePlugin.getAncestors(pageGuid);
    const page = await storagePlugin.loadPage(pageGuid);
    return [...ancestors.map(a => a.title), page.title].join(' > ');
  } catch {
    return 'Unknown';
  }
}

/**
 * Upsert a single page's vector into S3 Vectors.
 */
async function upsertPageVector(s3Key: string): Promise<void> {
  const guid = extractGuidFromKey(s3Key);
  if (!guid) {
    console.warn(`Could not extract GUID from S3 key: ${s3Key}`);
    return;
  }

  // Load the raw page from S3
  const result = await s3Client.send(new GetObjectCommand({
    Bucket: pagesBucket,
    Key: s3Key,
  }));
  const raw = await result.Body!.transformToString();

  const { frontmatter, content } = parseFrontmatter(raw);

  // Only index published pages
  if (frontmatter.status !== 'published') {
    // Remove vector if page was unpublished
    await deletePageVector(guid);
    return;
  }

  const title = frontmatter.title || '';
  const tags = frontmatter.tags?.replace(/^\[|\]$/g, '').trim() || '';
  const plainContent = stripMarkdown(content);

  // Concatenate for embedding: title + tags + content
  const textToEmbed = [title, tags, plainContent].filter(Boolean).join('\n\n');

  const embedding = await generateEmbedding(textToEmbed);
  const displayPath = await buildDisplayPath(guid);

  await s3VectorsClient.send(new PutVectorsCommand({
    vectorBucketName,
    indexName: vectorIndexName,
    vectors: [{
      key: guid,
      data: { float32: embedding },
      metadata: {
        title,
        guid,
        s3Key,
        displayPath,
        tags,
      },
    }],
  }));

  console.log(`Upserted vector for page: ${title} (${guid})`);
}

/**
 * Delete a page's vector from S3 Vectors.
 */
async function deletePageVector(guid: string): Promise<void> {
  await s3VectorsClient.send(new DeleteVectorsCommand({
    vectorBucketName,
    indexName: vectorIndexName,
    keys: [guid],
  }));

  console.log(`Deleted vector for page: ${guid}`);
}

/**
 * Flatten a page tree into a flat list.
 */
function flattenPageTree(pages: (PageSummary & { children?: PageSummary[] })[]): PageSummary[] {
  const result: PageSummary[] = [];
  function traverse(items: (PageSummary & { children?: PageSummary[] })[]) {
    for (const item of items) {
      result.push(item);
      if (item.children && Array.isArray(item.children)) {
        traverse(item.children);
      }
    }
  }
  traverse(pages);
  return result;
}

/**
 * Re-index all published pages. Called on manual invocation.
 */
async function reindexAll(): Promise<void> {
  const storagePlugin = getStoragePlugin();
  const pageTree = await storagePlugin.buildPageTree();
  const allPages = flattenPageTree(pageTree);
  const publishedPages = allPages.filter(p => p.status === 'published');

  console.log(`Re-indexing ${publishedPages.length} published pages`);

  // Process in batches to stay within PutVectors limit of 500
  const batchSize = 50; // Smaller batches to manage Bedrock rate limits
  for (let i = 0; i < publishedPages.length; i += batchSize) {
    const batch = publishedPages.slice(i, i + batchSize);

    const vectors = await Promise.all(
      batch.map(async (page) => {
        try {
          const fullPage = await storagePlugin.loadPage(page.guid);
          const plainContent = stripMarkdown(fullPage.content);
          const tags = (fullPage.tags || []).join(', ');
          const textToEmbed = [fullPage.title, tags, plainContent].filter(Boolean).join('\n\n');

          const embedding = await generateEmbedding(textToEmbed);
          const displayPath = await buildDisplayPath(page.guid);

          // Reconstruct S3 key from page structure
          const s3Key = page.parentGuid
            ? `${page.parentGuid}/${page.guid}/${page.guid}.md`
            : `${page.guid}/${page.guid}.md`;

          return {
            key: page.guid,
            data: { float32: embedding },
            metadata: {
              title: fullPage.title,
              guid: page.guid,
              s3Key,
              displayPath,
              tags,
            },
          };
        } catch (error) {
          console.warn(`Failed to embed page ${page.guid}:`, error);
          return null;
        }
      })
    );

    const validVectors = vectors.filter((v): v is NonNullable<typeof v> => v !== null);

    if (validVectors.length > 0) {
      await s3VectorsClient.send(new PutVectorsCommand({
        vectorBucketName,
        indexName: vectorIndexName,
        vectors: validVectors,
      }));
    }

    console.log(`Batch ${Math.floor(i / batchSize) + 1}: indexed ${validVectors.length} pages`);
  }

  console.log('Re-index complete');
}

/**
 * Lambda handler — triggered by S3 events or manual invocation.
 */
export const handler = async (event: S3Event | { reindexAll: boolean }): Promise<void> => {
  // Manual full re-index
  if ('reindexAll' in event && event.reindexAll) {
    await reindexAll();
    return;
  }

  const s3Event = event as S3Event;
  const records = s3Event.Records || [];

  for (const record of records) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    // Only process .md files
    if (!key.endsWith('.md')) continue;

    try {
      if (record.eventName.startsWith('ObjectRemoved')) {
        const guid = extractGuidFromKey(key);
        if (guid) {
          await deletePageVector(guid);
        }
      } else if (record.eventName.startsWith('ObjectCreated') || record.eventName.startsWith('ObjectModified')) {
        await upsertPageVector(key);
      }
    } catch (error) {
      console.error(`Failed to process vector update for ${key}:`, error);
      // Continue processing other records — don't fail the whole batch
    }
  }
};
