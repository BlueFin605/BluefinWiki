# Clarification Questions: Folder Management

**Feature**: Folder Management (CRUD Operations)  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Folder vs. Page Distinction
**Question**: Are folders separate entities from pages, or is a "folder" just a page that has children?

**Why this matters**: The spec mentions "folders" as entities but the S3 storage spec indicates hierarchy is built on page relationships.

**Needs clarification**:
- Can you create an empty folder without creating a page first?
- Is a folder just metadata (like a directory) or is there always an associated "index page"?
- If user creates "Projects" folder, is there automatically a "Projects" page created too?
- Can folders exist without any pages (empty folders)?
- Does the storage plugin differentiate between folders and pages?

---

### 2. Folder Creation in Different Storage Backends
**Question**: How does folder creation work across different storage plugins (S3 vs GitHub)?

**Current spec mentions**: "Folder is created via storage plugin" and mentions different behaviors for S3 and GitHub.

**Needs clarification**:
- S3: What exactly is created? A `_folder.yml` file? An empty prefix?
- GitHub: Is it a directory with `.gitkeep` file? Or directory with `_folder.yml`?
- Should the storage plugin interface have a `createFolder()` method separate from `createPage()`?
- Or is `createPage()` with a special flag/parameter used for folders?
- How do we query "is this a folder or a page"?

---

### 3. Root-Level Folder Location
**Question**: Where are root-level folders stored in S3?

**Current spec says**: "Create a new folder 'Projects' at root level"

**Needs clarification**:
- If S3 bucket structure is `pages/{guid}.md`, where do root folders go?
- Is a root folder stored as `folders/projects-guid/_folder.yml`?
- Or is it implicit (no physical storage until first page is added)?
- How does this align with the S3 storage plugin spec?

---

### 4. Folder Display Names and GUIDs
**Question**: Do folders use the same GUID-based naming system as pages?

**Why this matters**: The spec doesn't explicitly say if folders have GUIDs or use display names directly.

**Needs clarification**:
- Does each folder get a GUID like pages do?
- Is folder metadata stored in `{folder-guid}/_folder.yml`?
- Or are folders named by display name like `Projects/_folder.yml`?
- How does folder renaming work with GUIDs vs display names?
- If folder = parent page, does it use the page's GUID?

---

### 5. Empty Folder Deletion
**Question**: What happens to empty folder structure when last page is removed?

**Current spec says**: "Given an empty folder, when a user deletes it, then the storage plugin removes the folder structure and metadata"

**Needs clarification**:
- Is cleanup automatic when last page is removed, or must user explicitly delete folder?
- If automatic, is there a delay or is it immediate?
- What if user wants to keep an empty folder for future use?
- Does `_folder.yml` persist even when empty, or is it deleted?
- In S3, do empty "folders" (prefixes) need explicit cleanup?

---

## 🟡 High Priority - Important for User Experience

### 6. Folder Icon and Color Customization
**Question**: How are folder icons and colors stored and displayed?

**Current spec mentions**: "Optional fields include tags, color code (hex), and icon (emoji or icon name)"

**Needs clarification**:
- What's the icon name format? Material icons? Font Awesome? Custom set?
- Example: `icon: "📁"` (emoji) or `icon: "folder-open"` (icon name)?
- Is there a predefined set of icons to choose from?
- How is color code used? Background color? Border? Icon color?
- Should there be defaults if not specified?

---

### 7. Folder vs Page View Distinction
**Question**: When a user clicks on a folder, what do they see?

**Needs clarification**:
- Option A: Folder shows a list of children (no page content)
- Option B: Folder shows associated page content + list of children below
- Option C: User chooses between "View Folder" and "View Page" for folders
- Which approach does BlueFinWiki use?
- Can folders have markdown content like pages, or only children list?

---

### 8. Folder Description Display
**Question**: Where and how is folder description displayed?

**Current spec says**: "Description is displayed below the folder title before listing contents"

**Needs clarification**:
- Is description markdown-formatted or plain text?
- If markdown, does it support full markdown syntax (images, links, etc.)?
- Maximum length for descriptions?
- Is description shown in navigation tree, or only when viewing folder contents?

---

### 9. Folder Sorting and Ordering
**Question**: Can users customize the sort order of items within a folder?

**Current spec says**: "Items within each group (folders, pages) are sorted alphabetically by display name"

**Needs clarification**:
- Is alphabetical the only option, or can users choose other sort orders?
- Options: alphabetical, manual/custom order, created date, modified date?
- If manual order, where is order stored? In folder metadata?
- Can users drag-and-drop to reorder?

---

### 10. Nested Folder Depth Limit
**Question**: Is there a limit to folder nesting depth?

**Current spec mentions**: "Deeply nested hierarchy (grandparent/parent/child)"

**Needs clarification**:
- Maximum nesting depth? (e.g., 10 levels, 20 levels, unlimited?)
- Should UI warn when approaching depth limit?
- Performance considerations for very deep hierarchies?
- Breadcrumb display for deeply nested folders?

---

### 11. Folder Move Restrictions
**Question**: Can folders be moved freely, or are there restrictions?

**Current spec mentions**: "Validation prevents the circular reference"

**Needs clarification**:
- Can root folders be moved under other folders?
- Can folders be moved to become root-level?
- If folder A contains folder B, can B be moved to root?
- Should there be confirmation for moves affecting many pages?

---

### 12. Folder Permissions
**Question**: Can folders have different permissions than their pages?

