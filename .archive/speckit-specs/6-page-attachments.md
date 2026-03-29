# Feature Specification: Page Attachments with Visual Display

**Feature Branch**: `6-page-attachments`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "Ability to include attachments to a markdown file, stored alongside the md file, but displayed visually within the page if possible depending on the type"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload Image Attachment and Display Inline (Priority: P1)

A user uploads an image file (JPG, PNG, GIF, SVG) as an attachment to a page, which is stored alongside the markdown file, and the image displays visually inline within the page content.

**Why this priority**: Images are fundamental to rich wiki content. Visual display of images is essential for documentation, tutorials, and family photos.

**Independent Test**: Edit a page, click "Upload Attachment", select an image "family-photo.jpg", verify it uploads and displays inline in the preview, save the page, and confirm the image appears in the published page view.

**Acceptance Scenarios**:

1. **Given** a user is editing a page, **When** they click "Upload Attachment" button in toolbar, **Then** a file picker dialog opens accepting common file types
2. **Given** an image file is selected, **When** upload completes, **Then** the image is stored via storage plugin's `uploadAttachment()` method in the page's attachment folder
3. **Given** image upload succeeds, **When** markdown is inserted, **Then** syntax `![filename](attachment-id.jpg)` is added at cursor position
4. **Given** image markdown in editor, **When** preview renders, **Then** the actual image displays inline at full width or specified dimensions
5. **Given** a published page with image attachment, **When** page is viewed, **Then** the image loads and displays inline within the content flow

---

### User Story 2 - Upload Document Attachments (PDF, DOCX, etc.) (Priority: P1)

A user uploads document files (PDF, DOCX, XLSX, etc.) as attachments, which are stored alongside the markdown file and displayed as downloadable links with file metadata (name, size, type).

**Why this priority**: Document attachments are essential for sharing references, reports, and resources. Download links are the primary interaction for non-visual files.

**Independent Test**: Upload a PDF file "project-plan.pdf", verify it's stored as an attachment, see a formatted download link with file icon and size, click the link, and confirm the PDF downloads or opens correctly.

**Acceptance Scenarios**:

1. **Given** a document file is uploaded, **When** storage completes, **Then** markdown link `[filename](attachment-id.pdf)` is inserted
2. **Given** document markdown in preview/published page, **When** rendered, **Then** a styled download link displays with file icon, name, and size (e.g., "📄 project-plan.pdf (2.3 MB)")
3. **Given** a PDF attachment link, **When** clicked, **Then** the PDF opens in browser viewer or triggers download based on browser settings
4. **Given** document attachments, **When** displayed, **Then** appropriate file type icons show (PDF, Word, Excel, etc.)
5. **Given** multiple document attachments, **When** on same page, **Then** they are distinguishable by name and type

---

### User Story 3 - Upload Video Attachments with Inline Player (Priority: P2)

A user uploads video files (MP4, WebM) as attachments, which are stored alongside the markdown file and displayed with an inline HTML5 video player in the page.

**Why this priority**: Video support enriches content but isn't essential for MVP. Users can link to external video platforms (YouTube) as a workaround.

**Independent Test**: Upload a video "tutorial.mp4", verify it's stored as an attachment, view the page, and confirm an inline video player displays with play/pause controls.

**Acceptance Scenarios**:

1. **Given** a video file is uploaded, **When** stored successfully, **Then** markdown syntax with video indicator is inserted (e.g., `![video](attachment-id.mp4)` or custom syntax)
2. **Given** video markdown in published page, **When** rendered, **Then** an HTML5 video player displays inline with standard controls (play, pause, volume, fullscreen)
3. **Given** video player, **When** displayed, **Then** a poster thumbnail shows before playback (generated or first frame)
4. **Given** large video files, **When** page loads, **Then** video is lazy-loaded to prevent blocking page render
5. **Given** video playback, **When** played, **Then** video streams efficiently without requiring full download first

---

