# 9. Export Functionality

## Overview
Users need the ability to export wiki content for offline viewing, archival, sharing, and printing purposes. This feature allows exporting individual pages to PDF or exporting entire wiki sections/wikis to static HTML or PDF formats.

## Cross-References

**Depends on:**
- [9-page-history.md](9-page-history.md) - US-9.5 exports pages with version history
- [6-page-attachments.md](6-page-attachments.md) - Exports include attached images and files
- [3-folder-management.md](3-folder-management.md) - Section exports based on folder hierarchy
- [11-page-permissions.md](11-page-permissions.md) - Exports respect user permissions; only exports accessible pages
- [16-page-metadata.md](16-page-metadata.md) - PDF exports include page metadata (tags, status, author)

**Related:**
- [2-s3-storage-plugin.md](2-s3-storage-plugin.md) - Temporary export files stored in S3 with expiration

## User Stories

### US-9.1: Export Single Page to PDF (P2)
**As a** wiki user  
**I want to** export a single wiki page to PDF  
**So that** I can save it for offline reading, print it, or share it with others outside the wiki

**Acceptance Criteria:**
- User can click an "Export to PDF" button/menu option while viewing any page
- PDF export includes:
  - Page title
  - Page content with proper formatting (headings, lists, bold, italic, code blocks, tables)
  - Embedded images (from S3 attachments)
  - Page metadata (author, last modified date, wiki name)
  - Proper page breaks and layout
  - Table of contents for longer pages (optional, configurable)
- PDF maintains readable formatting with:
  - Appropriate fonts and sizing
  - Proper margins
  - Page numbers (footer)
  - Wiki name/logo in header (optional)
- Links within the PDF:
  - Internal wiki links are preserved as blue text with notation (e.g., "See: PageName")
  - External links are clickable hyperlinks in the PDF
- Export preserves syntax-highlighted code blocks
- User receives download of PDF file named `{page-title}-{date}.pdf`
- Export respects user's page view permissions (only exports if user can view)
- Loading indicator shown during PDF generation
- Error handling for failed exports with user-friendly messages

**Technical Notes:**
- Use library like Puppeteer, WeasyPrint, or similar for PDF generation
- Consider server-side rendering to ensure consistent output
- PDF generation should be asynchronous for large pages
- Store temporary PDFs in S3 with short expiration (24 hours)
- Consider page size limits (warn if page is extremely large)

**Constitutional Alignment:**
- **Simplicity Over Complexity**: Single-click export with sensible defaults
- **User-Centric Design**: Export includes metadata and maintains readability
- **Minimalist Philosophy**: Clean PDF output without clutter

**Priority:** P2 - High value for archival and sharing but not critical for MVP

---

### US-9.2: Export Section to Static HTML (P2)
**As a** wiki administrator  
**I want to** export a folder/section of the wiki to static HTML  
**So that** I can create an offline backup, share a self-contained archive, or publish a portion of the wiki

**Acceptance Criteria:**
- Admin can select "Export to HTML" from a folder's context menu
- Export configuration modal allows:
  - Selection of folder depth (this folder only, or include subfolders)
  - Option to include/exclude attachments
  - Option to include navigation menu
  - Theme selection (light/dark)
- Generated HTML package includes:
  - All pages as individual HTML files
  - Index.html as the starting point
  - Navigation menu (sidebar or top nav)
  - All images and attachments (embedded or linked)
  - CSS for styling (embedded or linked)
  - Inter-page links work correctly (relative paths)
  - Search functionality (optional, client-side JavaScript search)
- HTML export structure:
  ```
  export-{folder-name}-{date}/
    ├── index.html (folder home or wiki home)
    ├── pages/
    │   ├── page1.html
    │   ├── page2.html
    │   └── subfolder/
    │       └── page3.html
    ├── assets/
    │   ├── images/
    │   ├── attachments/
    │   └── css/
    └── search.js (optional)
  ```
- Export package is zipped for download
- Export respects user permissions (only exports pages user can view)
- Progress indicator for large exports
- Estimated size shown before export begins
- Maximum export size limits enforced (configurable, default 500MB)