**Not explicitly covered in spec**:
- Can a folder be marked "read-only" for certain users?
- Do folder permissions inherit to all child pages?
- Or are permissions always page-level?
- Who can create folders (Editor role sufficient, or Admin only)?

---

### 13. Folder Templates
**Question**: Can folders be created from templates (related to Story 7 - Duplicate Folder)?

**Current spec mentions duplication**: "Create a copy of an existing folder"

**Needs clarification**:
- Should there be a "folder template" system?
- Can users save folders as templates for reuse?
- Pre-built templates like "Project Folder", "Meeting Notes", etc.?
- Or is duplication the only way to copy folder structures?

---

### 14. Folder Search Integration
**Question**: How do folders appear in search results?

**Current spec mentions**: "Search plugin receives folder path filter"

**Needs clarification**:
- Can folders themselves be search results (matching folder names)?
- Or only pages within folders appear in results?
- If folder name matches, should it show pages within that folder?
- How is "search within folder" scoping implemented?

---

### 15. Folder Pagination Threshold
**Question**: At what point does folder content pagination kick in?

**Current spec says**: "Pagination is applied showing 25 items per page"

**Needs clarification**:
- Is 25 items the right threshold?
- Should it be configurable per user or per deployment?
- Different limits for folders vs pages (e.g., folders always shown, pages paginated)?
- "Load more" button vs traditional pagination?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Folder Creation UX
**Question**: What's the exact UI flow for creating a folder?

**Needs specification**:
- Is there a "New Folder" button separate from "New Page"?
- Or is it one "New" button with options "Page" or "Folder"?
- Does create folder dialog ask for name only, or also description/icon/color?
- Can folder be created inline in navigation tree (right-click → "New Subfolder")?

---

### 17. Folder Rename Impact on URLs
**Question**: How does folder renaming affect page URLs?

**Needs clarification**:
- If "Projects" folder is renamed to "Active Projects", do child page URLs change?
- Example: `/wiki/Projects/Alpha` becomes `/wiki/Active-Projects/Alpha`?
- Or do child pages maintain stable URLs using GUIDs?
- Should redirects be created from old paths to new paths?

---

### 18. Folder Metadata Schema
**Question**: What is the complete schema for `_folder.yml`?

**Needs definition**:
```yaml
id: "folder-guid-123"  # Or is this the parent page GUID?
displayName: "Projects"
description: "All our family projects"
icon: "📂"  # Emoji or icon name?
color: "#4CAF50"  # Hex color code?
created: "2026-01-13T10:00:00Z"
modified: "2026-01-13T12:00:00Z"
createdBy: "user-guid-456"
tags: ["family", "projects"]  # Optional?
order: "alphabetical"  # Or custom?
```
- Is this correct and complete?

---

### 19. Folder Move Progress Indication
**Question**: How is progress shown when moving folders with many pages?

**Current spec mentions**: "Operation shows progress indicator and can be cancelled"

**Needs clarification**:
- What format? "Moving 15 of 50 pages..." progress bar?
- Is move operation queued/backgrounded or blocking?
- Can user continue using wiki while move is in progress?
- If cancelled mid-move, what's the rollback strategy?

---

### 20. Folder Duplication Options
**Question**: What options are available when duplicating a folder?

**Current spec mentions**: "Duplicate folder" and "internal links between pages are updated"

**Needs clarification**:
- Should user be able to choose what to duplicate?
  - [ ] Duplicate folder structure only (empty)
  - [ ] Duplicate pages (with content)
  - [ ] Duplicate attachments
  - [ ] Update internal links
- Where is duplicated folder created (same parent, root, user chooses)?
- How are duplicates named? "Copy of Projects", "Projects (2)", user prompted?

---

### 21. Recently Deleted Folders
**Question**: How do deleted folders appear in trash/recently deleted?

**Not explicitly covered in spec**:
- If folder is deleted (with contents), does it appear as single item in trash?
- Or do all deleted pages appear individually?
- Can folder be restored as a whole, or only individual pages?

---

### 22. Folder Creation Permissions
**Question**: Who can create folders at what levels?

**Not explicitly covered in spec**:
- Can any Editor create root-level folders?
- Or are root folders Admin-only?
- Can Viewers create subfolders (probably not, but worth confirming)?
- Should there be a setting to control this?

---

### 23. Folder Count and Size Indicators
**Question**: Should folders show count of children and total size?

**Not explicitly covered in spec**:
- Should folder listing show "15 pages, 3 folders" count?
- Total size of all contents "2.3 MB"?
- Is this computed on-demand or cached?
- Performance impact for large folders?

---

### 24. Folder Activity Feed
**Question**: Can users see recent activity within a folder?

**Not explicitly covered in spec**:
- "Recently updated pages in this folder"?
- "New pages added this week"?
- Integration with page history feature?
- Is this part of folder view or separate feature?

---

### 25. Folder Export
**Question**: Can folders be exported as a unit?

**Not explicitly covered in spec**:
- "Export folder as ZIP" functionality?
- Export as markdown files maintaining structure?
- Include attachments in export?
- Is this part of folder management or separate export feature?

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially the folder vs page distinction, as this affects architecture
2. **Align this spec with S3 storage plugin spec** - ensure consistent understanding of folder representation
3. **Create mockups of folder UI** - shows folder list, creation dialog, properties panel
4. **Define the complete folder metadata schema** - document exact YAML structure

Would you like me to:
- Help clarify the relationship between folders and pages?
- Create UI mockups for folder management?
- Draft a complete folder metadata schema?