### User Story 4 - View All Page Attachments List (Priority: P2)

A user viewing a page can see a complete list of all attachments at the bottom of the page, showing file names, types, sizes, and upload dates, with download links for each.

**Why this priority**: Attachment list helps users find files quickly but isn't essential if attachments are referenced inline. Nice to have for organization.

**Independent Test**: Add 5 attachments to a page (mix of images and documents), view the page, scroll to bottom, and verify an "Attachments" section lists all files with metadata and download links.

**Acceptance Scenarios**:

1. **Given** a page has attachments, **When** page is viewed, **Then** an "Attachments" section appears at the bottom listing all files
2. **Given** the attachments list, **When** displayed, **Then** each entry shows file icon, name, type, size, and upload date
3. **Given** attachment list entries, **When** clicked, **Then** files are downloaded or opened appropriately
4. **Given** inline-displayed attachments (images, videos), **When** listed, **Then** they appear both inline and in the list
5. **Given** no attachments on page, **When** viewed, **Then** no "Attachments" section appears

---

### User Story 5 - Delete Attachment from Page (Priority: P2)

A user editing a page can delete an attachment, which removes it from storage and updates any references in the markdown content.

**Why this priority**: Attachment management is important but not essential for MVP. Users can remove markdown references manually as workaround.

**Independent Test**: Edit a page with attachments, click "Manage Attachments", select an attachment, click "Delete", confirm deletion, and verify the file is removed from storage and markdown references are removed or marked as broken.

**Acceptance Scenarios**:

1. **Given** a user is editing a page, **When** they click "Manage Attachments", **Then** a dialog shows all page attachments with delete buttons
2. **Given** an attachment in the list, **When** user clicks "Delete", **Then** a confirmation prompt asks "Delete filename.jpg? This cannot be undone."
3. **Given** deletion is confirmed, **When** processed, **Then** the file is removed via storage plugin's `deleteAttachment()` method
4. **Given** attachment is deleted, **When** markdown still references it, **Then** the reference is either removed automatically or marked with "⚠️ Missing attachment"
5. **Given** inline-displayed image is deleted, **When** page is viewed, **Then** a placeholder shows "Image not found" instead of broken image

---

### User Story 6 - Replace/Update Existing Attachment (Priority: P3)

A user can replace an existing attachment with a new file while keeping the same filename and markdown references, useful for updating diagrams or documents.

**Why this priority**: Useful for versioning but not essential. Users can delete old and upload new as workaround.

**Independent Test**: Upload "diagram.png", reference it in content, later upload a new version of "diagram.png" as replacement, and verify the new image displays without changing markdown references.

**Acceptance Scenarios**:

1. **Given** an attachment exists, **When** user uploads file with same name, **Then** system prompts "diagram.png already exists. Replace it?"
2. **Given** replace is confirmed, **When** processed, **Then** the old file is overwritten with new content
3. **Given** attachment is replaced, **When** markdown references remain unchanged, **Then** new file displays automatically
4. **Given** replacement upload, **When** completed, **Then** modified timestamp updates but attachment ID remains stable
5. **Given** version history is enabled, **When** attachment is replaced, **Then** old version is preserved in storage plugin's version history

---

### User Story 7 - Drag-and-Drop Attachment Upload (Priority: P2)

A user can drag files from their computer directly into the editor area, which automatically uploads them as attachments and inserts appropriate markdown syntax.

**Why this priority**: Greatly improves UX but not essential for MVP. Upload button works as baseline.

**Independent Test**: Open editor, drag an image file from desktop onto the editor area, verify upload begins automatically, and confirm markdown syntax is inserted at the drop location.

**Acceptance Scenarios**:

