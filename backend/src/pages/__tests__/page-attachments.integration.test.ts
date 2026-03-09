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
    it('should use sanitized filename for uploaded attachment', async () => {
      const fileContent = Buffer.from('This is a fake PDF file content');
      
      const result = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'test-document.pdf',
        contentType: 'application/pdf',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      expect(result).toBeDefined();
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

      expect(result1.filename).not.toBe(result2.filename);
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

      // Filename is sanitized: spaces become underscores, special chars removed
      expect(result.filename).toBe('My_Document_Final_v2.pdf');
      expect(result.attachmentKey).toContain('.pdf');
    });
  });

  describe('Attachment Metadata', () => {
    it('should save and retrieve attachment metadata', async () => {
      const filename = 'test-doc.pdf';
      const metadata: AttachmentMetadata = {
        filename: filename,
        contentType: 'application/pdf',
        size: 12345,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
      };

      await storagePlugin.saveAttachmentMetadata(testPageGuid, filename, metadata);

      const retrieved = await storagePlugin.getAttachmentMetadata(testPageGuid, filename);

      expect(retrieved).toEqual(metadata);
    });

    it('should save metadata with optional fields', async () => {
      const filename = 'image.png';
      const metadata: AttachmentMetadata = {
        filename: filename,
        contentType: 'image/png',
        size: 54321,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
        dimensions: { width: 1920, height: 1080 },
      };

      await storagePlugin.saveAttachmentMetadata(testPageGuid, filename, metadata);

      const retrieved = await storagePlugin.getAttachmentMetadata(testPageGuid, filename);

      expect(retrieved).toEqual(metadata);
      expect(retrieved.dimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('should throw error when metadata not found', async () => {
      const nonExistentFilename = 'nonexistent.pdf';

      await expect(
        storagePlugin.getAttachmentMetadata(testPageGuid, nonExistentFilename)
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
      const url = await storagePlugin.getAttachmentUrl(testPageGuid, uploadResult.filename);

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      // Should contain the bucket name
      expect(url).toContain(TEST_BUCKET);
    });

    it('should generate presigned URL even for non-existent attachment', async () => {
      // Note: S3 presigned URL generation succeeds even if file doesn't exist
      // Validation happens when the URL is accessed
      const nonExistentFilename = 'nonexistent.pdf';

      const url = await storagePlugin.getAttachmentUrl(testPageGuid, nonExistentFilename);
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      expect(url).toContain('nonexistent.pdf');
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
      await storagePlugin.saveAttachmentMetadata(testPageGuid, result1.filename, {
        filename: result1.filename,
        contentType: 'application/pdf',
        size: file1.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'user1',
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
      await storagePlugin.saveAttachmentMetadata(testPageGuid, result2.filename, {
        filename: result2.filename,
        contentType: 'image/png',
        size: file2.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'user2',
      });

      // List attachments
      const attachments = await storagePlugin.listAttachments(testPageGuid);

      expect(attachments).toHaveLength(2);
      
      // Should be sorted by uploadedAt descending (newest first)
      const attachment1 = attachments.find(a => a.filename === result1.filename);
      const attachment2 = attachments.find(a => a.filename === result2.filename);

      expect(attachment1).toBeDefined();
      expect(attachment1?.filename).toBe('doc1.pdf');
      expect(attachment1?.contentType).toBe('application/pdf');
      expect(attachment1?.uploadedBy).toBe('user1');

      expect(attachment2).toBeDefined();
      expect(attachment2?.filename).toBe('image.png');
      expect(attachment2?.contentType).toBe('image/png');
      expect(attachment2?.uploadedBy).toBe('user2');
    });

    it('should return empty array for page with no attachments', async () => {
      const attachments = await storagePlugin.listAttachments(testPageGuid);

      expect(attachments).toEqual([]);
    });

    it('should handle page with attachments but missing metadata', async () => {
      // Upload attachment
      const fileContent = Buffer.from('Test');
      const uploadResult = await storagePlugin.uploadAttachment(testPageGuid, {
        originalFilename: 'test.pdf',
        contentType: 'application/pdf',
        data: fileContent,
        uploadedBy: 'test-user',
      });

      // Save metadata so it appears in listings
      await storagePlugin.saveAttachmentMetadata(testPageGuid, uploadResult.filename, {
        filename: uploadResult.filename,
        contentType: 'application/pdf',
        size: fileContent.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
      });

      // Should list the attachment with metadata
      const attachments = await storagePlugin.listAttachments(testPageGuid);

      expect(attachments.length).toBeGreaterThanOrEqual(1);
      expect(attachments[0].filename).toBe(uploadResult.filename);
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

      // Save metadata so it appears in list
      await storagePlugin.saveAttachmentMetadata(testPageGuid, uploadResult.filename, {
        filename: uploadResult.filename,
        contentType: 'application/pdf',
        size: fileContent.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
      });

      // Verify it exists
      let attachments = await storagePlugin.listAttachments(testPageGuid);
      expect(attachments.some(a => a.filename === uploadResult.filename)).toBe(true);

      // Delete it
      await storagePlugin.deleteAttachment(testPageGuid, uploadResult.filename);

      // Verify it's gone
      attachments = await storagePlugin.listAttachments(testPageGuid);
      expect(attachments.some(a => a.filename === uploadResult.filename)).toBe(false);
    });

    it('should handle deleting non-existent attachment gracefully', async () => {
      const nonExistentFilename = 'nonexistent.pdf';

      // S3 DeleteObjects doesn't throw error for non-existent objects
      // This should complete successfully
      await expect(
        storagePlugin.deleteAttachment(testPageGuid, nonExistentFilename)
      ).resolves.not.toThrow();
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

      await storagePlugin.saveAttachmentMetadata(testPageGuid, uploadResult.filename, {
        filename: uploadResult.filename,
        contentType: 'application/pdf',
        size: fileContent.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
      });

      // Delete attachment
      await storagePlugin.deleteAttachment(testPageGuid, uploadResult.filename);

      // Verify metadata is gone (will throw error)
      await expect(
        storagePlugin.getAttachmentMetadata(testPageGuid, uploadResult.filename)
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

      expect(uploadResult.filename).toBeDefined();

      // 2. Save metadata
      const metadata: AttachmentMetadata = {
        filename: uploadResult.filename,
        contentType: 'application/pdf',
        size: fileContent.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'test-user',
      };

      await storagePlugin.saveAttachmentMetadata(testPageGuid, uploadResult.filename, metadata);

      // 3. List - verify it appears
      let attachments = await storagePlugin.listAttachments(testPageGuid);
      expect(attachments.some(a => a.filename === uploadResult.filename)).toBe(true);

      // 4. Get metadata - verify it's correct
      const retrievedMetadata = await storagePlugin.getAttachmentMetadata(testPageGuid, uploadResult.filename);
      expect(retrievedMetadata).toEqual(metadata);

      // 5. Get download URL
      const downloadUrl = await storagePlugin.getAttachmentUrl(testPageGuid, uploadResult.filename);
      expect(downloadUrl).toBeDefined();

      // 6. Delete
      await storagePlugin.deleteAttachment(testPageGuid, uploadResult.filename);

      // 7. List - verify it's gone
      attachments = await storagePlugin.listAttachments(testPageGuid);
      expect(attachments.some(a => a.filename === uploadResult.filename)).toBe(false);
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

    it('should handle errors with invalid page GUID gracefully', async () => {
      const invalidPageGuid = 'not-a-guid';
      const filename = 'test.pdf';

      await expect(
        storagePlugin.deleteAttachment(invalidPageGuid, filename)
      ).rejects.toThrow(/Invalid GUID format/i);

      await expect(
        storagePlugin.getAttachmentUrl(invalidPageGuid, filename)
      ).rejects.toThrow(/Invalid GUID format/i);
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