**Technical Notes:**
- Generate static HTML server-side
- Use relative paths for all links to ensure portability
- Consider including offline-capable search (lunr.js or similar)
- Stream large exports rather than loading entirely in memory
- Store temporary exports in S3 with short expiration (24 hours)
- Consider incremental export capability for large wikis

**Constitutional Alignment:**
- **Open Standards**: HTML export uses standard web technologies
- **Data Ownership**: Users can fully own and control their exported content
- **Offline-First Thinking**: Static HTML works without server connection

**Priority:** P2 - Important for backup and archival, but complex to implement

---

### US-9.3: Export Entire Wiki to Static HTML (P3)
**As a** wiki administrator  
**I want to** export the entire wiki to static HTML  
**So that** I can create a complete backup or migrate to another platform

**Acceptance Criteria:**
- All criteria from US-9.2 apply
- Additional considerations:
  - Export includes all folders and pages in hierarchical structure
  - Top-level navigation includes all wiki sections
  - Home page becomes index.html
  - User management pages and admin interfaces are excluded
  - Export includes a manifest.json with metadata:
    - Export date and time
    - Wiki name and description
    - Total pages, folders, attachments
    - User list (names only, no sensitive data)
    - Version of export format
- Size warning for large wikis (e.g., "This export will be approximately 2.3 GB")
- Option to exclude large attachments (with size threshold selection)
- Export is processed as background job with email notification on completion
- Admin can view export history and re-download recent exports (7-day retention)

**Technical Notes:**
- Must be implemented as async background job (Lambda/Step Functions)
- Consider multi-part archive for very large wikis (split into multiple zip files)
- Include README.txt with instructions for viewing the export
- Consider adding a simple HTTP server script for local viewing

**Constitutional Alignment:**
- **Data Ownership**: Complete data export ensures no vendor lock-in
- **Transparency**: Manifest provides clear documentation of exported content
- **Reliability**: Background processing ensures stability for large exports

**Priority:** P3 - Nice to have for complete backup, but high complexity

---

### US-9.4: Export Section/Wiki to PDF (P3)
**As a** wiki user or administrator  
**I want to** export a folder or entire wiki to a single PDF document  
**So that** I can create a printable/shareable document of related content

**Acceptance Criteria:**
- Similar to HTML export but generates single PDF or multiple PDFs
- Configuration options:
  - Single large PDF vs. one PDF per page (bundled in zip)
  - Include table of contents with page numbers and hyperlinks
  - Page numbering format (global or per-section)
  - Header/footer customization
  - Page size (A4, Letter, etc.)
- Single PDF export includes:
  - Cover page with wiki/section name, date, author
  - Table of contents with clickable links
  - All pages in hierarchical order
  - Section dividers between folders
  - Appendix with list of attachments (if not embedded)
- Maximum size limits (e.g., 10,000 pages or 200MB)
- Progress indicator with page count
- Warning for very large exports (may take several minutes)

**Technical Notes:**
- Significantly more complex than single-page PDF
- May require commercial PDF library for advanced features
- Consider memory and processing constraints
- Background job processing recommended for large exports
- Store in S3 with notification when ready

**Constitutional Alignment:**
- **Simplicity Over Complexity**: Provide sensible defaults for complex operation
- **User-Centric Design**: Progress indicators and clear expectations
- **Performance First**: Async processing for large operations

**Priority:** P3 - Lower priority due to complexity and niche use case

---

### US-9.5: Export with Version History (P3)
**As a** wiki administrator  
**I want to** export pages including their version history  
**So that** I can preserve the complete history for archival or migration purposes

**Acceptance Criteria:**
- Export format includes version metadata for each page
- For HTML export:
  - Each page has a "History" section at bottom
  - Shows list of versions with date, author, and summary
  - Option to include diff view between versions
- For JSON/data export:
  - Structured format with all version data
  - Includes version content, metadata, and diffs
- Export configuration allows:
  - Include/exclude version history
  - Date range filtering (only versions from X to Y)
  - Maximum versions per page (if limiting size)

