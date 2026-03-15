import { APIGatewayProxyEvent } from 'aws-lambda';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
]);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.rtf',
]);

const IMAGE_LIMIT_BYTES = 10 * 1024 * 1024;
const DOCUMENT_LIMIT_BYTES = 50 * 1024 * 1024;

export interface ParsedMultipartFile {
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface AttachmentValidationResult {
  category: 'image' | 'document';
  sizeLimit: number;
}

export function getHeader(headers: APIGatewayProxyEvent['headers'], key: string): string | undefined {
  const lowerKey = key.toLowerCase();
  const headerEntry = Object.entries(headers || {}).find(([headerKey]) => headerKey.toLowerCase() === lowerKey);
  return headerEntry?.[1];
}

export function getBodyBuffer(event: APIGatewayProxyEvent): Buffer {
  if (!event.body) {
    throw new Error('Request body is required');
  }

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64');
  }

  // API Gateway may pass binary data as a string without base64 encoding
  // when BinaryMediaTypes is not configured. Using 'latin1' preserves all
  // byte values (0x00-0xFF) whereas 'utf8' corrupts bytes > 0x7F by
  // replacing them with the U+FFFD replacement character.
  return Buffer.from(event.body, 'latin1');
}

export function parseSingleMultipartFile(bodyBuffer: Buffer, contentTypeHeader: string): ParsedMultipartFile {
  const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = (boundaryMatch?.[1] || boundaryMatch?.[2])?.trim();

  if (!boundary) {
    throw new Error('Missing multipart boundary');
  }

  const boundaryMarker = `--${boundary}`;
  const multipartBody = bodyBuffer.toString('latin1');
  const rawParts = multipartBody.split(boundaryMarker);

  for (const rawPart of rawParts) {
    const part = rawPart.trim();

    if (!part || part === '--') {
      continue;
    }

    const headerEndIndex = rawPart.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) {
      continue;
    }

    const headersText = rawPart.substring(0, headerEndIndex);
    let dataText = rawPart.substring(headerEndIndex + 4);

    if (dataText.endsWith('\r\n')) {
      dataText = dataText.slice(0, -2);
    }

    const dispositionMatch = headersText.match(/content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
    const contentTypeMatch = headersText.match(/content-type:\s*([^\r\n]+)/i);

    const filename = dispositionMatch?.[2];
    if (!filename) {
      continue;
    }

    const normalizedFilename = sanitizeFilename(filename);
    const data = Buffer.from(dataText, 'latin1');

    return {
      filename: normalizedFilename,
      contentType: contentTypeMatch?.[1]?.trim().toLowerCase() || 'application/octet-stream',
      data,
    };
  }

  throw new Error('No file found in multipart payload');
}

export function validateAttachment(file: ParsedMultipartFile): AttachmentValidationResult {
  const extension = getExtension(file.filename);
  const contentType = file.contentType.toLowerCase();

  const isImage = IMAGE_MIME_TYPES.has(contentType) || IMAGE_EXTENSIONS.has(extension);
  const isDocument = DOCUMENT_MIME_TYPES.has(contentType) || DOCUMENT_EXTENSIONS.has(extension);

  if (!isImage && !isDocument) {
    throw new Error('Unsupported file type. Allowed types: images, PDF, and office documents.');
  }

  if (isImage) {
    if (file.data.length > IMAGE_LIMIT_BYTES) {
      throw new Error('File too large. Maximum size is 10MB for images.');
    }

    return { category: 'image', sizeLimit: IMAGE_LIMIT_BYTES };
  }

  if (file.data.length > DOCUMENT_LIMIT_BYTES) {
    throw new Error('File too large. Maximum size is 50MB for documents.');
  }

  return { category: 'document', sizeLimit: DOCUMENT_LIMIT_BYTES };
}

function sanitizeFilename(filename: string): string {
  return filename
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\r\n]/g, '')
    .trim() || 'attachment';
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot < 0) {
    return '';
  }

  return filename.slice(lastDot).toLowerCase();
}
