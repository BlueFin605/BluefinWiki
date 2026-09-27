import {
  attachmentEmoji,
  buildAttachmentMarkdown,
  FILE_LIMITS,
  formatFileSize,
  isImageContentType,
  isImageFile,
  validateFile,
} from './attachment.types';

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

  describe('isImageContentType', () => {
    it('is true for image content types, case-insensitively', () => {
      expect(isImageContentType('image/png')).toBe(true);
      expect(isImageContentType('IMAGE/JPEG')).toBe(true);
    });

    it('is false for non-image content types', () => {
      expect(isImageContentType('application/pdf')).toBe(false);
      expect(isImageContentType('')).toBe(false);
    });
  });

  describe('attachmentEmoji', () => {
    it('picks by content type first', () => {
      expect(attachmentEmoji('a.png', 'image/png')).toBe('🖼️');
      expect(attachmentEmoji('clip.mp4', 'video/mp4')).toBe('🎬');
      expect(attachmentEmoji('song.mp3', 'audio/mpeg')).toBe('🎵');
      expect(attachmentEmoji('report.pdf', 'application/pdf')).toBe('📄');
    });

    it('falls back to the filename extension when the content type is generic', () => {
      expect(attachmentEmoji('sheet.xlsx', 'application/octet-stream')).toBe('📊');
      expect(attachmentEmoji('slides.pptx', 'application/octet-stream')).toBe('📽️');
      expect(attachmentEmoji('notes.md', 'application/octet-stream')).toBe('📃');
      expect(attachmentEmoji('bundle.zip', 'application/octet-stream')).toBe('🗜️');
    });

    it('defaults to a paperclip for anything unrecognised', () => {
      expect(attachmentEmoji('mystery', 'application/x-thing')).toBe('📎');
    });
  });

  describe('buildAttachmentMarkdown', () => {
    it('builds an image embed for image content types, stripping the extension for the alt text', () => {
      expect(buildAttachmentMarkdown('Diagram.png', 'image/png')).toBe('![Diagram](Diagram.png)');
    });

    it('URL-encodes the filename in the link target', () => {
      expect(buildAttachmentMarkdown('My Photo.jpg', 'image/jpeg')).toBe('![My Photo](My%20Photo.jpg)');
    });

    it('builds a plain link for non-image content types, keeping the full filename as the text', () => {
      expect(buildAttachmentMarkdown('report.pdf', 'application/pdf')).toBe('[report.pdf](report.pdf)');
    });

    it('falls back to "attachment" alt text when an image filename is only an extension', () => {
      expect(buildAttachmentMarkdown('.png', 'image/png')).toBe('![attachment](.png)');
    });

    it('matches on the content-type prefix case-insensitively', () => {
      expect(buildAttachmentMarkdown('a.PNG', 'IMAGE/PNG')).toBe('![a](a.PNG)');
    });
  });
});
