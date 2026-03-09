# Clarification Questions: Page Attachments

**Feature**: Page Attachments with Visual Display  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Attachment Storage Path Consistency
**Question**: Are attachments stored using the same structure across all storage plugins?

**ANSWERED**: Attachments stored in same folder as page using original filename

**Implementation**:
- Attachments stored alongside the markdown file in the same directory
- Uses original filename (not renamed to GUID)
- Example: If page is at `folder/page.md`, attachment is at `folder/image.jpg`
- Same structure across all storage plugins (S3, GitHub, etc.)
- Root level pages: attachments at root level too
- No separate `_attachments` subdirectory

---

### 2. Attachment GUID vs Filename
**Question**: Are attachments always renamed to GUIDs, or can they keep original filenames?

**ANSWERED**: Attachments keep original filename

**Implementation**:
- Files stored with their original filename (sanitized for safety)
- No GUID renaming - filenames are used as identifiers
- Filenames sanitized to remove unsafe characters (spaces → underscores, remove special chars)
- Users can easily identify files in file manager and URLs
- Duplicate filenames in same folder automatically handled by overwriting (user should be warned)
- Easier debugging: URLs like `/pages/{pageGuid}/attachments/report.pdf` instead of `/pages/{pageGuid}/attachments/{guid}`

**Benefits**:
- Duplicate detection: Same filename = same file, easy to detect
- Debugging: Human-readable URLs and storage paths
- User-friendly: Clear what each attachment is without looking up metadata

---

### 3. Attachment Metadata File Format
**Question**: What is the exact schema for attachment metadata files?

**Current spec mentions**: "Sidecar file stores original filename, upload date, content type"

**Needs complete schema**:
```json
{
  "id": "attachment-guid-123",
  "pageId": "page-guid-456",
  "originalFilename": "family-photo.jpg",
  "contentType": "image/jpeg",
  "size": 2453876,
  "uploadedAt": "2026-01-13T10:30:00Z",
  "uploadedBy": "user-guid-789",
  "description": "Optional caption",
  "dimensions": { "width": 1920, "height": 1080 }  // For images?
}
```
- Is this correct and complete? yes

---

### 4. Markdown Reference Format
**Question**: How are attachments referenced in markdown content?

**ANSWERED**: Relative references using original filename

**Implementation**:
- Images: `![family-photo.jpg](family-photo.jpg)`
- Documents: `[Document](document.pdf)`
- Attachments stored alongside page in same folder: `folder/page.md` and `folder/family-photo.jpg`
- Markdown renderer resolves relative paths to attachment URLs
- When page is rendered, attachment URLs generated dynamically
- No need to update markdown when page moves (relative references maintain)
- Simple filename-based references, no complex path resolution needed

---

### 5. Attachment URL Generation
**Question**: How are attachment URLs generated for browser access?

**ANSWERED**: URLs generated using page context

**Implementation**:
- When rendering page at `/pages/{short-code}/Page Title`
- Attachment URLs: `/pages/{short-code}/attachments/{filename}`
- Backend resolves page context to storage folder location
- Retrieves attachment from same folder as page: `folder/filename.jpg`
- Can use CloudFront for CDN distribution
- Presigned URLs for attachments (authenticated access only)
- Auth check before serving attachment (verify user is logged in)
- Simple lookup: find page's folder, retrieve file by original filename

---

## 🟡 High Priority - Important for User Experience

### 6. File Type Restrictions
**Question**: What file types are allowed for upload?

**Current spec mentions**: "Common file types" but not specific

**Needs complete whitelist**:
- Images: jpg, jpeg, png, gif, svg, webp, bmp?
- Documents: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, rtf?
- Archives: zip, tar, gz, 7z?
- Videos: mp4, webm, mov, avi?
- Audio: mp3, wav, ogg?
- Code: json, xml, csv?
- Blacklist any types? (exe, bat, sh for security?)

---

### 7. File Size Limits Per Type
**Question**: What are the size limits for each attachment type? unlimited for MVP

**Current spec says**: "10MB" for images

**Needs complete definition**:
- Images: 10 MB
- Documents: 25 MB?
- Videos: 100 MB? 500 MB?
- Archives: 50 MB?
- Should limit be configurable per deployment?
- Total size limit per page?

---

### 8. Image Display Size Options
**Question**: Can users control how images are displayed inline?

**Current spec says**: "Displays inline at full width or specified dimensions"

**Needs clarification**:
- How are dimensions specified? `![img](url)` or `![img](url){width=500px}`? yes
- Should there be UI for setting image size (small/medium/large/full)? user can resize image by dragging border
- Responsive images for different screen sizes? yes
- Can images be aligned (left, center, right)? yes
- Clickable to view full size? yes

---

### 9. Video Player Features
**Question**: What features should the video player have?

**Current spec mentions**: "HTML5 video player with standard controls"

**Needs clarification**:
- Controls: play/pause, volume, fullscreen - what else? yes
- Playback speed control? yes
- Captions/subtitles support? yes if the source supports it
- Picture-in-picture? no
- Autoplay (probably not for UX)? no
- Should videos be hosted or just embedded (YouTube, Vimeo)? if it is a link do not host it

---

### 10. Attachment List Display Format
**Question**: What exactly is shown in the attachments list at page bottom?

**Current spec says**: "File icon, name, type, size, upload date"

**Needs clarification**:
- File icon - generic or type-specific (PDF icon, Word icon)? type-specific
- Name - original filename or display name? original filename
- Type - extension or MIME type ("PDF" vs "application/pdf")?no
- Size - MB, KB, or auto-format (e.g., "2.3 MB", "450 KB")? size
- Upload date - relative ("2 days ago") or absolute ("Jan 13, 2026")?no
- Who uploaded?no