**Technical Notes:**
- Significantly increases export size
- Consider compression for version data
- JSON format may be more appropriate than HTML for version history
- Could be separate export type: "Data Export with History"

**Constitutional Alignment:**
- **Data Ownership**: Complete data export including history
- **Transparency**: Full audit trail preserved
- **Version Control**: Aligns with constitution's emphasis on version history

**Priority:** P3 - Valuable for complete backups but complex and large

---

## UI/UX Design

### Export Button Placement
- **Single Page Export**: 
  - "Export" button in page header toolbar (next to Edit)
  - Dropdown with options: "Export to PDF", "Export to HTML"
  - Keyboard shortcut: `Ctrl+Shift+E` or `Cmd+Shift+E`

- **Section/Wiki Export**:
  - Folder context menu: "Export Section..."
  - Admin menu: "Export Wiki..."
  - Opens export configuration modal

### Export Configuration Modal
```
┌─────────────────────────────────────────────┐
│  Export Wiki Section                    [X] │
├─────────────────────────────────────────────┤
│                                             │
│  Export Format: ○ PDF  ● HTML              │
│                                             │
│  Scope:                                     │
│    ☑ Include subfolders                    │
│    ☑ Include attachments                   │
│                                             │
│  Options:                                   │
│    ☑ Include navigation menu               │
│    ☐ Include version history               │
│    ☐ Include search functionality          │
│                                             │
│  Theme:  [Light ▼]                         │
│                                             │
│  Estimated Size: ~45 MB                    │
│  Estimated Time: 2-3 minutes               │
│                                             │
│           [Cancel]  [Start Export]         │
└─────────────────────────────────────────────┘
```

### Export Progress
```
┌─────────────────────────────────────────────┐
│  Exporting Section: "Family Recipes"       │
├─────────────────────────────────────────────┤
│                                             │
│  Progress: [████████████░░░░░░] 65%        │
│                                             │
│  Processing page 23 of 35...               │
│  "Grandma's Apple Pie"                     │
│                                             │
│  Elapsed: 1:23  |  Remaining: ~0:48        │
│                                             │
│              [Cancel Export]                │
└─────────────────────────────────────────────┘
```

### Export Complete Notification
```
┌─────────────────────────────────────────────┐
│  ✓ Export Complete                          │
├─────────────────────────────────────────────┤
│                                             │
│  Your export "Family Recipes" is ready!    │
│                                             │
│  Size: 47.3 MB                             │
│  Pages: 35                                  │
│  Time: 2:01                                 │
│                                             │
│           [Download]  [Dismiss]            │
└─────────────────────────────────────────────┘
```

---

## Technical Implementation

### Architecture

#### PDF Generation
```
User Request → Lambda Function → Puppeteer/Chrome Headless
                                        ↓
                              Render HTML to PDF
                                        ↓
                              Upload to S3 (temp bucket)
                                        ↓
                              Return signed URL (24hr expiration)
```

#### HTML Export
```
User Request → Step Function Workflow
                    ↓
              1. Validate permissions
                    ↓
              2. Query all pages in scope
                    ↓
              3. For each page:
                 - Convert markdown to HTML
                 - Download attachments from S3
                 - Rewrite internal links
                    ↓
              4. Generate navigation structure
                    ↓
              5. Create zip archive
                    ↓
              6. Upload to S3 (temp bucket)
                    ↓
              7. Notify user (email/in-app)
```

### Data Model

#### Export Job
```json
{
  "exportId": "exp_abc123",
  "userId": "user_123",
  "wikiId": "wiki_abc",
  "exportType": "html|pdf",
  "scope": "page|section|wiki",
  "scopeId": "page_xyz|folder_xyz|wiki_xyz",
  "status": "pending|processing|completed|failed",
  "createdAt": "2026-01-12T10:30:00Z",
  "completedAt": "2026-01-12T10:32:15Z",
  "config": {
    "includeSubfolders": true,
    "includeAttachments": true,
    "includeNavigation": true,
    "includeVersionHistory": false,
    "theme": "light",
    "format": "zip"
  },
  "result": {
    "fileUrl": "https://s3.../export_abc123.zip",
    "expiresAt": "2026-01-19T10:32:15Z",
    "fileSize": 49612800,
    "pageCount": 35,
    "error": null
  }
}
```

