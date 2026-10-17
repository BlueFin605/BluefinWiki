import { describe, it, expect } from 'vitest';
import { S3StoragePlugin } from '../S3StoragePlugin';

// Uses the real presigner (no mocks): regression for the empty-body CRC32 baked
// into presigned PUT URLs, which made S3/LocalStack reject any non-empty upload.
describe('S3StoragePlugin presigned upload URL', () => {
  it('does not embed a request checksum in the presigned PUT URL', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    const plugin = new S3StoragePlugin({
      bucketName: 'test-bucket',
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
    });
    const guid = '11111111-1111-4111-8111-111111111111';
    (plugin as unknown as { buildAttachmentPath: () => Promise<string> }).buildAttachmentPath =
      async () => `${guid}/`;

    const { uploadUrl } = await plugin.getAttachmentUploadUrl(guid, 'a.txt', 'text/plain', 5);
    const params = new URL(uploadUrl).searchParams;

    expect([...params.keys()].map((k) => k.toLowerCase())).not.toContain('x-amz-checksum-crc32');
    expect([...params.keys()].map((k) => k.toLowerCase())).not.toContain('x-amz-sdk-checksum-algorithm');
    expect(params.get('X-Amz-SignedHeaders')).toContain('content-length');
  });
});
