# Attachment Upload Components

This directory contains the frontend components for uploading and managing page attachments.

## Components

### AttachmentUploader

The main component that combines file upload UI and progress tracking.

**Usage:**

```tsx
import { AttachmentUploader } from './components/editor';

function PageEditor({ pageGuid }: { pageGuid: string }) {
  const handleUploadComplete = (attachmentGuid: string, filename: string, url: string) => {
    console.log('Upload complete:', { attachmentGuid, filename, url });
  };

  const handleInsertMarkdown = (attachmentGuid: string, filename: string, isImage: boolean) => {
    const markdown = isImage
      ? `![${filename}](${attachmentGuid})`
      : `[${filename}](${attachmentGuid})`;
    // Insert markdown into your editor
  };

  return (
    <AttachmentUploader
      pageGuid={pageGuid}
      onUploadComplete={handleUploadComplete}
      onInsertMarkdown={handleInsertMarkdown}
    />
  );
}
```

**Props:**
- `pageGuid` (required): The GUID of the page to upload attachments to
- `onUploadComplete` (optional): Callback when an upload completes successfully
- `onInsertMarkdown` (optional): Callback when user clicks "Insert" button
- `className` (optional): Additional CSS classes

---

### FileUpload

A drag-and-drop file upload component with file picker fallback.

**Usage:**

```tsx
import FileUpload from './components/editor/FileUpload';

function MyUploader() {
  const handleFilesSelected = (files: File[]) => {
    console.log('Selected files:', files);
    // Handle file upload
  };

  return (
    <FileUpload
      onFilesSelected={handleFilesSelected}
      multiple={true}
      disabled={false}
    />
  );
}
```

**Features:**
- Drag-and-drop zone with visual feedback
- File picker button as fallback
- Multi-file upload support
- Client-side file validation
- Displays validation errors

**Props:**
- `onFilesSelected` (required): Callback when files are selected
- `disabled` (optional): Disable the upload zone
- `multiple` (optional): Allow multiple file selection (default: true)
- `className` (optional): Additional CSS classes

---

### AttachmentUploadList

Displays upload progress for multiple files.

**Usage:**

```tsx
import AttachmentUploadList from './components/editor/AttachmentUploadList';
import { useAttachments } from './hooks/useAttachments';

function MyUploader({ pageGuid }: { pageGuid: string }) {
  const { uploadProgress, clearCompletedUploads } = useAttachments(pageGuid);

  return (
    <AttachmentUploadList
      uploads={uploadProgress}
      onClearCompleted={clearCompletedUploads}
      onInsertMarkdown={(guid, filename, isImage) => {
        // Insert markdown
      }}
    />
  );
}
```

**Features:**
- Progress bars for each file
- Status icons (pending, uploading, completed, failed)
- Error messages for failed uploads
- "Insert" button for completed uploads
- "Clear Completed" button

**Props:**
- `uploads` (required): Array of AttachmentUploadProgress objects
- `onClearCompleted` (optional): Callback to clear completed uploads
- `onInsertMarkdown` (optional): Callback when "Insert" button is clicked

---

## Hooks

### useAttachments

A React hook for managing attachment uploads and operations.

**Usage:**

```tsx
import { useAttachments } from './hooks/useAttachments';

function MyComponent({ pageGuid }: { pageGuid: string }) {
  const {
    uploadFile,
    uploadFiles,
    listAttachments,
    deleteAttachment,
    uploadProgress,
    clearCompletedUploads,
    clearAllUploads,
  } = useAttachments(pageGuid);

  const handleUpload = async (file: File) => {
    try {
      const response = await uploadFile(file);
      console.log('Uploaded:', response);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      {/* Your UI */}
    </div>
  );
}
```

**Methods:**
- `uploadFile(file: File)`: Upload a single file with progress tracking
- `uploadFiles(files: File[])`: Upload multiple files sequentially
- `listAttachments()`: Get all attachments for the page
- `deleteAttachment(attachmentGuid: string)`: Delete an attachment
- `clearCompletedUploads()`: Remove completed uploads from progress list
- `clearAllUploads()`: Clear all upload progress

**State:**
- `uploadProgress`: Array of AttachmentUploadProgress objects

---

## Types

### AttachmentUploadProgress

```typescript
interface AttachmentUploadProgress {
  file: File;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  attachmentGuid?: string;
  url?: string;
}
```

### AttachmentUploadResponse

```typescript
interface AttachmentUploadResponse {
  attachmentGuid: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
}
```

### AttachmentMetadata

```typescript
interface AttachmentMetadata {
  attachmentId: string;
  originalFilename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  dimensions?: { width: number; height: number };
  duration?: number;
  checksum?: string;
}
```

---

## File Validation

The components automatically validate files based on:

**File Types:**
- **Images**: JPEG, PNG, GIF, WebP, SVG (max 10MB)
- **Documents**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT (max 50MB)
- **Video**: MP4, WebM, OGG (max 50MB)
- **Audio**: MP3, WAV, OGG, M4A (max 50MB)

**Validation Functions:**

```typescript
import { validateFile, isImageFile, formatFileSize } from './types/attachment';

// Validate a file
const error = validateFile(file);
if (error) {
  console.error(error);
}

// Check if file is an image
if (isImageFile(file)) {
  console.log('This is an image');
}

// Format file size for display
console.log(formatFileSize(1024 * 1024)); // "1 MB"
```

---

## API Integration

The components use the API client configured in `config/api.ts` to upload files to:

```
POST /pages/{pageGuid}/attachments
Content-Type: multipart/form-data
```

**Response:**

```json
{
  "attachmentGuid": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "example.jpg",
  "contentType": "image/jpeg",
  "size": 1024000,
  "url": "/pages/{pageGuid}/attachments/{attachmentGuid}"
}
```

---

## Styling

All components use Tailwind CSS classes and support dark mode. They are fully responsive and accessible.

Custom styling can be applied using the `className` prop on each component.

---

## Example: Full Integration

```tsx
import { useState } from 'react';
import { AttachmentUploader } from './components/editor';

function PageEditorWithAttachments({ pageGuid }: { pageGuid: string }) {
  const [editorContent, setEditorContent] = useState('');

  const handleInsertMarkdown = (
    attachmentGuid: string,
    filename: string,
    isImage: boolean
  ) => {
    const markdown = isImage
      ? `![${filename}](${attachmentGuid})`
      : `[${filename}](${attachmentGuid})`;
    
    // Insert at cursor position or append
    setEditorContent(prev => prev + '\n' + markdown);
  };

  return (
    <div>
      <textarea
        value={editorContent}
        onChange={(e) => setEditorContent(e.target.value)}
        className="w-full h-64 p-4 border rounded"
      />
      
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Upload Attachments</h3>
        <AttachmentUploader
          pageGuid={pageGuid}
          onInsertMarkdown={handleInsertMarkdown}
        />
      </div>
    </div>
  );
}
```