### API Endpoints

#### POST /api/exports/page/{pageId}
Export single page to PDF or HTML
```json
{
  "format": "pdf|html",
  "options": {
    "includeAttachments": true,
    "theme": "light"
  }
}
```

**Response:**
```json
{
  "exportId": "exp_abc123",
  "status": "processing",
  "estimatedTime": 15
}
```

#### POST /api/exports/section/{folderId}
Export section to HTML or PDF
```json
{
  "format": "html|pdf",
  "includeSubfolders": true,
  "includeAttachments": true,
  "includeNavigation": true,
  "includeVersionHistory": false,
  "theme": "light"
}
```

**Response:**
```json
{
  "exportId": "exp_def456",
  "status": "pending",
  "estimatedTime": 120,
  "estimatedSize": 47185920
}
```

#### POST /api/exports/wiki/{wikiId}
Export entire wiki

#### GET /api/exports/{exportId}
Get export job status and download URL

**Response:**
```json
{
  "exportId": "exp_abc123",
  "status": "completed",
  "downloadUrl": "https://s3.amazonaws.com/...",
  "expiresAt": "2026-01-19T10:32:15Z",
  "fileSize": 49612800,
  "pageCount": 35,
  "duration": 135
}
```

#### GET /api/exports/history
List user's recent exports (last 7 days)

#### DELETE /api/exports/{exportId}
Delete export file from S3

---

## Edge Cases & Error Handling

### Error Scenarios

1. **Export Too Large**
   - **Trigger**: Estimated size exceeds configured limit (default 500MB)
   - **Handling**: Show error with size estimate and suggestion to export smaller sections
   - **Message**: "This export would be approximately 750 MB, which exceeds the 500 MB limit. Please try exporting smaller sections or exclude attachments."

2. **Permission Denied During Export**
   - **Trigger**: User loses access to pages mid-export
   - **Handling**: Skip inaccessible pages, note in export summary
   - **Message**: "Export completed with warnings: 3 pages were skipped due to insufficient permissions."

3. **Missing Attachments**
   - **Trigger**: Page references attachment that's been deleted from S3
   - **Handling**: Include placeholder image/link with note
   - **Message**: "Some attachments could not be included (missing or deleted)."

4. **Timeout During PDF Generation**
   - **Trigger**: Page too complex or server overloaded
   - **Handling**: Retry with simplified rendering, then fail gracefully
   - **Message**: "PDF generation timed out. Please try exporting to HTML or contact support."

5. **Export Job Failed**
   - **Trigger**: Server error, out of memory, S3 upload failure
   - **Handling**: Mark job as failed, notify user, log error for debugging
   - **Message**: "Export failed due to a server error. Please try again or contact support if the problem persists."

6. **Concurrent Exports**
   - **Trigger**: User starts multiple large exports simultaneously
   - **Handling**: Queue exports, limit to 2 concurrent per user
   - **Message**: "You have 2 exports in progress. This export will start when one completes."

7. **Download Link Expired**
   - **Trigger**: User tries to download after 7-day expiration
   - **Handling**: Offer to regenerate export
   - **Message**: "This export has expired. Would you like to generate a new export?"

### Resource Limits

- **Maximum single page size**: 50 MB
- **Maximum export size**: 500 MB (configurable per wiki)
- **Maximum pages in single export**: 1,000 pages
- **Maximum concurrent exports per user**: 2
- **Export retention period**: 7 days
- **PDF timeout**: 60 seconds per page
- **HTML export timeout**: 5 minutes per 100 pages

---

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading for Large Exports**
   - Stream content rather than loading everything in memory
   - Process pages in batches of 50

2. **Caching**
   - Cache rendered HTML for pages
   - Cache images and attachments already downloaded from S3
   - Use ETag/If-Modified-Since for unchanged pages

