import { describe, it, expect } from 'vitest';
import { S3StoragePlugin } from '../S3StoragePlugin';

// Regression (WSS-4): every attachment operation on a page that does not exist
// must surface PAGE_NOT_FOUND (404), not be re-wrapped in a generic 500.
describe('S3StoragePlugin attachment ops on a missing page', () => {
  const guid = '11111111-1111-4111-8111-111111111111';

  function makePlugin(): S3StoragePlugin {
    const plugin = new S3StoragePlugin({
      bucketName: 'test-bucket',
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
    });
    (plugin as unknown as { findPageFolder: () => Promise<string | null> }).findPageFolder =
      async () => null;
    return plugin;
  }

  const cases: Array<[string, (p: S3StoragePlugin) => Promise<unknown>]> = [
    ['deleteAttachment', (p) => p.deleteAttachment(guid, 'a.txt')],
    ['getAttachmentUrl', (p) => p.getAttachmentUrl(guid, 'a.txt')],
    ['getAttachmentMetadata', (p) => p.getAttachmentMetadata(guid, 'a.txt')],
    [
      'saveAttachmentMetadata',
      (p) =>
        p.saveAttachmentMetadata(guid, 'a.txt', {
          filename: 'a.txt',
          contentType: 'text/plain',
          size: 1,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'u',
        }),
    ],
    ['listAttachments', (p) => p.listAttachments(guid)],
    ['getAttachmentUploadUrl', (p) => p.getAttachmentUploadUrl(guid, 'a.txt', 'text/plain', 1)],
  ];

  it.each(cases)('%s rejects with PAGE_NOT_FOUND / 404', async (_name, call) => {
    await expect(call(makePlugin())).rejects.toMatchObject({
      code: 'PAGE_NOT_FOUND',
      statusCode: 404,
    });
  });
});
