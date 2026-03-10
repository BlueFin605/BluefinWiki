/**
 * Unit tests for Attachment Utilities (Task 7.1)
 * 
 * Tests multipart parsing, file validation, and size limit enforcement.
 */

import { describe, it, expect } from 'vitest';
import {
  getHeader,
  getBodyBuffer,
  parseSingleMultipartFile,
  validateAttachment,
  ParsedMultipartFile,
} from '../attachments-utils.js';
import { APIGatewayProxyEvent } from 'aws-lambda';

describe('Attachment Utilities', () => {
  describe('getHeader', () => {
    it('should retrieve header case-insensitively', () => {
      const headers = {
        'Content-Type': 'multipart/form-data',
        'authorization': 'Bearer token',
        'X-Custom-Header': 'value',
      };

      expect(getHeader(headers, 'content-type')).toBe('multipart/form-data');
      expect(getHeader(headers, 'Content-Type')).toBe('multipart/form-data');
      expect(getHeader(headers, 'CONTENT-TYPE')).toBe('multipart/form-data');
      expect(getHeader(headers, 'Authorization')).toBe('Bearer token');
      expect(getHeader(headers, 'x-custom-header')).toBe('value');
    });

    it('should return undefined for missing header', () => {
      const headers = { 'Content-Type': 'application/json' };
      expect(getHeader(headers, 'Authorization')).toBeUndefined();
    });

    it('should handle null/undefined headers object', () => {
      expect(getHeader(null as any, 'Content-Type')).toBeUndefined();
      expect(getHeader(undefined as any, 'Content-Type')).toBeUndefined();
    });
  });

  describe('getBodyBuffer', () => {
    it('should decode base64 encoded body', () => {
      const originalText = 'Hello, World!';
      const base64Body = Buffer.from(originalText).toString('base64');

      const event = {
        body: base64Body,
        isBase64Encoded: true,
      } as APIGatewayProxyEvent;

      const result = getBodyBuffer(event);
      expect(result.toString('utf8')).toBe(originalText);
    });

    it('should handle UTF-8 plain text body', () => {
      const plainText = 'Plain text body';

      const event = {
        body: plainText,
        isBase64Encoded: false,
      } as APIGatewayProxyEvent;

      const result = getBodyBuffer(event);
      expect(result.toString('utf8')).toBe(plainText);
    });

    it('should throw error for missing body', () => {
      const event = {
        body: null,
        isBase64Encoded: false,
      } as APIGatewayProxyEvent;

      expect(() => getBodyBuffer(event)).toThrow(/body is required/i);
    });

      it('should throw error for empty string body', () => {
      const event = {
        body: '',
        isBase64Encoded: false,
      } as APIGatewayProxyEvent;

        expect(() => getBodyBuffer(event)).toThrow(/body is required/i);
    });
  });

  describe('parseSingleMultipartFile', () => {
    it('should parse a simple multipart file upload', () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const filename = 'test-document.pdf';
      const fileContent = 'This is a PDF file content';

      const body = [
        `------WebKitFormBoundary7MA4YWxkTrZu0gW`,
        `Content-Disposition: form-data; name="file"; filename="${filename}"`,
        `Content-Type: application/pdf`,
        ``,
        fileContent,
        `------WebKitFormBoundary7MA4YWxkTrZu0gW--`,
      ].join('\r\n');

      const bodyBuffer = Buffer.from(body, 'latin1');
      const contentType = `multipart/form-data; boundary=${boundary}`;

      const result = parseSingleMultipartFile(bodyBuffer, contentType);

      expect(result.filename).toBe(filename);
      expect(result.contentType).toBe('application/pdf');
      expect(result.data.toString('latin1')).toBe(fileContent);
    });

    it('should parse multipart with quoted boundary', () => {
      const boundary = '----Boundary123';
      const filename = 'image.png';
      const fileContent = 'PNG image data';

      const body = [
        `------Boundary123`,
        `Content-Disposition: form-data; name="upload"; filename="${filename}"`,
        `Content-Type: image/png`,
        ``,
        fileContent,
        `------Boundary123--`,
      ].join('\r\n');

      const bodyBuffer = Buffer.from(body, 'latin1');
      const contentType = `multipart/form-data; boundary="${boundary}"`;

      const result = parseSingleMultipartFile(bodyBuffer, contentType);

      expect(result.filename).toBe(filename);
      expect(result.contentType).toBe('image/png');
    });

    it('should handle filenames with paths', () => {
      const boundary = '----Boundary';
      const filename = 'C:\\Users\\Documents\\test.pdf';

      const body = [
        `------Boundary`,
        `Content-Disposition: form-data; name="file"; filename="${filename}"`,
        `Content-Type: application/pdf`,
        ``,
        'content',
        `------Boundary--`,
      ].join('\r\n');

      const bodyBuffer = Buffer.from(body, 'latin1');
      const contentType = `multipart/form-data; boundary=${boundary}`;

      const result = parseSingleMultipartFile(bodyBuffer, contentType);

      // Should extract only the filename
      expect(result.filename).toBe('test.pdf');
    });

    it('should handle filenames with special characters', () => {
      const boundary = '----Boundary';
      const filename = 'My Document (Final) [v2].pdf';

      const body = [
        `------Boundary`,
        `Content-Disposition: form-data; name="file"; filename="${filename}"`,
        `Content-Type: application/pdf`,
        ``,
        'content',
        `------Boundary--`,
      ].join('\r\n');

      const bodyBuffer = Buffer.from(body, 'latin1');
      const contentType = `multipart/form-data; boundary=${boundary}`;

      const result = parseSingleMultipartFile(bodyBuffer, contentType);

      expect(result.filename).toBe(filename);
    });

    it('should default to application/octet-stream if no Content-Type', () => {
      const boundary = '----Boundary';

      const body = [
        `------Boundary`,
        `Content-Disposition: form-data; name="file"; filename="unknown.bin"`,
        ``,
        'binary content',
        `------Boundary--`,
      ].join('\r\n');

      const bodyBuffer = Buffer.from(body, 'latin1');
      const contentType = `multipart/form-data; boundary=${boundary}`;

      const result = parseSingleMultipartFile(bodyBuffer, contentType);

      expect(result.contentType).toBe('application/octet-stream');
    });

    it('should throw error if boundary is missing', () => {
      const bodyBuffer = Buffer.from('some content');
      const contentType = 'multipart/form-data';

      expect(() => parseSingleMultipartFile(bodyBuffer, contentType)).toThrow(/Missing multipart boundary/i);
    });

    it('should throw error if no file found in payload', () => {
      const boundary = '----Boundary';

      const body = [
        `------Boundary`,
        `Content-Disposition: form-data; name="text"`,
        ``,
        'just a text field',
        `------Boundary--`,
      ].join('\r\n');

      const bodyBuffer = Buffer.from(body, 'latin1');
      const contentType = `multipart/form-data; boundary=${boundary}`;

      expect(() => parseSingleMultipartFile(bodyBuffer, contentType)).toThrow(/No file found/i);
    });

    it('should handle binary file data correctly', () => {
      const boundary = '----Boundary';
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header

      // Construct multipart manually with binary data
      const header = [
        `------Boundary`,
        `Content-Disposition: form-data; name="file"; filename="test.png"`,
        `Content-Type: image/png`,
        ``,
        '',
      ].join('\r\n');

      const footer = `\r\n------Boundary--`;

      const bodyBuffer = Buffer.concat([
        Buffer.from(header, 'latin1'),
        binaryData,
        Buffer.from(footer, 'latin1'),
      ]);

      const contentType = `multipart/form-data; boundary=${boundary}`;

      const result = parseSingleMultipartFile(bodyBuffer, contentType);

      expect(result.filename).toBe('test.png');
      expect(result.contentType).toBe('image/png');
      expect(result.data.length).toBe(binaryData.length);
    });
  });

  describe('validateAttachment', () => {
    describe('Image validation', () => {
      it('should accept valid image types', () => {
        const validImages: ParsedMultipartFile[] = [
          { filename: 'photo.jpg', contentType: 'image/jpeg', data: Buffer.alloc(1024) },
          { filename: 'picture.png', contentType: 'image/png', data: Buffer.alloc(1024) },
          { filename: 'animated.gif', contentType: 'image/gif', data: Buffer.alloc(1024) },
          { filename: 'modern.webp', contentType: 'image/webp', data: Buffer.alloc(1024) },
          { filename: 'icon.svg', contentType: 'image/svg+xml', data: Buffer.alloc(1024) },
        ];

        for (const file of validImages) {
          const result = validateAttachment(file);
          expect(result.category).toBe('image');
          expect(result.sizeLimit).toBe(10 * 1024 * 1024);
        }
      });

      it('should reject images exceeding 10MB limit', () => {
        const largeImage: ParsedMultipartFile = {
          filename: 'huge.jpg',
          contentType: 'image/jpeg',
          data: Buffer.alloc(11 * 1024 * 1024), // 11MB
        };

        expect(() => validateAttachment(largeImage)).toThrow(/too large.*10MB/i);
      });

      it('should accept images at exactly 10MB', () => {
        const maxSizeImage: ParsedMultipartFile = {
          filename: 'max.jpg',
          contentType: 'image/jpeg',
          data: Buffer.alloc(10 * 1024 * 1024), // Exactly 10MB
        };

        const result = validateAttachment(maxSizeImage);
        expect(result.category).toBe('image');
      });
    });

    describe('Document validation', () => {
      it('should accept valid document types', () => {
        const validDocs: ParsedMultipartFile[] = [
          { filename: 'doc.pdf', contentType: 'application/pdf', data: Buffer.alloc(1024) },
          { filename: 'old.doc', contentType: 'application/msword', data: Buffer.alloc(1024) },
          { filename: 'new.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: Buffer.alloc(1024) },
          { filename: 'sheet.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: Buffer.alloc(1024) },
          { filename: 'text.txt', contentType: 'text/plain', data: Buffer.alloc(1024) },
          { filename: 'data.csv', contentType: 'text/csv', data: Buffer.alloc(1024) },
        ];

        for (const file of validDocs) {
          const result = validateAttachment(file);
          expect(result.category).toBe('document');
          expect(result.sizeLimit).toBe(50 * 1024 * 1024);
        }
      });

      it('should reject documents exceeding 50MB limit', () => {
        const largeDoc: ParsedMultipartFile = {
          filename: 'huge.pdf',
          contentType: 'application/pdf',
          data: Buffer.alloc(51 * 1024 * 1024), // 51MB
        };

        expect(() => validateAttachment(largeDoc)).toThrow(/too large.*50MB/i);
      });

      it('should accept documents at exactly 50MB', () => {
        const maxSizeDoc: ParsedMultipartFile = {
          filename: 'max.pdf',
          contentType: 'application/pdf',
          data: Buffer.alloc(50 * 1024 * 1024), // Exactly 50MB
        };

        const result = validateAttachment(maxSizeDoc);
        expect(result.category).toBe('document');
      });
    });

    describe('File type validation by extension', () => {
      it('should validate images by extension when MIME type is generic', () => {
        const file: ParsedMultipartFile = {
          filename: 'photo.jpg',
          contentType: 'application/octet-stream',
          data: Buffer.alloc(1024),
        };

        const result = validateAttachment(file);
        expect(result.category).toBe('image');
      });

      it('should validate documents by extension when MIME type is generic', () => {
        const file: ParsedMultipartFile = {
          filename: 'document.pdf',
          contentType: 'application/octet-stream',
          data: Buffer.alloc(1024),
        };

        const result = validateAttachment(file);
        expect(result.category).toBe('document');
      });

      it('should handle uppercase extensions', () => {
        const file: ParsedMultipartFile = {
          filename: 'PHOTO.PNG',
          contentType: 'application/octet-stream',
          data: Buffer.alloc(1024),
        };

        const result = validateAttachment(file);
        expect(result.category).toBe('image');
      });
    });

    describe('Unsupported file types', () => {
      it('should reject executable files', () => {
        const execFile: ParsedMultipartFile = {
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
          data: Buffer.alloc(1024),
        };

        expect(() => validateAttachment(execFile)).toThrow(/Unsupported file type/i);
      });

      it('should reject script files', () => {
        const scriptFile: ParsedMultipartFile = {
          filename: 'script.js',
          contentType: 'application/javascript',
          data: Buffer.alloc(1024),
        };

        expect(() => validateAttachment(scriptFile)).toThrow(/Unsupported file type/i);
      });

      it('should reject archive files', () => {
        const zipFile: ParsedMultipartFile = {
          filename: 'archive.zip',
          contentType: 'application/zip',
          data: Buffer.alloc(1024),
        };

        expect(() => validateAttachment(zipFile)).toThrow(/Unsupported file type/i);
      });

      it('should reject video files', () => {
        const videoFile: ParsedMultipartFile = {
          filename: 'video.mp4',
          contentType: 'video/mp4',
          data: Buffer.alloc(1024),
        };

        expect(() => validateAttachment(videoFile)).toThrow(/Unsupported file type/i);
      });

      it('should reject files with no extension', () => {
        const noExtFile: ParsedMultipartFile = {
          filename: 'noextension',
          contentType: 'application/octet-stream',
          data: Buffer.alloc(1024),
        };

        expect(() => validateAttachment(noExtFile)).toThrow(/Unsupported file type/i);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty filename', () => {
        const file: ParsedMultipartFile = {
          filename: '',
          contentType: 'application/pdf',
          data: Buffer.alloc(1024),
        };

        // Should validate by contentType even without filename
        const result = validateAttachment(file);
        expect(result.category).toBe('document');
      });

      it('should handle MIME type case insensitivity', () => {
        const file: ParsedMultipartFile = {
          filename: 'doc.pdf',
          contentType: 'APPLICATION/PDF',
          data: Buffer.alloc(1024),
        };

        const result = validateAttachment(file);
        expect(result.category).toBe('document');
      });

      it('should handle very small files', () => {
        const tinyFile: ParsedMultipartFile = {
          filename: 'tiny.jpg',
          contentType: 'image/jpeg',
          data: Buffer.alloc(1), // 1 byte
        };

        const result = validateAttachment(tinyFile);
        expect(result.category).toBe('image');
      });

      it('should handle files at size boundaries', () => {
        // Image just under limit
        const image10MB = {
          filename: 'img.jpg',
          contentType: 'image/jpeg',
          data: Buffer.alloc(10 * 1024 * 1024 - 1),
        };
        expect(validateAttachment(image10MB).category).toBe('image');

        // Document just under limit
        const doc50MB = {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
          data: Buffer.alloc(50 * 1024 * 1024 - 1),
        };
        expect(validateAttachment(doc50MB).category).toBe('document');
      });
    });
  });
});
