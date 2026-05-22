import { FILE_LIMITS, formatFileSize, isImageFile, validateFile } from './attachment.types';

function fileWith(name: string, type: string, size: number): File {
  const file = new File([new Uint8Array(0)], name, { type });
  // jsdom uses size from the blob bits — override for testing.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('attachment.types', () => {
  describe('validateFile', () => {
    it('accepts a valid JPEG under 10MB', () => {
      expect(validateFile(fileWith('photo.jpg', 'image/jpeg', 1024))).toBeNull();
    });

    it('rejects an oversized image', () => {
      const oversized = fileWith('huge.png', 'image/png', FILE_LIMITS.IMAGE.maxSize + 1);
      const err = validateFile(oversized);
      expect(err).toMatch(/too large/i);
    });

    it('rejects an unsupported MIME type', () => {
      const err = validateFile(fileWith('weird.bin', 'application/x-octet', 100));
      expect(err).toMatch(/not supported/i);
    });
  });

  describe('formatFileSize', () => {
    it('formats KB', () => {
      expect(formatFileSize(2048)).toBe('2 KB');
    });

    it('formats MB', () => {
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    });

    it('formats GB', () => {
      expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3 GB');
    });

    it('returns 0 Bytes for zero', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });
  });

  describe('isImageFile', () => {
    it('returns true for image MIME types', () => {
      expect(isImageFile(fileWith('a.png', 'image/png', 1))).toBe(true);
    });

    it('returns false for non-image MIME types', () => {
      expect(isImageFile(fileWith('a.pdf', 'application/pdf', 1))).toBe(false);
    });
  });
});