1. **Given** a user is editing, **When** they drag a file over the editor, **Then** a drop zone highlight appears indicating valid drop target
2. **Given** a file is dropped on editor, **When** drop completes, **Then** file upload begins automatically with progress indicator
3. **Given** upload completes, **When** insertion occurs, **Then** markdown is inserted at the drop position (or cursor if drop location unavailable)
4. **Given** multiple files are dropped, **When** processed, **Then** all files upload in sequence with individual progress bars
5. **Given** invalid file type is dropped, **When** detected, **Then** error message shows "File type not supported" without attempting upload

---

### User Story 8 - Paste Image from Clipboard (Priority: P3)

A user can paste an image directly from clipboard (e.g., screenshot, copied image) into the editor, which uploads it as an attachment with auto-generated filename.

**Why this priority**: Convenient for screenshots but not essential. Users can save screenshot as file and upload.

**Independent Test**: Take a screenshot, press Ctrl+V in the editor, verify the image uploads automatically with name like "pasted-image-20260112.png", and confirm it displays inline.

**Acceptance Scenarios**:

1. **Given** an image is in clipboard, **When** user presses Ctrl+V in editor, **Then** the image is detected and upload begins
2. **Given** pasted image upload, **When** filename is generated, **Then** it uses pattern "pasted-image-[timestamp].png" for uniqueness
3. **Given** pasted image is uploaded, **When** markdown is inserted, **Then** syntax `![Pasted Image](attachment-id.png)` appears at cursor
4. **Given** clipboard contains text, **When** pasted, **Then** normal text paste occurs (no image upload attempted)
5. **Given** pasted image upload fails, **When** error occurs, **Then** user sees error message and clipboard content is not lost

---

### User Story 9 - Audio File Attachments with Inline Player (Priority: P3)

A user uploads audio files (MP3, WAV, OGG) as attachments, which are stored alongside the markdown file and displayed with an inline HTML5 audio player.

**Why this priority**: Audio support is nice for podcasts/recordings but not common in family wikis. Lower priority than images and documents.

**Independent Test**: Upload an audio file "recording.mp3", verify it's stored as an attachment, view the page, and confirm an inline audio player displays with play/pause controls.

**Acceptance Scenarios**:

1. **Given** an audio file is uploaded, **When** stored successfully, **Then** markdown with audio indicator is inserted
2. **Given** audio markdown in published page, **When** rendered, **Then** an HTML5 audio player displays inline with playback controls
3. **Given** audio player, **When** displayed, **Then** controls include play/pause, timeline, volume, and download option
4. **Given** multiple audio files on page, **When** one is playing, **Then** other players pause (optional behavior)
5. **Given** audio file, **When** referenced, **Then** duration and file size display in the attachment list

---

### User Story 10 - Image Resize and Dimension Control (Priority: P3)

A user can specify image dimensions in markdown to control display size, allowing thumbnails, full-width, or custom sizes for layout flexibility.

**Why this priority**: Useful for layout control but not essential. Default image display is sufficient for MVP.

**Independent Test**: Insert image, edit markdown to `![image](file.jpg){width=300}` or similar syntax, view page, and verify image displays at specified width.

**Acceptance Scenarios**:

1. **Given** image markdown, **When** dimensions are specified (e.g., `{width=300px}`), **Then** image renders at specified size
2. **Given** dimension syntax, **When** supported formats include, **Then** system accepts pixels (300px), percentages (50%), or presets (small, medium, large)
3. **Given** image with dimensions, **When** displayed on mobile, **Then** responsive behavior ensures image doesn't exceed screen width
4. **Given** dimension specification, **When** invalid syntax is used, **Then** image displays at default size and no error is shown
5. **Given** image dimensions, **When** maintaining aspect ratio, **Then** specifying width automatically scales height proportionally

---

### Edge Cases

