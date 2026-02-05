# Page Metadata & Organization Specification

## Overview
This specification defines how pages in BlueFinWiki can be organized, categorized, and managed through metadata including tags, categories, custom fields, and page status. This system enables users to structure content meaningfully and discover related information efficiently.

## Cross-References

**Integrates with:**
- [7-wiki-search.md](7-wiki-search.md) - Tags and categories indexed for advanced search filtering
- [11-page-permissions.md](11-page-permissions.md) - Draft status works independently from page permissions
- [9-page-history.md](9-page-history.md) - Status changes logged in version history
- [14-export-functionality.md](14-export-functionality.md) - Metadata included in PDF exports

**Related:**
- [3-folder-management.md](3-folder-management.md) - Categories complement folder-based organization
- [10-navigation-discovery.md](10-navigation-discovery.md) - Tags enable discovery and navigation

## Constitutional Alignment
- **Simplicity First**: Metadata should enhance organization without adding complexity to basic page creation
- **Family-Friendly**: Intuitive categorization that makes sense to non-technical family members
- **Privacy & Security**: Metadata visible only to authenticated users within the wiki
- **Accessibility**: All metadata features keyboard-navigable and screen-reader friendly (WCAG 2.1 AA)
- **Low-Cost Operations**: Metadata stored efficiently in DynamoDB with minimal additional storage cost

## User Stories

### US-11.1: Add Tags to Pages
**As a** wiki user  
**I want to** add tags to pages  
**So that** I can categorize content and find related pages easily

**Priority**: P1  
**Rationale**: Tags are fundamental to wiki organization and were mentioned in search spec but not in creation

**Acceptance Criteria**:
- Users can add multiple tags to any page they have edit access to
- Tags are displayed prominently on the page (below title or in sidebar)
- Tags are case-insensitive and normalized (e.g., "Family Recipes" = "family recipes")
- Auto-complete suggests existing tags as user types
- Tags can be added during page creation or edited later
- Clicking a tag shows all pages with that tag
- Maximum 20 tags per page
- Tag names limited to 50 characters
- Tag names cannot contain special characters except hyphens and spaces

**UI/UX Notes**:
- Tag input field with pill-style display (similar to email chips)
- Popular/recent tags shown as quick-add buttons
- Tag cloud view optional for browsing all tags

**Technical Notes**:
- Tags stored in DynamoDB page item as Set attribute
- Global tag index (GSI) for "get all pages by tag" queries
- Tags normalized to lowercase with trimmed whitespace
- S3 page metadata includes tags for search indexing

---

### US-11.2: Organize Pages with Categories
**As a** wiki administrator  
**I want to** create hierarchical categories  
**So that** the wiki content follows a logical structure

**Priority**: P2  
**Rationale**: Categories provide stronger organizational structure than tags, useful for larger wikis

**Acceptance Criteria**:
- Admins can create, rename, and delete categories
- Categories support one level of hierarchy (parent/child)
- Each page can belong to exactly one category (optional)
- Category is displayed on page (e.g., "Category: Family Events > Birthdays")
- Category selector shown during page creation and editing
- Category browsing view shows all pages in a category
- Uncategorized pages browseable separately

**UI/UX Notes**:
- Category dropdown with hierarchical display (indented children)
- Category breadcrumb on page
- Category management UI in admin panel

**Technical Notes**:
- Categories stored in separate DynamoDB table (CategoryId, Name, ParentId)
- Page has optional CategoryId foreign key
- GSI on CategoryId for efficient category page listing
- Maximum 100 categories per wiki (reasonable for family use)

---

### US-11.3: Define Custom Metadata Fields
**As a** wiki administrator  
**I want to** define custom metadata fields  
**So that** I can track domain-specific information (e.g., recipe servings, event dates)

**Priority**: P3  
**Rationale**: Powerful feature for specialized wikis, but not essential for MVP

**Acceptance Criteria**:
- Admins can create custom fields with name and type (text, number, date, dropdown)
- Custom fields can be marked as required or optional
- Custom fields can be restricted to specific categories
- Users see relevant custom fields when editing pages
- Custom field values searchable
- Maximum 10 custom fields per wiki

**Supported Field Types**:
- Short text (max 200 chars)
- Long text (max 2000 chars)
- Number (integer or decimal)
- Date
- Dropdown (single select from predefined values)
- Checkbox (boolean)

**UI/UX Notes**:
- Custom fields shown in "Page Properties" section during editing
- Custom fields displayed in info box on page view
- Field values formatted appropriately (dates as readable format, etc.)