3. **Parallel Processing**
   - Process multiple pages concurrently (up to 10 parallel)
   - Download attachments in parallel

4. **Compression**
   - Use gzip compression for HTML exports
   - Optimize images (resize large images)
   - Minify CSS/JS in HTML exports

5. **Background Jobs**
   - All exports over 50 pages should be background jobs
   - Use Step Functions for orchestration
   - Send notification when complete

### Performance Targets

- **Single page PDF**: < 5 seconds
- **10-page section HTML**: < 15 seconds
- **100-page section HTML**: < 2 minutes
- **500-page wiki HTML**: < 10 minutes
- **Download speed**: Full bandwidth utilization (S3 signed URLs)

---

## Security & Privacy

### Security Considerations

1. **Permission Enforcement**
   - Verify user permissions before starting export
   - Recheck permissions for each page during export
   - Never export pages user cannot normally view

2. **Sensitive Data**
   - Exclude user passwords, API keys, internal IDs from exports
   - Sanitize metadata (e.g., internal file paths)
   - Option to exclude specific pages/sections (admin only)

3. **Download Links**
   - Use signed S3 URLs with short expiration (24 hours for downloads)
   - One-time use tokens optional for high-security wikis
   - Log all downloads for audit trail

4. **Rate Limiting**
   - Limit exports per user per day (e.g., 10 exports/day)
   - Prevent abuse and resource exhaustion
   - Admin override available

5. **Data Residency**
   - Store temporary exports in same S3 region as wiki data
   - Respect data locality requirements

---

## Testing Scenarios

### Test Cases

#### TC-9.1: Single Page PDF Export (Happy Path)
1. User navigates to a standard wiki page (5 paragraphs, 2 images, 1 code block)
2. Clicks "Export" → "Export to PDF"
3. PDF downloads within 5 seconds
4. PDF contains all content with proper formatting
5. Images are embedded correctly
6. Code block has syntax highlighting
7. Page metadata included in header/footer

#### TC-9.2: Large Page PDF Export
1. User exports page with 50+ images and 10,000 words
2. Progress indicator shown
3. Export completes within 60 seconds
4. PDF file size is reasonable (< 50 MB)
5. All images properly embedded

#### TC-9.3: Section HTML Export with Subfolders
1. Admin selects folder with 3 levels of subfolders (25 pages total)
2. Configures export: Include subfolders, Include attachments, Light theme
3. Export processes in background
4. Notification received when complete
5. Download zip file
6. Extract and verify structure:
   - All pages present
   - Navigation works
   - Internal links work
   - Images display correctly
7. Open in browser offline - all functionality works

#### TC-9.4: Permission Denied During Export
1. User starts export of section (15 pages)
2. Admin changes user role to restrict access to 3 pages mid-export
3. Export completes with warning
4. Export contains 12 pages (3 skipped)
5. Summary shows which pages were skipped

#### TC-9.5: Export Link Expiration
1. User exports page, receives download link
2. Wait 8 days (past 7-day expiration)
3. Try to download - receives expiration message
4. Clicks "Regenerate Export"
5. New export created, download succeeds

#### TC-9.6: Concurrent Export Limit
1. User starts 2 large exports (both in progress)
2. User attempts to start 3rd export
3. Receives message about queue
4. When one export completes, 3rd export starts automatically

#### TC-9.7: Export with Missing Attachments
1. Create page with 3 images
2. Delete 1 image from S3 directly (simulate corruption)
3. Export page to PDF
4. PDF generates successfully
5. Missing image shows placeholder with note
6. User receives warning about missing attachment

---

## Future Enhancements

### Phase 2 Considerations

1. **Scheduled Exports**
   - Automatically export wiki weekly/monthly for backup
   - Email export to admin or store in designated S3 bucket

2. **Incremental Exports**
   - Export only pages changed since last export
   - Useful for large wikis with frequent backups

3. **Custom Templates**
   - User-defined PDF templates (headers, footers, styling)
   - Branded exports with logo and custom colors

4. **Export API for Integrations**
   - Public API for third-party tools to trigger exports
   - Webhooks to notify external systems when export completes

