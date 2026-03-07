/**
 * Integration tests for Page Attachments (Task 7.1)
 * 
 * Tests the complete attachment upload, download, list, and delete flow
 * including multipart parsing, validation, and S3 storage operations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { S3StoragePlugin } from '../../storage/S3StoragePlugin.js';
import { PageContent, AttachmentMetadata } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

const TEST_BUCKET = `test-attachments-${Date.now()}`;
const TEST_REGION = 'us-east-1';

describe('Page Attachments Integration Tests', () => {
  let s3Client: S3Client;
  let storagePlugin: S3StoragePlugin;
  let testPageGuid: string;

  beforeAll(async () => {
    // Use LocalStack endpoint if available, otherwise skip these tests
    const localstackEndpoint = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
    
    s3Client = new S3Client({
      region: TEST_REGION,
      endpoint: localstackEndpoint,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
      forcePathStyle: true,
    });

    // Create test bucket
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));
    } catch (err) {
      console.log('Bucket creation failed (may already exist):', err);
    }

    storagePlugin = new S3StoragePlugin({
      bucketName: TEST_BUCKET,
      region: TEST_REGION,
      endpoint: localstackEndpoint,
    });
  });

  afterAll(async () => {
    // Clean up: Delete all objects in bucket
    try {
      const listResult = await s3Client.send(
        new ListObjectsV2Command({ Bucket: TEST_BUCKET })
      );

      if (listResult.Contents && listResult.Contents.length > 0) {
        for (const obj of listResult.Contents) {
          if (obj.Key) {
            await s3Client.send(
              new DeleteObjectCommand({ Bucket: TEST_BUCKET, Key: obj.Key })
            );
          }
        }
      }

      // Delete bucket
      await s3Client.send(new DeleteBucketCommand({ Bucket: TEST_BUCKET }));
    } catch (err) {
      console.log('Cleanup failed:', err);
    }
  });

  beforeEach(async () => {
    // Create a test page for each test
    testPageGuid = uuidv4();
    const testPage: PageContent = {
      guid: testPageGuid,
      title: 'Test Page for Attachments',
      content: 'This page is used for attachment testing.',
      folderId: '',
      tags: ['test'],
      status: 'published',
      createdBy: 'test-user',
      modifiedBy: 'test-user',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    await storagePlugin.savePage(testPageGuid, null, testPage);
  });

  describe('Upload Attachment', () => {
    it('should upload a PDF attachment successfully', async () => {
      const fileContent = Buffer.from('This is a fake PDF file content');
      
      const result = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'test-document.pdf',
        contentType: 'application/pdf',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      expect(result).toBeDefined();
      expect(result.attachmentGuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(result.filename).toBe('test-document.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.size).toBe(fileContent.length);
      expect(result.attachmentKey).toContain(`${testPageGuid}/_attachments/`);
      expect(result.attachmentKey).toContain('.pdf');
    });

    it('should upload an image attachment successfully', async () => {
      const fileContent = Buffer.from('Fake PNG image data');
      
      const result = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'photo.png',
        contentType: 'image/png',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      expect(result).toBeDefined();
      expect(result.filename).toBe('photo.png');
      expect(result.contentType).toBe('image/png');
      expect(result.attachmentKey).toContain('.png');
    });

    it('should upload multiple attachments to the same page', async () => {
      const file1 = Buffer.from('First file');
      const file2 = Buffer.from('Second file');

      const result1 = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'file1.txt',
        contentType: 'text/plain',
        data: file1,
        uploadedBy: 'test-user',
      });

      const result2 = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'file2.txt',
        contentType: 'text/plain',
        data: file2,
        uploadedBy: 'test-user',
      });

      expect(result1.attachmentGuid).not.toBe(result2.attachmentGuid);
      expect(result1.attachmentKey).toContain(`${testPageGuid}/_attachments/`);
      expect(result2.attachmentKey).toContain(`${testPageGuid}/_attachments/`);
    });

    it('should reject upload for non-existent page', async () => {
      const nonExistentPageGuid = uuidv4();
      const fileContent = Buffer.from('test');

      await expect(
        storagePlugin.uploadAttachment(nonExistentPageGuid, {
          originalFilename: 'test.pdf',
          contentType: 'application/pdf',
          data: fileContent,
          uploadedBy: 'test-user',
        })
      ).rejects.toThrow(/Page not found/i);
    });

    it('should reject upload with invalid page GUID', async () => {
      const fileContent = Buffer.from('test');

      await expect(
        storagePlugin.uploadAttachment('invalid-guid-123', {
          originalFilename: 'test.pdf',
          contentType: 'application/pdf',
          data: fileContent,
          uploadedBy: 'test-user',
        })
      ).rejects.toThrow(/Invalid.*GUID/i);
    });

    it('should handle filenames with special characters', async () => {
      const fileContent = Buffer.from('test');
      
      const result = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'My Document (Final) [v2].pdf',
        contentType: 'application/pdf',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      expect(result.filename).toBe('My Document (Final) [v2].pdf');
      expect(result.attachmentKey).toContain('.pdf');
    });
  });

  describe('Attachment Metadata', () => {
    it('should save and retrieve attachment metadata', async () => {
      const attachmentGuid = uuidv4();
      const metadata: AttachmentMetadata = {
        attachmentId: attachmentGuid,
        originalFilename: 'test-doc.pdf',
        contentType: 'application/pdf',
        size: 12345,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
        checksum: 'abc123def456',
      };

      await storagePlugin.saveAttachmentMetadata(testPageGuid, attachmentGuid, metadata);

      const retrieved = await storagePlugin.getAttachmentMetadata(testPageGuid, attachmentGuid);

      expect(retrieved).toEqual(metadata);
    });

    it('should save metadata with optional fields', async () => {
      const attachmentGuid = uuidv4();
      const metadata: AttachmentMetadata = {
        attachmentId: attachmentGuid,
        originalFilename: 'image.png',
        contentType: 'image/png',
        size: 54321,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
        checksum: 'xyz789',
        dimensions: { width: 1920, height: 1080 },
      };

      await storagePlugin.saveAttachmentMetadata(testPageGuid, attachmentGuid, metadata);

      const retrieved = await storagePlugin.getAttachmentMetadata(testPageGuid, attachmentGuid);

      expect(retrieved).toEqual(metadata);
      expect(retrieved.dimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('should throw error when metadata not found', async () => {
      const nonExistentGuid = uuidv4();

      await expect(
        storagePlugin.getAttachmentMetadata(testPageGuid, nonExistentGuid)
      ).rejects.toThrow(/Metadata not found/i);
    });
  });

  describe('Get Attachment URL', () => {
    it('should generate presigned URL for existing attachment', async () => {
      // First upload an attachment
      const fileContent = Buffer.from('Test file content');
      const uploadResult = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'test.pdf',
        contentType: 'application/pdf',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      // Get the URL
      const url = await storagePlugin.getAttachmentUrl(testPageGuid, uploadResult.attachmentGuid);

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      // Should contain the bucket name
      expect(url).toContain(TEST_BUCKET);
    });

    it('should throw error for non-existent attachment', async () => {
      const nonExistentGuid = uuidv4();

      await expect(
        storagePlugin.getAttachmentUrl(testPageGuid, nonExistentGuid)
      ).rejects.toThrow(/Attachment not found/i);
    });
  });

  describe('List Attachments', () => {
    it('should list all attachments for a page', async () => {
      // Upload multiple attachments
      const file1 = Buffer.from('First file');
      const file2 = Buffer.from('Second file');

      const result1 = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'doc1.pdf',
        contentType: 'application/pdf',
        data: file1,
        uploadedBy: 'user1',
      });

      // Save metadata for first attachment
      await storagePlugin.saveAttachmentMetadata(testPageGuid, result1.attachmentGuid, {
        attachmentId: result1.attachmentGuid,
        originalFilename: 'doc1.pdf',
        contentType: 'application/pdf',
        size: file1.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'user1',
        checksum: 'checksum1',
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));

      const result2 = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'image.png',
        contentType: 'image/png',
        data: file2,
        uploadedBy: 'user2',
      });

      // Save metadata for second attachment
      await storagePlugin.saveAttachmentMetadata(testPageGuid, result2.attachmentGuid, {
        attachmentId: result2.attachmentGuid,
        originalFilename: 'image.png',
        contentType: 'image/png',
        size: file2.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'user2',
        checksum: 'checksum2',
      });

      // List attachments
      const attachments = await storagePlugin.listAttachments(testPageGuid);

      expect(attachments).toHaveLength(2);
      
      // Should be sorted by uploadedAt descending (newest first)
      const attachment1 = attachments.find(a => a.attachmentId === result1.attachmentGuid);
      const attachment2 = attachments.find(a => a.attachmentId === result2.attachmentGuid);

      expect(attachment1).toBeDefined();
      expect(attachment1?.originalFilename).toBe('doc1.pdf');
      expect(attachment1?.contentType).toBe('application/pdf');
      expect(attachment1?.uploadedBy).toBe('user1');

      expect(attachment2).toBeDefined();
      expect(attachment2?.originalFilename).toBe('image.png');
      expect(attachment2?.contentType).toBe('image/png');
      expect(attachment2?.uploadedBy).toBe('user2');
    });

    it('should return empty array for page with no attachments', async () => {
      const attachments = await storagePlugin.listAttachments(testPageGuid);

      expect(attachments).toEqual([]);
    });

    it('should handle page with attachments but missing metadata', async () => {
      // Upload attachment without saving metadata
      const fileContent = Buffer.from('Test');
      await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'test.pdf',
        contentType: 'application/pdf',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      // Should still list the attachment (with fallback metadata)
      const attachments = await storagePlugin.listAttachments(testPageGuid);

      expect(attachments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Delete Attachment', () => {
    it('should delete an existing attachment', async () => {
      // Upload an attachment
      const fileContent = Buffer.from('Test file');
      const uploadResult = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'to-delete.pdf',
        contentType: 'application/pdf',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      // Verify it exists
      let attachments = await storagePlugin.listAttachments(testPageGuid);
      expect(attachments.some(a => a.attachmentId === uploadResult.attachmentGuid)).toBe(true);

      // Delete it
      await storagePlugin.deleteAttachment(testPageGuid, uploadResult.attachmentGuid);

      // Verify it's gone
      attachments = await storagePlugin.listAttachments(testPageGuid);
      expect(attachments.some(a => a.attachmentId === uploadResult.attachmentGuid)).toBe(false);
    });

    it('should throw error when deleting non-existent attachment', async () => {
      const nonExistentGuid = uuidv4();

      await expect(
        storagePlugin.deleteAttachment(testPageGuid, nonExistentGuid)
      ).rejects.toThrow(/Attachment not found/i);
    });

    it('should delete both file and metadata', async () => {
      // Upload attachment with metadata
      const fileContent = Buffer.from('Test file');
      const uploadResult = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'with-metadata.pdf',
        contentType: 'application/pdf',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      await storagePlugin.saveAttachmentMetadata(testPageGuid, uploadResult.attachmentGuid, {
        attachmentId: uploadResult.attachmentGuid,
        originalFilename: 'with-metadata.pdf',
        contentType: 'application/pdf',
        size: fileContent.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
        checksum: 'test',
      });

      // Delete attachment
      await storagePlugin.deleteAttachment(testPageGuid, uploadResult.attachmentGuid);

      // Verify both are gone
      await expect(
        storagePlugin.getAttachmentUrl(testPageGuid, uploadResult.attachmentGuid)
      ).rejects.toThrow();

      await expect(
        storagePlugin.getAttachmentMetadata(testPageGuid, uploadResult.attachmentGuid)
      ).rejects.toThrow();
    });
  });

  describe('Complete Upload-Download-Delete Flow', () => {
    it('should handle complete lifecycle of an attachment', async () => {
      const fileContent = Buffer.from('Complete lifecycle test content');

      // 1. Upload
      const uploadResult = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'lifecycle-test.pdf',
        contentType: 'application/pdf',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      expect(uploadResult.attachmentGuid).toBeDefined();

      // 2. Save metadata
      const metadata: AttachmentMetadata = {
        attachmentId: uploadResult.attachmentGuid,
        originalFilename: 'lifecycle-test.pdf',
        contentType: 'application/pdf',
        size: fileContent.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
        checksum: 'lifecycle-checksum',
      };

      await storagePlugin.saveAttachmentMetadata(testPageGuid, uploadResult.attachmentGuid, metadata);

      // 3. List - verify it appears
      let attachments = await storagePlugin.listAttachments(testPageGuid);
      expect(attachments.some(a => a.attachmentId === uploadResult.attachmentGuid)).toBe(true);

      // 4. Get metadata - verify it's correct
      const retrievedMetadata = await storagePlugin.getAttachmentMetadata(testPageGuid, uploadResult.attachmentGuid);
      expect(retrievedMetadata).toEqual(metadata);

      // 5. Get download URL
      const downloadUrl = await storagePlugin.getAttachmentUrl(testPageGuid, uploadResult.attachmentGuid);
      expect(downloadUrl).toBeDefined();

      // 6. Delete
      await storagePlugin.deleteAttachment(testPageGuid, uploadResult.attachmentGuid);

      // 7. List - verify it's gone
      attachments = await storagePlugin.listAttachments(testPageGuid);
      expect(attachments.some(a => a.attachmentId === uploadResult.attachmentGuid)).toBe(false);
    });
  });

  describe('File Type Validation', () => {
    it('should handle various supported file types', async () => {
      const supportedTypes = [
        { ext: '.pdf', type: 'application/pdf' },
        { ext: '.png', type: 'image/png' },
        { ext: '.jpg', type: 'image/jpeg' },
        { ext: '.jpeg', type: 'image/jpeg' },
        { ext: '.gif', type: 'image/gif' },
        { ext: '.webp', type: 'image/webp' },
        { ext: '.doc', type: 'application/msword' },
        { ext: '.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { ext: '.xls', type: 'application/vnd.ms-excel' },
        { ext: '.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      ];

      for (const fileType of supportedTypes) {
        const result = await storagePlugin.uploadAttachment(testPageGuid, {
          originalFilename: `test${fileType.ext}`,
          contentType: fileType.type,
          data: Buffer.from('test'),
          uploadedBy: 'test-user',
        });

        expect(result.filename).toBe(`test${fileType.ext}`);
        expect(result.contentType).toBe(fileType.type);
        expect(result.attachmentKey).toContain(fileType.ext);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid page GUID gracefully', async () => {
      await expect(
        storagePlugin.uploadAttachment('not-a-valid-guid', {
          originalFilename: 'test.pdf',
          contentType: 'application/pdf',
          data: Buffer.from('test'),
          uploadedBy: 'test-user',
        })
      ).rejects.toThrow();
    });

    it('should handle invalid attachment GUID gracefully', async () => {
      await expect(
        storagePlugin.deleteAttachment(testPageGuid, 'not-a-valid-guid')
      ).rejects.toThrow();

      await expect(
        storagePlugin.getAttachmentUrl(testPageGuid, 'not-a-valid-guid')
      ).rejects.toThrow();
    });

    it('should handle empty attachment list', async () => {
      const newPageGuid = uuidv4();
      const newPage: PageContent = {
        guid: newPageGuid,
        title: 'Empty Page',
        content: 'No attachments here',
        folderId: '',
        tags: [],
        status: 'published',
        createdBy: 'test-user',
        modifiedBy: 'test-user',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };

      await storagePlugin.savePage(newPageGuid, null, newPage);

      const attachments = await storagePlugin.listAttachments(newPageGuid);
      expect(attachments).toEqual([]);
    });
  });
});
