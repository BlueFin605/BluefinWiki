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
- Can you create an empty folder without creating a page first? yes
- Is a folder just metadata (like a directory) or is there always an associated "index page"? it is a S3 folder with a page .md file in it
- If user creates "Projects" folder, is there automatically a "Projects" page created too? no
- Can folders exist without any pages (empty folders)? yes
- Does the storage plugin differentiate between folders and pages? yes

---

### 2. Folder Creation in Different Storage Backends
**Question**: How does folder creation work across different storage plugins (S3 vs GitHub)?

**Current spec mentions**: "Folder is created via storage plugin" and mentions different behaviors for S3 and GitHub.

**Needs clarification**:
- S3: What exactly is created? A `_folder.yml` file? An empty prefix? a page .md file within the appropriate folder with frontmatter metadata
- GitHub: Is it a directory with `.gitkeep` file? Or directory with `_folder.yml`? directory with a page .md file
- Should the storage plugin interface have a `createFolder()` method separate from `createPage()`? yes
- Or is `createPage()` with a special flag/parameter used for folders? no
- How do we query "is this a folder or a page"? naming of entities should make that clear

---

### 3. Root-Level Folder Location
**Question**: Where are root-level folders stored in S3?

**Current spec says**: "Create a new folder 'Projects' at root level"

**Needs clarification**:
- If S3 bucket structure is `pages/{guid}.md`, where do root folders go? pages/
- Is a root folder stored as `folders/projects-guid/_folder.yml`? no 'pages/{folder guid}/page.md with frontmatter
- Or is it implicit (no physical storage until first page is added)? no
- How does this align with the S3 storage plugin spec?

---

### 4. Folder Display Names and GUIDs
**Question**: Do folders use the same GUID-based naming system as pages? should be clari

**Why this matters**: The spec doesn't explicitly say if folders have GUIDs or use display names directly.