**Technical Notes**:
- Custom field definitions in DynamoDB table (FieldId, Name, Type, Options)
- Page metadata stored as JSON in DynamoDB Map attribute
- Validation enforced server-side based on field type
- Search indexing includes custom field values

---

### US-11.4: Set Page Status
**As a** wiki editor  
**I want to** set page status (draft, published, archived)  
**So that** I can manage page lifecycle and visibility

**Priority**: P2  
**Rationale**: Essential for content workflows, especially for collaborative wikis

**Acceptance Criteria**:
- Three statuses available: Draft, Published, Archived
- New pages default to Published (or Draft if user preference set)
- **Draft pages visible only to page author and admins** (hidden from other users)
- Archived pages visible to all but clearly marked and excluded from main navigation
- Status indicator visible on page (badge/label)
- Status filter in search and page lists (admins can search drafts, others cannot)
- Status change logged in page history

**Status Definitions**:
- **Draft**: Work in progress, not ready for general viewing. Only visible to the author and wiki admins. Hidden from navigation, search results, and page lists for other users.
- **Published**: Complete and visible according to page permissions (respects private/specific user settings from spec #11)
- **Archived**: Historical content, no longer actively maintained. Visible to all but excluded from default search/navigation. Shows archive badge.

**UI/UX Notes**:
- Status dropdown in page editor toolbar
- Status badge displayed near page title (color-coded):
  - Draft: Yellow/amber badge with "Draft" label
  - Published: No status badge (default state)
  - Archived: Gray badge with "Archived" label
- Draft pages show banner to author: "🔒 Draft - Only you and admins can see this page"
- Search default behavior: excludes both drafts and archived (users can opt-in to include archived)
- Admin search includes option to "Show drafts from all users"

**Technical Notes**:
- Status stored as enum string in DynamoDB page item: `Draft | Published | Archived`
- GSI on Status for efficient filtering
- **Draft visibility logic**: Query checks if `status === 'Draft' AND (currentUserId === authorId OR currentUserRole === 'Admin')`
- Draft pages excluded from:
  - Navigation trees for non-authors
  - Search results for non-authors
  - Recent changes feed for non-authors (or shown with draft indicator)
- Version history includes status changes with timestamp
- Status transitions logged: Draft→Published (publishing), Published→Draft (unpublishing), any status→Archived

**Permission Interaction**:
- Draft status is **independent of page permissions** (spec #11)
- A page can be both "Draft" AND "Private" - doubly restricted
- Example: Draft + Private = Only author + admins (draft rule applies)
- Example: Published + Private = Only owner + admins + specific users (permission rules apply)
- When draft is published, page permissions (if set) take effect immediately

---

### US-11.5: Manage Page Metadata in Bulk
**As a** wiki administrator  
**I want to** manage metadata for multiple pages at once  
**So that** I can efficiently organize large amounts of content

**Priority**: P3  
**Rationale**: Quality-of-life feature for wikis with many pages

**Acceptance Criteria**:
- Admin can select multiple pages (checkbox list)
- Bulk operations: add tags, change category, change status, archive
- Confirmation dialog shows affected pages before applying
- Bulk changes logged in page history for each page
- Maximum 50 pages per bulk operation
- Operation results shown (success count, any failures)

**UI/UX Notes**:
- Bulk edit mode toggle in page list view
- Checkboxes appear next to each page
- Floating action toolbar with bulk operation buttons
- Progress indicator for long operations

**Technical Notes**:
- Batch write operations to DynamoDB
- Transactional writes where possible
- Graceful handling of partial failures
- Background job for large bulk operations (>20 pages)

---

### US-11.6: View Page Metadata Summary
**As a** wiki user  
**I want to** see all metadata for a page in one place  
**So that** I can quickly understand the page's context and properties

**Priority**: P2  
**Rationale**: Important for page discoverability and understanding

**Acceptance Criteria**:
- Page info panel shows all metadata:
  - Status
  - Category (if set)
  - Tags (if any)
  - Custom fields (if any)
  - Created date and author
  - Last modified date and author
  - Number of attachments
  - Number of links (incoming and outgoing)
- Info panel collapsible/expandable
- Info panel accessible from page view and edit mode
- Print view includes metadata summary

**UI/UX Notes**:
- Sidebar or collapsible panel on page view
- "Page Info" or "Properties" button to toggle
- Metadata formatted consistently (icons, labels)
- Link counts clickable to show list of links

**Technical Notes**:
- Metadata aggregated from DynamoDB page item
- Link counts may be cached and periodically refreshed
- Metadata snapshot stored with each page version

---

### US-11.7: Search and Filter by Metadata
**As a** wiki user  
**I want to** search and filter pages by metadata  
**So that** I can find specific content efficiently

**Priority**: P1  
**Rationale**: Extends search functionality (spec 7) with metadata awareness

**Acceptance Criteria**:
- Search supports filters:
  - By tag(s) - AND/OR logic
  - By category (includes children)
  - By status (draft/published/archived)
  - By custom field values
  - By date range (created or modified)
- Multiple filters combinable
- Search results show relevant metadata
- Filter state persisted in URL (shareable/bookmarkable)
- "Advanced Search" UI for complex queries

**UI/UX Notes**:
- Filter panel in search interface
- Active filters shown as removable chips
- Filter counts shown (e.g., "Draft (5)")
- Quick filters for common combinations

**Technical Notes**:
- DynamoDB GSIs for efficient filtering
- Complex queries may use scan with filters (acceptable for family-sized wikis)
- Search results include metadata in response
- Consider ElasticSearch integration for large wikis (future)

---

### US-11.8: Suggest Metadata for New Pages
**As a** wiki user  
**I want to** receive metadata suggestions when creating pages  
**So that** I can organize content consistently without manual effort

**Priority**: P3  
**Rationale**: Nice-to-have AI/ML feature for improved UX

**Acceptance Criteria**:
- System suggests tags based on:
  - Page title
  - Initial content
  - Parent folder
  - Similar existing pages
- System suggests category based on folder location and title
- Suggestions shown as optional, user can accept or ignore
- User can always override suggestions
- Suggestions improve over time (learning)

**UI/UX Notes**:
- Suggestion chips shown during page creation
- "Accept all suggestions" button
- Individual suggestions dismissible
- Suggestions non-intrusive, don't block workflow

**Technical Notes**:
- Simple keyword matching algorithm initially
- Consider ML model for tag/category prediction (future)
- Suggestion data cached per user session
- Fallback to folder-based suggestions if ML unavailable

---

## Data Models

### Page Metadata (DynamoDB)
```json
{
  "PageId": "uuid",
  "Title": "string",
  "Status": "draft|published|archived",
  "CategoryId": "uuid|null",
  "Tags": ["tag1", "tag2", "tag3"],
  "CustomFields": {
    "field_name": "value",
    "recipe_servings": 4,
    "event_date": "2026-01-15"
  },
  "CreatedAt": "timestamp",
  "CreatedBy": "userId",
  "ModifiedAt": "timestamp",
  "ModifiedBy": "userId"
}
```

### Category (DynamoDB)
```json
{
  "CategoryId": "uuid",
  "WikiId": "uuid",
  "Name": "string",
  "ParentCategoryId": "uuid|null",
  "DisplayOrder": "number",
  "CreatedAt": "timestamp"
}
```

### Custom Field Definition (DynamoDB)
```json
{
  "FieldId": "uuid",
  "WikiId": "uuid",
  "Name": "string",
  "Type": "text|number|date|dropdown|checkbox",
  "Required": "boolean",
  "CategoryIds": ["uuid"],
  "Options": {
    "dropdown_values": ["option1", "option2"],
    "max_length": 200,
    "validation": "regex"
  },
  "CreatedAt": "timestamp"
}
```

### Tag Index (DynamoDB GSI)
```
PartitionKey: TagName (lowercase normalized)
SortKey: PageId
Attributes: PageTitle, Status, ModifiedAt
```

---

## API Endpoints

### Tags
- `POST /api/pages/{pageId}/tags` - Add tags to page
- `DELETE /api/pages/{pageId}/tags/{tagName}` - Remove tag from page
- `GET /api/tags` - List all tags with usage counts
- `GET /api/tags/{tagName}/pages` - Get pages with specific tag

### Categories
- `GET /api/categories` - List all categories (hierarchical)
- `POST /api/categories` - Create new category (admin)
- `PUT /api/categories/{categoryId}` - Update category (admin)
- `DELETE /api/categories/{categoryId}` - Delete category (admin)
- `GET /api/categories/{categoryId}/pages` - Get pages in category
- `PUT /api/pages/{pageId}/category` - Set page category

### Custom Fields
- `GET /api/custom-fields` - List all custom field definitions
- `POST /api/custom-fields` - Create custom field (admin)
- `PUT /api/custom-fields/{fieldId}` - Update field definition (admin)
- `DELETE /api/custom-fields/{fieldId}` - Delete field (admin)
- `PUT /api/pages/{pageId}/custom-fields` - Set custom field values

### Status
- `PUT /api/pages/{pageId}/status` - Update page status
- `GET /api/pages?status={status}` - List pages by status

### Bulk Operations
- `POST /api/pages/bulk/tags` - Add tags to multiple pages
- `POST /api/pages/bulk/status` - Change status for multiple pages
- `POST /api/pages/bulk/category` - Set category for multiple pages

---

## UI Components

### Metadata Editor Component
```
┌─────────────────────────────────────┐
│ Page Properties                     │
├─────────────────────────────────────┤
│ Status: [Published ▼]               │
│                                     │
│ Category: [Select... ▼]             │
│                                     │
│ Tags: [family-history] [photos]     │
│       [+ Add tag]                   │
│                                     │
│ Custom Fields:                      │
│ Event Date: [01/15/2026]            │
│ Location: [________________]        │
│                                     │
│ [Save] [Cancel]                     │
└─────────────────────────────────────┘
```

### Page Info Sidebar
```
┌─────────────────────────────────────┐
│ ℹ️ Page Information                 │
├─────────────────────────────────────┤
│ Status: 🟢 Published                │
│ Category: Family Events > Birthdays │
│                                     │
│ Tags:                               │
│ • family-history  • photos          │
│ • celebrations                      │
│                                     │
│ Created: Jan 1, 2026 by Mom         │
│ Modified: Jan 12, 2026 by Dad       │
│                                     │
│ 3 attachments • 5 links             │
└─────────────────────────────────────┘
```

### Tag Cloud View
```
┌─────────────────────────────────────┐
│ Browse by Tags                      │
├─────────────────────────────────────┤
│                                     │
│  recipes (15)   family-history (23) │
│         photos (45)  travel (12)    │
│  birthdays (8)    holidays (10)     │
│      projects (6)   ideas (4)       │
│                                     │
│ [View all tags →]                   │
└─────────────────────────────────────┘
```

---

## Accessibility Considerations

### Keyboard Navigation
- Tab through metadata fields in logical order
- Enter to add tag, Backspace to remove last tag
- Arrow keys to navigate tag suggestions
- Escape to close metadata panel

### Screen Reader Support
- Status badge announced (e.g., "Status: Published")
- Tag list announced with count (e.g., "3 tags: family-history, photos, celebrations")
- Category announced as hierarchical path
- Custom field types announced (e.g., "Event Date, date field")

### Visual Accessibility
- Status colors WCAG 2.1 AA compliant contrast ratios
- Status conveyed with icon + text (not color alone)
- Tag pills have sufficient contrast
- Focus indicators visible on all interactive elements

---

## Error Handling

### Invalid Tag Names
- Error: "Tag names cannot contain special characters except hyphens and spaces"
- Show inline validation error
- Prevent form submission until fixed

### Tag Limit Exceeded
- Warning: "Maximum 20 tags per page. Remove tags to add more."
- Disable tag input when limit reached
- Show count indicator (e.g., "18/20 tags")

### Category Deletion
- Check: Prevent deletion if pages exist in category
- Prompt: "Move or uncategorize X pages before deleting"
- Option: Bulk move pages to different category

### Custom Field Validation
- Validate field values based on type (date format, number range)
- Show inline errors on field
- Prevent saving invalid values

---

## Performance Considerations

- Tag autocomplete debounced (300ms) to reduce queries
- Category tree cached client-side
- Metadata panel lazy-loaded when opened
- Bulk operations paginated (50 pages max per batch)
- Tag cloud uses cached counts (refreshed hourly)

---

## Security Considerations

- All authenticated users can modify page metadata
- All metadata visible to all authenticated users
- Draft pages visible to all authenticated users
- Category/custom field management restricted to admins
- SQL injection prevented via parameterized queries
- XSS prevented via input sanitization on tag/category names

---

## Testing Scenarios

### Tag Functionality
1. Add multiple tags to a page
2. Remove individual tags
3. Search for pages by tag
4. Tag autocomplete suggests existing tags
5. Tag name normalization (case, whitespace)
6. Tag limit enforcement (20 max)

### Category Management
1. Create parent and child categories
2. Assign page to category
3. Move page between categories
4. Delete empty category
5. Prevent deletion of category with pages
6. Browse pages by category

### Page Status
1. Create draft page (visible to all authenticated users)
2. Publish draft (visible to all)
3. Archive page (visible but marked)
4. Filter search by status
5. Status change logged in history

### Custom Fields
1. Create custom field definition
2. Add required field to category
3. Validation enforced on save
4. Custom field values searchable
5. Update field definition (affects existing pages)

### Bulk Operations
1. Select 10 pages, add tag to all
2. Change status for multiple pages
3. Partial failure handling (some pages succeed)
4. Progress indicator for long operations

---

## Migration & Rollout

### Phase 1: Basic Tags & Status (MVP)
- Implement tag add/remove/search
- Implement page status (draft/published/archived)
- Migrate existing pages to "published" status
- Add tags to search functionality

### Phase 2: Categories
- Add category management UI
- Category assignment during page creation
- Category browsing views
- Migrate high-value pages to categories

### Phase 3: Custom Fields
- Admin UI for custom field definitions
- Custom field editing in page editor
- Custom field search/filter
- Documentation for custom field use cases

### Phase 4: Advanced Features
- Bulk metadata operations
- Metadata suggestions (AI/ML)
- Advanced filtering combinations
- Metadata analytics/reports

---

## Future Enhancements

- **Automatic Tagging**: ML-based tag suggestions from content
- **Related Pages**: "Similar pages" based on shared tags/categories
- **Metadata Templates**: Pre-defined metadata sets for page types
- **Tag Hierarchies**: Parent/child relationships between tags
- **Metadata Import/Export**: Bulk metadata via CSV
- **Visual Tag Browser**: Interactive tag cloud with filtering
- **Metadata Validation Rules**: Admin-defined validation logic
- **Metadata-Based Permissions**: Fine-grained access control via metadata

---

## Open Questions

1. Should tags be globally unique or case-sensitive?
   - **Recommendation**: Case-insensitive, normalized to lowercase

2. Maximum number of categories per wiki?
   - **Recommendation**: 100 (sufficient for family wikis)

3. Custom field types - which are truly needed for MVP?
   - **Recommendation**: Start with text, number, date only

5. Should archived pages appear in search by default?
   - **Recommendation**: No, but provide filter to include them

---

## Accessibility Requirements (WCAG 2.1 AA)

### Keyboard Navigation
- Tab through tag input and suggestions
- Arrow keys navigate tag autocomplete list
- Enter adds selected tag
- Backspace removes last tag when input empty
- Delete/Backspace removes tag when focused
- Status dropdown navigable with arrow keys

### Screen Reader Support
- Tag input has `aria-label="Add tags to page"`
- Tag suggestions announced as list with count
- Added tags announced: "Added tag: Family Recipes"
- Removed tags announced: "Removed tag: Vacation"
- Status badge has clear label: "Page status: Draft"
- Category dropdown describes current selection

### Visual Design
- Tag pills have 4.5:1 contrast ratio
- Status badges color-coded with text labels (not color alone):
  - Draft: Yellow badge + "Draft" text
  - Archived: Gray badge + "Archived" text
- Focus indicator on tag pills and controls
- Remove tag button (×) clearly visible

### Content Structure
- Tags as list with semantic HTML (`<ul>`, `<li>`)
- Status badge uses `<span role="status">`
- Category breadcrumb uses `<nav>` with proper structure
- Custom fields have associated `<label>` elements

### Mobile Accessibility
- Tag pill touch targets minimum 44x44px
- Tag remove buttons easy to tap
- Status dropdown accessible on touch devices
- Tag autocomplete doesn't obscure keyboard

---

## Success Metrics

- **Tag Adoption**: % of pages with at least one tag
- **Category Usage**: % of pages assigned to categories
- **Status Workflow**: Ratio of draft → published conversions
- **Search Efficiency**: Reduction in search time with metadata filters
- **Bulk Operations**: Usage frequency of bulk metadata edits

---

## Dependencies

- **Spec 2 (Storage)**: Metadata stored in DynamoDB and S3
- **Spec 3 (Folders)**: Category hierarchy similar to folder structure
- **Spec 4 (Pages)**: Metadata editor integrated into page editor
- **Spec 7 (Search)**: Tags and metadata indexed for search
- **Spec 8 (User Management)**: Role-based access to metadata features

---

## Related Documentation

- BlueFinWiki Constitution (core principles)
- Spec 4: Page Creation & Editing
- Spec 7: Search Functionality
- Spec 8: User Management
- AWS DynamoDB Best Practices
- WCAG 2.1 AA Guidelines

---

**Specification Version**: 1.0  
**Last Updated**: January 12, 2026  
**Author**: Mitch (with Copilot assistance)  
**Status**: Draft → Review → Approved → Implemented