---

### 11. Duplicate Attachment Handling
**Question**: What happens when uploading file with name that already exists?

**CRITICAL**: Since attachments use original filename in same folder

**Needs clarification**:
- Must check if filename already exists in page's folder
- Should prompt: "family-photo.jpg already exists. Replace, Rename, or Cancel"? yes
- Auto-rename option: family-photo-1.jpg, family-photo-2.jpg? no
- Or require user to rename manually? yes
- Cannot silently overwrite (data loss risk) no
- Markdown references won't break if replacing same filename

---

### 12. Attachment Deletion Confirmation
**Question**: What is the confirmation flow for deleting attachments?

**Current spec says**: "Confirmation prompt asks 'Delete filename.jpg? This cannot be undone.'"

**Needs clarification**:
- Simple OK/Cancel dialog? yes
- Should it show preview of attachment being deleted?
- Warning if attachment is still referenced in markdown?
- Checkbox "Also remove references from page content"?
- Different confirmation for in-use vs unused attachments?

---

### 13. Missing Attachment Display
**Question**: How are missing/broken attachments displayed?

**Current spec mentions**: "Placeholder shows 'Image not found'" or "⚠️ Missing attachment"

**Needs clarification**:
- Should it show original filename in placeholder? yes
- "Image not found: family-photo.jpg"? yes
- Different placeholder for images vs documents? no
- Should editor highlight broken attachment references? yes
- Can user re-upload or remove broken reference? user shoul dbe able to remove, maybe just be deleting the text

---

### 14. Drag and Drop Multiple Files
**Question**: Can users drag multiple files at once? not for MVP

**Current spec says**: "Multiple files are dropped, when processed, then all files upload in sequence"

**Needs clarification**:
- Is there a limit to number of simultaneous uploads?
- Should they queue or upload in parallel (e.g., 3 at a time)?
- Overall progress indicator or per-file?
- Can user cancel individual uploads or entire batch?

---

### 15. Paste from Clipboard Behavior
**Question**: What happens when clipboard contains different content types?

**Current spec says**: "Image is in clipboard, when user presses Ctrl+V, then image is detected"

**Needs clarification**:
- What if clipboard has both text and image (rich content)? preferenc to rich content
- What if clipboard has HTML with embedded image? are we supporting html in the ,markdown file
- What if clipboard has file reference (copied from file explorer)? import file and add to the page
- Priority/fallback behavior?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Attachment Versioning
**Question**: Can attachments be versioned like pages? no

**Not explicitly covered in spec**:
- If user uploads new version of diagram.png, keep old version? no
- Access to previous versions? no
- Or replacement is permanent? permanent

---

### 17. Attachment Search
**Question**: Can users search within attachments? not for MVP

**Not explicitly covered in spec**:
- Search by filename?
- Search within PDF content?
- Search by upload date or uploader?
- Is this part of global wiki search?

---

### 18. Attachment Permissions
**Question**: Do attachments inherit page permissions?

**CLARIFIED**: No individual page permissions exist. All attachments are accessible to all authenticated users.

**Implementation**:
- All authenticated users can view and download all attachments
- Authentication check required (must be logged in)
- No granular access controls per page or attachment
- Direct attachment URLs require valid user session

---

### 19. Attachment Thumbnails
**Question**: Should images have thumbnail previews?

**Not explicitly covered in spec**:
- Generate thumbnails on upload? yes
- Different sizes (small, medium) for different contexts? no
- Storage cost consideration? not for MVP
- Performance for pages with many images? not for MVP

---

### 20. Lazy Loading for Attachments
**Question**: Are images and videos lazy-loaded?

**Current spec mentions**: "Video is lazy-loaded to prevent blocking page render"

**Needs clarification**:
- Lazy loading for all images or just below-the-fold? all images
- Native browser lazy loading or custom implementation? native
- What about PDFs - lazy load or immediate? lazy

---

### 21. Attachment Copy/Move
**Question**: Can attachments be moved to different pages? no

**Not explicitly covered in spec**:
- Copy attachment to another page? no
- Move attachment between pages? no
- Affects storage structure?

---

### 22. Attachment Metadata Editing
**Question**: Can users edit attachment metadata after upload? no

**Not explicitly covered in spec**:
- Change description/caption?
- Change display name?
- Add tags to attachments?
- Where is this UI?

---

### 23. Batch Attachment Operations
**Question**: Can users select multiple attachments for batch operations? no

**Not explicitly covered in spec**:
- Select multiple → Delete all?
- Select multiple → Download as ZIP?
- Select multiple → Move to another page?

---

### 24. Attachment Upload Progress Cancellation
**Question**: Can users cancel uploads in progress? not for MVP

**Current spec mentions**: "Progress indicator" but not cancellation

**Needs clarification**:
- Cancel button during upload?
- What happens to partial upload (cleanup)?
- Can user retry failed upload?

---

### 25. External Attachment Links
**Question**: Can users link to external files instead of uploading?

**Not explicitly covered in spec**:
- Link to Dropbox, Google Drive, OneDrive files?
- Display preview like native attachments?
- Or just regular link? treat them as a normal link

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially attachment storage structure and markdown reference format
2. **Align with S3 storage plugin spec** - ensure consistent understanding of attachment structure
3. **Create complete file type whitelist/blacklist** - security and usability
4. **Design attachment management UI** - mockups for upload, list, and management dialogs

Would you like me to:
- Create a detailed attachment storage specification aligned with S3 plugin?
- Design the attachment management UI mockups?
- Create a comprehensive file type and size limit matrix?