- What happens when uploading a file exceeding size limit (e.g., 100MB)? Upload is rejected with error "File too large. Maximum size is 10MB for images, 50MB for documents."
- What happens when attachment filename contains special characters or spaces? Filename is sanitized (spaces to hyphens, special chars removed) while original name is stored in metadata.
- What happens when user deletes markdown reference but not the attachment file? Orphaned attachments remain in storage; optional cleanup job can detect and report them.
- What happens when storage plugin fails during attachment upload? Error is shown, upload is rolled back, user can retry or save draft and try later.
- What happens when two attachments have same filename? System appends unique suffix (e.g., "file-1.jpg", "file-2.jpg") to prevent collision.
- What happens when displaying unsupported image format (e.g., TIFF)? System shows download link instead of inline display, or attempts browser-compatible conversion.
- What happens when video/audio file format isn't supported by browser? Player shows "Format not supported" with download link as fallback.
- What happens when image URL is external (not attachment)? External images display normally via standard markdown; no attachment storage involved.
- What happens when page with large images loads slowly? Images lazy-load as user scrolls; placeholder or blur-up effect shows during load.
- What happens when attachment is moved with parent page? Storage plugin handles attachment relocation automatically, maintaining folder structure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support uploading attachments via storage plugin's `uploadAttachment()` method
- **FR-002**: Attachments MUST be stored in a folder structure alongside the page's markdown file (e.g., `page-guid/_attachments/`)
- **FR-003**: System MUST support image file formats: JPEG, PNG, GIF, SVG, WebP
- **FR-004**: System MUST support document file formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
- **FR-005**: System MUST support video file formats: MP4, WebM, OGG (P2 feature)
- **FR-006**: System MUST support audio file formats: MP3, WAV, OGG, M4A (P3 feature)
- **FR-007**: System MUST enforce file size limits: 10MB for images, 50MB for documents/video/audio
- **FR-008**: System MUST generate unique attachment IDs (GUIDs) to avoid filename collisions
- **FR-009**: System MUST store attachment metadata: original filename, content type, size, upload date, uploaded by user
- **FR-010**: System MUST insert markdown syntax for attachments: `![alt-text](attachment-id.ext)` for images, `[filename](attachment-id.ext)` for documents
- **FR-011**: System MUST display images inline within page content when markdown is rendered
- **FR-012**: System MUST display documents as styled download links with file icon, name, size, and type
- **FR-013**: System MUST display videos with inline HTML5 video player (P2 feature)
- **FR-014**: System MUST display audio with inline HTML5 audio player (P3 feature)
- **FR-015**: System MUST provide "Upload Attachment" button in editor toolbar
- **FR-016**: System MUST show upload progress indicator during attachment upload
- **FR-017**: System MUST support deleting attachments via storage plugin's `deleteAttachment()` method
- **FR-018**: System MUST provide "Manage Attachments" interface showing all page attachments
- **FR-019**: System MUST display attachments list at bottom of page showing all files with metadata
- **FR-020**: System MUST support drag-and-drop file upload into editor (P2 feature)
- **FR-021**: System MUST support pasting images from clipboard (P3 feature)
- **FR-022**: System MUST sanitize filenames to prevent security issues (path traversal, XSS)
- **FR-023**: System MUST validate file types based on content (not just extension) to prevent malicious uploads
- **FR-024**: System MUST generate attachment URLs that are served securely with proper content-type headers
- **FR-025**: System MUST support replacing existing attachments while preserving markdown references (P3 feature)

### Key Entities

- **Attachment**: Represents a file attached to a wiki page
  - Attributes: attachmentId (GUID), pageId (parent page GUID), originalFilename, sanitizedFilename, contentType, size (bytes), uploadedAt, uploadedBy, storagePath
  - Storage: File stored via storage plugin at `page-guid/_attachments/attachment-guid.ext`, metadata in sidecar JSON or DynamoDB
  - Relationships: Belongs to one page, uploaded by one user

- **AttachmentMetadata**: Stored alongside attachment file with additional details
  - Attributes: attachmentId, originalFilename, contentType, size, uploadedAt, uploadedBy, dimensions (for images), duration (for video/audio), checksum
  - Storage: JSON file at `attachment-guid.meta.json` or DynamoDB record
  - Relationships: One-to-one with attachment file

