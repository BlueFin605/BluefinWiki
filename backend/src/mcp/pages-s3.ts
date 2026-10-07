/**
 * The pages bucket and an S3 client for the MCP tools that read page files
 * directly. Deployed Lambdas get PAGES_BUCKET; the local server uses
 * S3_PAGES_BUCKET and LocalStack at AWS_ENDPOINT_URL (as the storage plugin
 * does), which a bare `new S3Client()` + PAGES_BUCKET can't reach.
 */

import { S3Client } from '@aws-sdk/client-s3';

let client: S3Client | null = null;

export function pagesBucket(): string {
  const bucket = process.env.PAGES_BUCKET || process.env.S3_PAGES_BUCKET;
  if (!bucket) throw new Error('PAGES_BUCKET is not set');
  return bucket;
}

export function pagesS3(): S3Client {
  if (!client) {
    const endpoint = process.env.AWS_ENDPOINT_URL || process.env.AWS_ENDPOINT;
    client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(endpoint && {
        endpoint,
        forcePathStyle: true, // LocalStack
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
        },
      }),
    });
  }
  return client;
}
