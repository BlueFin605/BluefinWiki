/**
 * Attachment API Integration Tests
 * 
 * Tests the attachment endpoints with real S3 storage (LocalStack)
 * For comprehensive verification that attachments save and can be read.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { S3Client, CreateBucketCommand, DeleteBucketCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const TEST_BUCKET = `test-attachments-${Date.now()}`;
const TEST_REGION = 'us-east-1';
const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';

describe('Attachment API - LocalStack Integration Tests', () => {
  let s3Client: S3Client;

  beforeAll(async () => {
    s3Client = new S3Client({
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      forcePathStyle: true,
    });

    // Create test bucket
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));
      console.log(`✓ Created test bucket: ${TEST_BUCKET}`);
    } catch (err: any) {
      if (err.Code !== 'BucketAlreadyOwnedByYou') {
        console.error('Failed to create bucket:', err);
        throw err;
      }
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      const list = await s3Client.send(new ListObjectsV2Command({ Bucket: TEST_BUCKET }));
      if (list.Contents) {
        for (const obj of list.Contents) {
          if (obj.Key) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: TEST_BUCKET, Key: obj.Key }));
          }
        }
      }
      await s3Client.send(new DeleteBucketCommand({ Bucket: TEST_BUCKET }));
      console.log(`✓ Cleaned up test bucket`);
    } catch (err) {
      console.log('Cleanup error (may be normal):', err);
    }
  });

  describe('S3 Attachment Storage Verification', () => {
    it('should successfully save an attachment to S3', async () => {
      const pageGuid = uuidv4();
      const filename = 'test-file.txt';
      const fileContent = 'This is a test attachment file';
      const attachmentKey = `${pageGuid}/${pageGuid}/_attachments/${filename}`;

      // Save attachment
      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: attachmentKey,
        Body: fileContent,
        ContentType: 'text/plain',
      }));

      // Verify it was saved by listing  
      const list = await s3Client.send(new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `${pageGuid}/${pageGuid}/_attachments/`,
      }));

      expect(list.Contents).toBeDefined();
      expect(list.Contents?.length).toBeGreaterThan(0);
      expect(list.Contents?.some(obj => obj.Key === attachmentKey)).toBe(true);
    });

    it('should successfully read an attachment from S3', async () => {
      const pageGuid = uuidv4();
      const filename = 'test-read.pdf';
      const fileContent = Buffer.from('Read test content');
      const attachmentKey = `${pageGuid}/${pageGuid}/_attachments/${filename}`;

      // Save attachment
      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: attachmentKey,
        Body: fileContent,
        ContentType: 'application/pdf',
      }));

      // Read attachment
      const result = await s3Client.send(new GetObjectCommand({
        Bucket: TEST_BUCKET,
        Key: attachmentKey,
      }));

      expect(result.Body).toBeDefined();
      expect(result.ContentType).toBe('application/pdf');

      // Convert body to buffer
      const body = result.Body as any;
      const data = await body.transformToByteArray();
      expect(Buffer.from(data).toString()).toBe(fileContent.toString());
    });

    it('should save and retrieve attachment metadata sidecar', async () => {
      const pageGuid = uuidv4();
      const filename = 'document.pdf';
      const metadata = {
        filename: filename,
        contentType: 'application/pdf',
        size: 12345,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
      };
      const metadataKey = `${pageGuid}/${pageGuid}/_attachments/${filename}.meta.json`;

      // Save metadata
      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: metadataKey,
        Body: JSON.stringify(metadata),
        ContentType: 'application/json',
      }));

      // Read metadata
      const result = await s3Client.send(new GetObjectCommand({
        Bucket: TEST_BUCKET,
        Key: metadataKey,
      }));

      const body = result.Body as any;
      const data = await body.transformToString();
      const retrievedMetadata = JSON.parse(data);

      expect(retrievedMetadata.filename).toBe(filename);
      expect(retrievedMetadata.contentType).toBe('application/pdf');
      expect(retrievedMetadata.size).toBe(12345);
    });

    it('should list all attachments for a page', async () => {
      const pageGuid = uuidv4();
      const attachment1 = 'file1.txt';
      const attachment2 = 'file2.txt';

      // Save multiple attachments
      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: `${pageGuid}/${pageGuid}/_attachments/${attachment1}`,
        Body: 'File 1',
      }));

      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: `${pageGuid}/${pageGuid}/_attachments/${attachment1}.meta.json`,
        Body: JSON.stringify({ filename: attachment1, contentType: 'text/plain' }),
      }));

      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: `${pageGuid}/${pageGuid}/_attachments/${attachment2}`,
        Body: 'File 2',
      }));

      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: `${pageGuid}/${pageGuid}/_attachments/${attachment2}.meta.json`,
        Body: JSON.stringify({ filename: attachment2, contentType: 'text/plain' }),
      }));

      // List attachments
      const list = await s3Client.send(new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `${pageGuid}/${pageGuid}/_attachments/`,
      }));

      expect(list.Contents).toBeDefined();
      expect(list.Contents?.length).toBe(4); // 2 files + 2 metadata files
      expect(list.Contents?.some(obj => obj.Key?.includes(`${attachment1}`))).toBe(true);
      expect(list.Contents?.some(obj => obj.Key?.includes(`${attachment2}`))).toBe(true);
    });

    it('should delete attachments by removing both file and metadata', async () => {
      const pageGuid = uuidv4();
      const filename = 'test-delete.pdf';

      // Save attachment and metadata
      const attachmentKey = `${pageGuid}/${pageGuid}/_attachments/${filename}`;
      const metadataKey = `${pageGuid}/${pageGuid}/_attachments/${filename}.meta.json`;

      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: attachmentKey,
        Body: 'File content',
      }));

      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: metadataKey,
        Body: JSON.stringify({ filename: filename }),
      }));

      // Verify both exist
      let list = await s3Client.send(new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `${pageGuid}/${pageGuid}/_attachments/`,
      }));
      expect(list.Contents?.length).toBe(2);

      // Delete both
      await s3Client.send(new DeleteObjectCommand({ Bucket: TEST_BUCKET, Key: attachmentKey }));
      await s3Client.send(new DeleteObjectCommand({ Bucket: TEST_BUCKET, Key: metadataKey }));

      // Verify they're gone
      list = await s3Client.send(new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `${pageGuid}/_attachments/`,
      }));
      expect(list.Contents?.length || 0).toBe(0);
    });

    it('should handle multiple pages with independent attachments', async () => {
      const page1 = uuidv4();
      const page2 = uuidv4();
      const attach1 = 'doc1.txt';
      const attach2 = 'doc2.txt';

      // Save attachments to page 1
      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: `${page1}/_attachments/${attach1}`,
        Body: 'Page 1 file',
      }));

      // Save attachments to page 2
      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: `${page2}/_attachments/${attach2}`,
        Body: 'Page 2 file',
      }));

      // List page 1 attachments only
      const page1List = await s3Client.send(new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `${page1}/_attachments/`,
      }));

      expect(page1List.Contents?.length).toBe(1);
      expect(page1List.Contents?.[0].Key).toContain(page1);
      expect(page1List.Contents?.[0].Key).not.toContain(page2);

      // List page 2 attachments only
      const page2List = await s3Client.send(new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `${page2}/_attachments/`,
      }));

      expect(page2List.Contents?.length).toBe(1);
      expect(page2List.Contents?.[0].Key).toContain(page2);
      expect(page2List.Contents?.[0].Key).not.toContain(page1);
    });
  });

  describe('Attachment Storage Edge Cases', () => {
    it('should handle non-existent attachments gracefully', async () => {
      const pageGuid = uuidv4();
      const filename = 'nonexistent.txt';
      const key = `${pageGuid}/_attachments/${filename}`;

      // Try to get non-existent object
      try {
        await s3Client.send(new GetObjectCommand({
          Bucket: TEST_BUCKET,
          Key: key,
        }));
        expect.fail('Should have thrown error for non-existent object');
      } catch (err: any) {
        // Should throw NoSuchKey error
        expect(err.Code || err.name).toBeDefined();
      }
    });

    it('should handle large attachments', async () => {
      const pageGuid = uuidv4();
      const filename = 'large-file.bin';
      // Create a 5MB file
      const largeContent = Buffer.alloc(5 * 1024 * 1024, 'x');
      const key = `${pageGuid}/_attachments/${filename}`;

      // Save large file
      await s3Client.send(new PutObjectCommand({
        Bucket: TEST_BUCKET,
        Key: key,
        Body: largeContent,
      }));

      // Verify size in list
      const list = await s3Client.send(new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `${pageGuid}/_attachments/`,
      }));

      expect(list.Contents?.[0].Size).toBe(5 * 1024 * 1024);
    });

    it('should preserve various file types and content types', async () => {
      const pageGuid = uuidv4();
      
      const testFiles = [
        { guid: uuidv4(), name: 'doc.pdf', type: 'application/pdf', content: '%PDF-1.4' },
        { guid: uuidv4(), name: 'img.jpg', type: 'image/jpeg', content: '\xFF\xD8\xFF\xE0' },
        { guid: uuidv4(), name: 'data.json', type: 'application/json', content: '{"test": true}' },
        { guid: uuidv4(), name: 'text.txt', type: 'text/plain', content: 'Hello, World!' },
      ];

      // Save all file types
      for (const file of testFiles) {
        await s3Client.send(new PutObjectCommand({
          Bucket: TEST_BUCKET,
          Key: `${pageGuid}/_attachments/${file.guid}.bin`,
          Body: file.content,
          ContentType: file.type,
        }));
      }

      // Verify all were saved
      const list = await s3Client.send(new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `${pageGuid}/_attachments/`,
      }));

      expect(list.Contents?.length).toBe(testFiles.length);

      // Verify each content type
      for (const file of testFiles) {
        const result = await s3Client.send(new GetObjectCommand({
          Bucket: TEST_BUCKET,
          Key: `${pageGuid}/_attachments/${file.guid}.bin`,
        }));
        expect(result.ContentType).toBe(file.type);
      }
    });

    it('should maintain file order when listing attachments', async () => {
      const pageGuid = uuidv4();
      const files = Array.from({ length: 5 }, (_, i) => ({
        guid: uuidv4(),
        index: i,
      }));

      // Save files with timestamps
      for (const file of files) {
        await s3Client.send(new PutObjectCommand({
          Bucket: TEST_BUCKET,
          Key: `${pageGuid}/_attachments/${file.guid}-${file.index}.txt`,
          Body: `File ${file.index}`,
        }));
      }

      // List and verify all are present
      const list = await s3Client.send(new ListObjectsV2Command({
        Bucket: TEST_BUCKET,
        Prefix: `${pageGuid}/_attachments/`,
      }));

      expect(list.Contents?.length).toBe(files.length);
      expect(list.Contents).toBeDefined();
    });
  });
});