**Needs clarification**:
- Does each folder get a GUID like pages do?
- Is folder metadata stored in `{folder-guid}/_folder.yml`? in `pages/{folder1-guid}/{folder2-guid}/{folder3-guid}/page.md with frontmatter metadata
- Or are folders named by display name like `Projects/_folder.yml`? no
- How does folder renaming work with GUIDs vs display names? name is changed in page frontmatter
- If folder = parent page, does it use the page's GUID? no parent page in metadata or frontmatter

---

### 5. Empty Folder Deletion
**Question**: What happens to empty folder structure when last page is removed?

**Current spec says**: "Given an empty folder, when a user deletes it, then the storage plugin removes the folder structure and metadata"

**Needs clarification**:
- Is cleanup automatic when last page is removed, or must user explicitly delete folder? explicit delete
- If automatic, is there a delay or is it immediate? immediate
- What if user wants to keep an empty folder for future use? folder stays as it has a page .md file with frontmatter metadata
- Does the folder page .md file persist even when empty, or is it deleted? yes
- In S3, do empty "folders" (prefixes) need explicit cleanup? no

**clarification**
- each folder will have a page .md file with the same guid - by default this will be empty, except for frontmatter metadata
---

## 🟡 High Priority - Important for User Experience

### 6. Folder Icon and Color Customization
**Question**: How are folder icons and colors stored and displayed?

**Current spec mentions**: "Optional fields include tags, color code (hex), and icon (emoji or icon name)"

**Needs clarification**:
- What's the icon name format? Material icons? Font Awesome? Custom set? Icon Name and Material Icons
- Example: `icon: "📁"` (emoji) or `icon: "folder-open"` (icon name)? emoji
- Is there a predefined set of icons to choose from? yes
- How is color code used? Background color? Border? Icon color? system choice
- Should there be defaults if not specified? blue

---

### 7. Folder vs Page View Distinction
**Question**: When a user clicks on a folder, what do they see?

**Needs clarification**:
- Option A: Folder shows a list of children (no page content)
- Option B: Folder shows associated page content + list of children below
- Option C: User chooses between "View Folder" and "View Page" for folders
- Which approach does BlueFinWiki use? none, should just show ther pgae associated with the folder, I want a tree view on the left for navigation purposes and that should be highligted
- Can folders have markdown content like pages, or only children list? folders have a page anfd should display like themm 

---

### 8. Folder Description Display
**Question**: Where and how is folder description displayed?

**Current spec says**: "Description is displayed below the folder title before listing contents"

**Needs clarification**:
- Is description markdown-formatted or plain text? mark-down, the folder displays as a page and that is it's decription, no other info is needed
- If markdown, does it support full markdown syntax (images, links, etc.)? yes
- Maximum length for descriptions? it is a full page
- Is description shown in navigation tree, or only when viewing folder contents? no

---

### 9. Folder Sorting and Ordering
**Question**: Can users customize the sort order of items within a folder?

**Current spec says**: "Items within each group (folders, pages) are sorted alphabetically by display name"

**Needs clarification**:
- Is alphabetical the only option, or can users choose other sort orders? user can change roder of folders and pages by dragging and dropping in navigation tree view
- Options: alphabetical, manual/custom order, created date, modified date? custom
- If manual order, where is order stored? In folder metadata? probably need a sort order file
- Can users drag-and-drop to reorder? yes

---

### 10. Nested Folder Depth Limit
**Question**: Is there a limit to folder nesting depth?

**Current spec mentions**: "Deeply nested hierarchy (grandparent/parent/child)"

**Needs clarification**:
- Maximum nesting depth? (e.g., 10 levels, 20 levels, unlimited?) unlimited
- Should UI warn when approaching depth limit?
- Performance considerations for very deep hierarchies?
- Breadcrumb display for deeply nested folders? when gets too long shorted with ...

---

### 11. Folder Move Restrictions
**Question**: Can folders be moved freely, or are there restrictions?

**Current spec mentions**: "Validation prevents the circular reference"

**Needs clarification**:
- Can root folders be moved under other folders? no but the pages in a root folder can
- Can folders be moved to become root-level? no but pages can be moved to root
- If folder A contains folder B, can B be moved to root? no
- Should there be confirmation for moves affecting many pages? yes

---

### 12. Folder Permissions
**Question**: Can folders have different permissions than their pages? no

**Not explicitly covered in spec**:
- Can a folder be marked "read-only" for certain users? not for MVP
- Do folder permissions inherit to all child pages? yes
- Or are permissions always page-level? yes
- Who can create folders (Editor role sufficient, or Admin only)? edit role is sufficient

---

### 13. Folder Templates
**Question**: Can folders be created from templates (related to Story 7 - Duplicate Folder)?

**Current spec mentions duplication**: "Create a copy of an existing folder"

**Needs clarification**:
- Should there be a "folder template" system? not for MVP
- Can users save folders as templates for reuse? not for MVP
- Pre-built templates like "Project Folder", "Meeting Notes", etc.? not for MVP
- Or is duplication the only way to copy folder structures? yes

---

### 14. Folder Search Integration
**Question**: How do folders appear in search results?

**Current spec mentions**: "Search plugin receives folder path filter"

**Needs clarification**:
- Can folders themselves be search results (matching folder names)? the page associated with the folder can be searched
- Or only pages within folders appear in results?
- If folder name matches, should it show pages within that folder?
- How is "search within folder" scoping implemented?

---

### 15. Folder Pagination Threshold
**Question**: At what point does folder content pagination kick in? no pagination for MVP

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
- Is there a "New Folder" button separate from "New Page"? what if we treated evey page as a folder with it's own .md file it becomes easy to add children to an existing page. We do not add a folder we have a '+' buttpon on the page on navigator tree view to add a child page
- Or is it one "New" button with options "Page" or "Folder"?
- Does create folder dialog ask for name only, or also description/icon/color?
- Can folder be created inline in navigation tree (right-click → "New Subfolder")? yes but it would be a page

---

### 17. Folder Rename Impact on URLs
**Question**: How does folder renaming affect page URLs?

**Needs clarification**:
- If "Projects" folder is renamed to "Active Projects", do child page URLs change? no as it is all GUID's
- Example: `/wiki/Projects/Alpha` becomes `/wiki/Active-Projects/Alpha`?
- Or do child pages maintain stable URLs using GUIDs? yes
- Should redirects be created from old paths to new paths? not for MVP

---

### 18. Folder Metadata Schema
**Question**: What is the complete schema for folder page frontmatter?

**Needs definition**:
```yaml
---
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
---
```
- Is this correct and complete?
- Each folder has a page .md file where this frontmatter serves as the folder metadata - in fact each page is a folder

---

### 19. Folder Move Progress Indication
**Question**: How is progress shown when moving folders with many pages?

**Current spec mentions**: "Operation shows progress indicator and can be cancelled"

**Needs clarification**:
- What format? "Moving 15 of 50 pages..." progress bar? not for MVP, just move pages
- Is move operation queued/backgrounded or blocking? ru in background
- Can user continue using wiki while move is in progress? yes
- If cancelled mid-move, what's the rollback strategy? no rollback it will stay in the semi moved state and can move it back manually

---

### 20. Folder Duplication Options
**Question**: What options are available when duplicating a folder?

**Current spec mentions**: "Duplicate folder" and "internal links between pages are updated"

**Needs clarification**:
- Should user be able to choose what to duplicate?
  - [ ] Duplicate folder structure only (empty)
  - [X] Duplicate pages (with content)
  - [X] Duplicate attachments
  - [ ] Update internal links
- Where is duplicated folder created (same parent, root, user chooses)? if a page is a folder it will create it's own directory
- How are duplicates named? "Copy of Projects", "Projects (2)", user prompted? "Copy of Projects"

---

### 21. Recently Deleted Folders
**Question**: How do deleted folders appear in trash/recently deleted?

**Not explicitly covered in spec**:
- If folder is deleted (with contents), does it appear as single item in trash? yes
- Or do all deleted pages appear individually?
- Can folder be restored as a whole, or only individual pages? a whole, if the state is inherited if you undelete the parent all children will be reinstated

---

### 22. Folder Creation Permissions
**Question**: Who can create folders at what levels?

**Not explicitly covered in spec**:
- Can any Editor create root-level folders? yes
- Or are root folders Admin-only?
- Can Viewers create subfolders (probably not, but worth confirming)? yes
- Should there be a setting to control this? no

---

### 23. Folder Count and Size Indicators
**Question**: Should folders show count of children and total size?

**Not explicitly covered in spec**:
- Should folder listing show "15 pages, 3 folders" count? no, this should be visible in explorer
- Total size of all contents "2.3 MB"? not for MVP
- Is this computed on-demand or cached? 
- Performance impact for large folders?

---

### 24. Folder Activity Feed
**Question**: Can users see recent activity within a folder? not for MVP

**Not explicitly covered in spec**:
- "Recently updated pages in this folder"?
- "New pages added this week"?
- Integration with page history feature?
- Is this part of folder view or separate feature?

---

### 25. Folder Export
**Question**: Can folders be exported as a unit? not for MVP

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