5. **Export to Other Formats**
   - Markdown files (one per page)
   - Confluence format
   - Notion format
   - DocBook XML

6. **Collaborative Export**
   - Multiple users can contribute to a "curated" export
   - Select specific pages across wiki for themed export (e.g., "Holiday Recipes" from various folders)

7. **Print Optimization**
   - Print-specific PDF generation with better page breaks
   - Option to remove navigation elements for cleaner print

8. **Export Analytics**
   - Track which pages/sections are exported most
   - Identify popular content for promotion

---

## Dependencies

### External Libraries
- **PDF Generation**: Puppeteer, Headless Chrome, or WeasyPrint
- **HTML Processing**: Cheerio or jsdom for link rewriting
- **Archive Creation**: archiver.js or JSZip
- **Image Processing**: Sharp for image optimization

### AWS Services
- **Lambda**: PDF generation, HTML processing
- **Step Functions**: Orchestrate multi-page exports
- **S3**: Temporary storage for export files
- **SES**: Email notifications for completed exports
- **CloudWatch**: Logging and monitoring

### Internal Dependencies
- Page rendering engine (markdown to HTML)
- Permission system (verify access)
- S3 plugin (download attachments)
- User notification system

---

## Success Metrics

### Key Performance Indicators

1. **Export Success Rate**: > 98% of exports complete successfully
2. **Average Export Time**:
   - Single page: < 5 seconds
   - Section (10-50 pages): < 30 seconds
   - Large wiki (500+ pages): < 10 minutes
3. **User Satisfaction**: > 4.5/5 rating for export quality
4. **Export Usage**: Track how often exports are used (target: 10% of active users per month)
5. **Error Rate**: < 2% of exports fail due to technical issues
6. **Download Rate**: > 95% of completed exports are downloaded

### Monitoring

- Dashboard showing:
  - Export queue length
  - Average export time by size
  - Failed exports with reasons
  - S3 storage used by temporary exports
  - Most exported pages/sections

---

## Constitutional Alignment

This feature aligns with BlueFinWiki Constitution principles:

### Core Principles
- ✅ **Data Ownership**: Users can fully export their content, ensuring no vendor lock-in
- ✅ **Open Standards**: HTML and PDF are open, widely-supported formats
- ✅ **Simplicity Over Complexity**: One-click exports with sensible defaults
- ✅ **User-Centric Design**: Clear progress indicators and helpful error messages

### Technical Principles
- ✅ **Performance First**: Async processing for large exports, optimized rendering
- ✅ **Minimalist Philosophy**: Clean export output without unnecessary elements
- ✅ **Offline-First Thinking**: Static HTML exports work completely offline

### Operational Principles
- ✅ **Transparency**: Export jobs show clear status and progress
- ✅ **Reliability**: Robust error handling and retry logic
- ✅ **Security as Foundation**: Permission enforcement throughout export process

---

## Open Questions

1. **Commercial PDF Library?** Should we invest in a commercial PDF library (e.g., Prince XML) for better quality, or is open-source sufficient?

2. **Version History in Exports?** How important is including version history in exports? Adds significant complexity and size.

3. **Export Limits?** What are reasonable limits for export size and page count to prevent abuse and ensure performance?

4. **Retention Period?** Is 7 days appropriate for export file retention, or should it be longer/shorter?

5. **Background Job Threshold?** At what point should exports become background jobs? (Suggested: 50+ pages)

6. **Email Notifications?** Should email notifications be mandatory, optional, or based on export size?

7. **Branding in Exports?** Should PDF exports include wiki logo/branding in header/footer by default?

8. **Search in HTML Exports?** Is client-side search worth the added complexity and file size in HTML exports?

---

## Related Specifications

- **2-storage-architecture.md**: S3 plugin for storing temporary exports
- **3-page-creation-editing.md**: Page rendering and markdown conversion
- **5-page-links.md**: Internal link handling in exports
- **6-attachments.md**: Including attachments in exports
- **8-user-management.md**: Permission verification for exports

---

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-12 | 1.0 | Initial | Created comprehensive export functionality specification |