- **AttachmentReference**: Represents a reference to an attachment within page markdown
  - Attributes: pageId, attachmentId, markdownSyntax, position (line number or offset), referenceType (inline-image, download-link, video, audio)
  - Storage: Computed from markdown content on-demand
  - Relationships: Many references per page, many pages can reference same attachment (if shared)

- **AttachmentUpload**: Represents an in-progress attachment upload operation
  - Attributes: uploadId, pageId, filename, size, bytesUploaded, status (pending, uploading, completed, failed), startedAt
  - Storage: In-memory or temporary state during upload
  - Relationships: One upload per file, belongs to one page

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Attachment upload completes within 10 seconds for files up to 10MB on average connection
- **SC-002**: Image attachments display inline in page view within 2 seconds of page load
- **SC-003**: Upload progress indicator updates at least every 500ms during upload
- **SC-004**: File type validation rejects unsupported formats with clear error message 100% of the time
- **SC-005**: Filename sanitization prevents security vulnerabilities (path traversal, XSS) 100% of the time
- **SC-006**: Attachment deletion completes within 2 seconds and removes file from storage
- **SC-007**: Manage Attachments interface loads and displays all page attachments within 1 second
- **SC-008**: Drag-and-drop upload works correctly on modern browsers (Chrome, Firefox, Safari, Edge) (P2)
- **SC-009**: Clipboard paste image upload works on Windows (Ctrl+V) and Mac (Cmd+V) (P3)
- **SC-010**: Video player (P2) displays and plays MP4 files correctly on 95% of modern browsers
- **SC-011**: Audio player (P3) displays and plays MP3 files correctly on 95% of modern browsers
- **SC-012**: Image lazy-loading improves page load performance by at least 30% for pages with 10+ images
- **SC-013**: Attachment URLs are secure and include proper authentication tokens to prevent unauthorized access
- **SC-014**: Document download links trigger correct download/open behavior based on browser capabilities
- **SC-015**: Attachments list at page bottom displays all files with accurate metadata (name, size, type, date)

## Assumptions

- Storage plugin implements attachment storage using folder structure (e.g., S3: `page-guid/_attachments/`)
- Attachment files are stored alongside page markdown as specified in storage plugin design (Feature #2)
- CloudFront or CDN caching is configured for efficient attachment delivery
- Browser supports HTML5 video/audio players for media playback
- Image files are served with proper content-type headers for browser display
- Storage plugin handles attachment moves when page is moved in hierarchy
- File uploads use multipart/form-data or presigned URLs for efficient transfer
- Attachment IDs (GUIDs) are globally unique to prevent collisions
- Markdown parser supports standard image syntax `![alt](url)` and link syntax `[text](url)`
- Users have sufficient storage quota; quota enforcement is separate concern
- Attachment security requires authentication (all authenticated users can access all attachments)
- Orphaned attachments (no markdown reference) are acceptable; cleanup is optional maintenance task
- Clipboard API is available in modern browsers for paste functionality
- Drag-and-drop uses standard HTML5 drag-and-drop API

## Out of Scope

The following are explicitly **not** included in this specification:

- Image editing or manipulation (crop, resize, rotate, filters) within the application (future enhancement)
- Thumbnail generation for images (future performance optimization)
- Attachment versioning beyond storage plugin's capabilities (future enhancement)
- Attachment sharing or permissions independent of page (future enhancement)
- Bulk attachment operations (upload multiple, delete multiple) (future enhancement)
- Attachment search or filtering (separate search feature)
- Attachment tags or categorization (future organization feature)
- OCR or text extraction from documents (future enhancement)
- Preview generation for documents (PDF first page, etc.) (future enhancement)
- Video transcoding to multiple formats (future optimization)
- Audio transcription or captions (future accessibility feature)
- Attachment compression or optimization on upload (future optimization)
- External storage integration (Google Drive, Dropbox) (future integration)
- Collaborative attachment annotation (future collaboration feature)
- Attachment download analytics (future metrics feature)

## Constitutional Compliance

This feature aligns with the BlueFinWiki Constitution:

- **Markdown File Format (Non-Negotiable #5)**: Attachments referenced via standard markdown syntax
- **Storage Plugin Architecture (Non-Negotiable #2)**: Uses storage plugin's `uploadAttachment()`, `deleteAttachment()` methods
- **Content-First Architecture (Principle II)**: Attachments stored alongside content, portable with standard folder structure
- **Rich Media Support (Principle IV)**: Images, videos, documents as attachments fulfill family-friendly requirement
- **Simplicity (Principle III)**: Straightforward upload and display without complex features
- **Cost-Effectiveness (Principle III)**: Uses existing storage plugin infrastructure, efficient S3 storage
- **Family-Friendly (Principle IV)**: Visual display of images/videos makes content accessible and engaging

## Technical Notes

### Attachment Storage Structure (S3 Example)

```
s3://wiki-bucket/
├── abc123.md                      # Page markdown
├── abc123/                        # Page folder (GUID)
│   └── _attachments/              # Attachments subfolder
│       ├── def456.jpg             # Image attachment (GUID filename)
│       ├── def456.meta.json       # Image metadata
│       ├── ghi789.pdf             # Document attachment
│       └── ghi789.meta.json       # Document metadata
```

### Attachment Metadata Example

```json
{
  "attachmentId": "def456-1234-5678-90ab",
  "originalFilename": "family-photo.jpg",
  "contentType": "image/jpeg",
  "size": 2457600,
  "uploadedAt": "2026-01-12T15:30:00Z",
  "uploadedBy": "user-abc123",
  "dimensions": {
    "width": 1920,
    "height": 1080
  },
  "checksum": "sha256:abcdef123456..."
}
```

### Markdown Attachment Syntax

```markdown
<!-- Image attachment (displays inline) -->
![Family Photo](def456.jpg)

<!-- Image with alt text -->
![The whole family at the beach](def456.jpg)

<!-- Document attachment (download link) -->
[Project Plan PDF](ghi789.pdf)

<!-- Video attachment (P2 - inline player) -->
![video](jkl012.mp4)

<!-- Audio attachment (P3 - inline player) -->
[Recording](mno345.mp3)

<!-- Image with dimensions (P3) -->
![Thumbnail](def456.jpg){width=300px}
```

### Rendered HTML Examples

```html
<!-- Image -->
<img src="/attachments/abc123/def456.jpg" alt="Family Photo" />

<!-- Document Link -->
<a href="/attachments/abc123/ghi789.pdf" class="attachment-link" download>
  <span class="file-icon">📄</span>
  <span class="file-name">Project Plan PDF</span>
  <span class="file-size">(2.3 MB)</span>
</a>

<!-- Video Player (P2) -->
<video controls width="100%">
  <source src="/attachments/abc123/jkl012.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

<!-- Audio Player (P3) -->
<audio controls>
  <source src="/attachments/abc123/mno345.mp3" type="audio/mpeg">
  Your browser does not support the audio tag.
</audio>
```

### Upload Progress Implementation

```typescript
async function uploadAttachment(file: File, pageId: string) {
  const attachmentId = generateGUID();
  const sanitizedFilename = sanitizeFilename(file.name);
  
  // Create metadata
  const metadata = {
    originalFilename: file.name,
    contentType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: currentUser.id
  };
  
  // Upload with progress
  const result = await storagePlugin.uploadAttachment(
    pageId,
    file,
    {
      onProgress: (percent) => updateProgressBar(percent)
    }
  );
  
  // Insert markdown
  const markdown = file.type.startsWith('image/')
    ? `![${file.name}](${result.attachmentId}.${getExtension(file.name)})`
    : `[${file.name}](${result.attachmentId}.${getExtension(file.name)})`;
  
  insertMarkdownAtCursor(markdown);
}
```
