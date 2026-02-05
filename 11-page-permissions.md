# Feature Specification: Granular Page Permissions

**Feature Branch**: `11-page-permissions`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "Page Permissions (Granular) Can specific pages be made private or restricted to certain users? Family wikis often need 'adults only' or 'specific person only' pages"

## Cross-References

**Referenced by (features that respect permissions):**
- [7-wiki-search.md](7-wiki-search.md) - Search results filtered by user access
- [10-navigation-discovery.md](10-navigation-discovery.md) - Navigation hides restricted pages from unauthorized users
- [14-export-functionality.md](14-export-functionality.md) - Exports only include pages user can access
- [15-page-comments.md](15-page-comments.md) - Only users with page access can view/add comments
- [9-page-history.md](9-page-history.md) - View permission required to access version history

**Works with:**
- [16-page-metadata.md](16-page-metadata.md) - Draft status is independent from page permissions (can combine)
- [8-user-management.md](8-user-management.md) - Permission assignment based on user roles

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set Page as Private (Admin/Owners Only) (Priority: P1)

A page creator or admin can mark any page as "Private" so that only the page owner and admins can view or edit it. This creates a personal space for sensitive information like passwords, financial records, or private notes.

**Why this priority**: Private pages are fundamental for family wikis where individuals need personal spaces for sensitive information. Without this, users cannot safely store private content in a shared wiki environment.

**Independent Test**: Create a page, set permissions to "Private", log in as a different standard user, verify they cannot see the page in navigation or search, and verify they get "Access Denied" if they try to access it directly via URL.

**Acceptance Scenarios**:

1. **Given** a user is editing a page they created, **When** they click the "Page Settings" icon, **Then** they see a "Permissions" section with options: "Everyone", "Specific Users", "Private (Owner & Admins Only)"
2. **Given** the permissions dialog is open, **When** user selects "Private", **Then** a confirmation shows "Only you and wiki admins will be able to view this page"
3. **Given** a page is set to Private, **When** a standard user (not the owner) views the wiki navigation, **Then** the private page is hidden from folder listings and search results
4. **Given** a private page, **When** a standard user (not owner) tries to access the page URL directly, **Then** they see "Access Denied - This page is private" with a link to the home page
5. **Given** a private page, **When** an admin or the page owner views the navigation, **Then** the page is visible with a lock icon 🔒 indicator
6. **Given** a private page, **When** the page owner views it, **Then** a banner at the top shows "🔒 Private - Only you and admins can see this page"
7. **Given** a private page is in a folder, **When** a standard user views that folder, **Then** they see the folder but not the private page inside it

---

### User Story 2 - Share Page with Specific Users (Priority: P1)

A page creator or admin can grant view or edit access to specific individual users by email. This enables "adults only" pages, personal journals shared with a spouse, or project pages shared with specific family members.

**Why this priority**: Selective sharing is the core requirement for family wikis. It allows flexible collaboration while maintaining privacy boundaries (e.g., adults-only content, medical information shared with specific caregivers).

**Independent Test**: Create a page, set permissions to "Specific Users", add two users with different permission levels (one view-only, one editor), verify each user sees the page with correct access level, and verify users not on the list cannot access it.

**Acceptance Scenarios**:

1. **Given** the permissions dialog, **When** user selects "Specific Users", **Then** they see a user picker showing all wiki users with checkboxes and role dropdowns
2. **Given** the user picker, **When** page owner selects users, **Then** they can assign each user either "Can View" or "Can Edit" permission level
3. **Given** specific users are selected, **When** saved, **Then** only those users (plus owner and admins) can access the page
4. **Given** a user has "Can View" permission, **When** they open the page, **Then** they see a read-only view with no edit button and a notice "You have view-only access"
5. **Given** a user has "Can Edit" permission, **When** they open the page, **Then** they can edit and save changes normally
6. **Given** a page with specific user permissions, **When** a user not on the list tries to access it, **Then** they see "Access Denied - You do not have permission to view this page"
7. **Given** the page owner wants to update permissions, **When** they reopen permissions dialog, **Then** they see the current list of users with their permission levels and can add/remove users
8. **Given** specific users have access, **When** the page appears in navigation for them, **Then** it shows a partial-lock icon 🔓 to indicate restricted access

---

### User Story 3 - Inherit Folder Permissions (Priority: P2)

When a folder has permissions set, all pages created within that folder automatically inherit those permissions. This creates "adults only folders" or "project team folders" without requiring permission setup for each new page.

**Why this priority**: Permission inheritance dramatically reduces management overhead for organized wikis. Once a folder like "Adult Topics" or "Medical Records" is secured, all new pages are automatically protected.

**Independent Test**: Create a folder, set folder permissions to specific users, create a new page in that folder, verify the page automatically has the same permissions, and verify users without folder access cannot see the new page.

**Acceptance Scenarios**:

1. **Given** a user creates or edits a folder, **When** they open folder settings, **Then** they see the same "Permissions" section as pages with options for Everyone/Specific Users/Private
2. **Given** a folder has "Specific Users" permissions, **When** a new page is created inside that folder, **Then** the page automatically inherits the folder's permission list
3. **Given** an inherited permission page, **When** viewing its permissions, **Then** it shows "Inherited from folder: [Folder Name]" with the current permission list
4. **Given** an inherited permission page, **When** owner clicks "Override Permissions", **Then** they can set custom permissions independent of the folder
5. **Given** a folder's permissions are changed, **When** updated, **Then** all pages with inherited permissions automatically update to match
6. **Given** a page has overridden permissions, **When** folder permissions change, **Then** the page permissions remain unchanged (override is respected)
7. **Given** a folder with restricted access, **When** a user without access browses the wiki, **Then** they don't see the folder or any of its pages in navigation
8. **Given** a restricted folder, **When** an authorized user views it, **Then** they see a lock/partial-lock icon on the folder indicating permissions are set

---

### User Story 4 - Permission Indicators in Navigation (Priority: P2)

Pages and folders with restricted permissions display clear visual indicators (lock icons, badges) in navigation, search results, and page listings so users understand access levels at a glance.

**Why this priority**: Visual indicators prevent confusion and help users understand why they can or cannot see certain content. It also helps admins quickly identify secured content.

**Independent Test**: Create pages with different permission levels, verify each displays the correct icon in navigation (🔒 for private, 🔓 for specific users, none for everyone), and verify tooltips explain the permission level.

**Acceptance Scenarios**:

1. **Given** a page is marked Private, **When** shown in navigation, **Then** it displays a 🔒 lock icon next to the title
2. **Given** a page has specific user permissions, **When** shown in navigation, **Then** it displays a 🔓 partial-lock icon next to the title
3. **Given** a page is public (Everyone), **When** shown in navigation, **Then** it displays no special icon
4. **Given** a permission icon, **When** user hovers over it, **Then** a tooltip appears with permission details (e.g., "Private - Owner & Admins Only" or "Shared with 3 users")
5. **Given** search results, **When** restricted pages appear, **Then** they show their permission icon and user can see why certain results are visible to them
6. **Given** a folder with permissions, **When** shown in navigation, **Then** it displays the appropriate permission icon on the folder itself
7. **Given** a page with inherited permissions, **When** shown in navigation, **Then** it displays the folder's permission icon and tooltip notes "Inherited from [Folder Name]"

---

### User Story 5 - Admin Can View and Edit All Pages (Priority: P2)

Admins bypass all page-level permissions and can always view, edit, and manage permissions for any page. This ensures admins can handle emergencies, moderation, and account issues.

**Why this priority**: Administrative override is essential for wiki governance. If the only person with access to critical information leaves the family or has an emergency, admins need access to manage the situation.

**Independent Test**: As admin, verify you can access private pages created by other users, edit pages you don't have explicit access to, and modify permissions on any page in the wiki.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they view wiki navigation, **Then** they see all pages regardless of permission settings
2. **Given** an admin views a private page, **When** opened, **Then** a banner shows "You are viewing this as an admin. Normal users cannot see this page."
3. **Given** an admin views a page with specific user permissions, **When** they are not on the explicit permission list, **Then** they can still view and edit the page with admin notice banner
4. **Given** an admin opens page settings, **When** viewing permissions, **Then** they can modify permissions even if they are not the page owner
5. **Given** a page owner, **When** they view their page permissions, **Then** they see a note "Admins always have access regardless of these settings"
6. **Given** admin views folder contents, **When** folder has restricted permissions, **Then** admin sees all pages inside with an indicator showing which ones are normally hidden

---

### User Story 6 - Page Owner Transfer (Priority: P3)

A page owner or admin can transfer page ownership to another user, useful when a family member who created content leaves or wants to hand off responsibility for maintaining specific pages.

**Why this priority**: Ownership transfer is a nice-to-have for long-term wiki maintenance, but not critical for initial launch. Admins can manage permissions as a workaround.

**Independent Test**: As page owner, open permissions, transfer ownership to another user, verify the new owner can manage permissions, and verify you (as previous owner) no longer have automatic owner access unless explicitly granted.

**Acceptance Scenarios**:

1. **Given** a page owner opens permissions, **When** viewing settings, **Then** they see an "Owner" section showing their email with a "Transfer Ownership" button
2. **Given** "Transfer Ownership" is clicked, **When** selected, **Then** a user picker appears with all active wiki users
3. **Given** a new owner is selected, **When** confirmed, **Then** a dialog warns "You will lose owner privileges unless you add yourself to the permission list"
4. **Given** ownership is transferred, **When** completed, **Then** the new owner can now manage page permissions (notification requires Post-MVP notification module)
5. **Given** ownership is transferred, **When** completed, **Then** the previous owner only has access if they were explicitly added to the permission list
6. **Given** an admin transfers page ownership, **When** transferring someone else's page, **Then** ownership is transferred (notifications require Post-MVP notification module)

---

### User Story 7 - Permission Templates (Common Patterns) (Priority: P3)

Users can apply pre-defined permission templates like "Adults Only" (specific list of adult family members), "My Private Page", or "Public to All" for faster permission setup without manually selecting users each time.

**Why this priority**: Templates save time and reduce errors, but users can manually set permissions as a workaround. This is a quality-of-life improvement for post-MVP.

**Independent Test**: Create a permission template "Adults Only" with 3 specific users, apply it to a new page, verify those 3 users have access, then apply it to another page and verify consistency.

**Acceptance Scenarios**:

1. **Given** a user opens permissions dialog, **When** viewing options, **Then** they see a "Templates" dropdown with system templates ("Everyone", "Private") and any custom templates
2. **Given** the templates dropdown, **When** user clicks "Create Template", **Then** they can name the template and select users with permission levels
3. **Given** a custom template is created, **When** saved, **Then** it appears in the templates dropdown for future use on any page
4. **Given** a template is applied, **When** selected, **Then** the page permissions are immediately set to match the template configuration
5. **Given** a template is used on multiple pages, **When** user wants to update the template, **Then** they can edit the template and optionally apply changes to all pages using that template
6. **Given** common scenarios, **When** wiki is first set up, **Then** admins can define site-wide templates like "Adults Only" or "Medical Team" for consistent permissions

---

### Edge Cases

- What happens when a user with "Can Edit" access tries to change the page's permissions? (Only owner and admins should manage permissions)
- How does the system handle a user who is removed from the wiki but is still in a page's specific user list?
- What happens when a page is moved from a restricted folder to a public folder (or vice versa) with inherited permissions?
- How does search ranking handle pages a user can't access? Should they appear at all in results or be completely hidden?
- What happens when a page owner's account is suspended or removed? Should ownership auto-transfer to an admin?
- How does the system handle circular references where Page A links to private Page B, and Page B links back to Page A?
- What happens when two admins simultaneously edit permissions on the same page?
- How does the system handle pages with inherited permissions when the parent folder is deleted or moved?
- What happens when a user has "Can View" access but tries to edit the page via API or direct manipulation?
- How does the system handle performance when a user has specific access to hundreds of pages across many folders?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow page creators and admins to set page permissions to "Everyone", "Specific Users", or "Private (Owner & Admins Only)"
- **FR-002**: System MUST allow page owners to grant individual users either "Can View" or "Can Edit" access when using "Specific Users" mode
- **FR-003**: System MUST hide restricted pages from navigation, folder listings, and search results for users without access
- **FR-004**: System MUST show "Access Denied" error when unauthorized users attempt to access a restricted page via direct URL
- **FR-005**: System MUST display permission indicators (lock icons) in navigation for pages with restricted access
- **FR-006**: System MUST allow folders to have permissions that automatically inherit to all pages created within them
- **FR-007**: System MUST allow page owners to override inherited permissions with custom page-level permissions
- **FR-008**: System MUST update all pages with inherited permissions when a folder's permissions are changed (unless page has explicit override)
- **FR-009**: System MUST allow admins to view and edit all pages regardless of permission settings
- **FR-010**: System MUST show admin-only banner when admin views a page they wouldn't normally have access to
- **FR-011**: System MUST prevent users with "Can View" access from editing pages
- **FR-012**: System MUST prevent non-owners from changing page permissions (only owner and admins can manage permissions)
- **FR-013**: System MUST allow page owners and admins to transfer page ownership to another user
- **FR-014**: System SHOULD notify users when granted page access (Post-MVP - requires notification module)
- **FR-015**: System MUST handle permission checks efficiently for large wikis (100+ pages with various permission levels)
- **FR-016**: System MUST preserve permission settings when pages are moved between folders (unless permissions are inherited)
- **FR-017**: System MUST show tooltip on permission icons explaining the access level (e.g., "Private", "Shared with 5 users")
- **FR-018**: System MUST allow creation of permission templates for reusable permission patterns
- **FR-019**: System MUST support applying permission templates to pages and optionally updating all pages when template changes
- **FR-020**: System MUST remove user from all page permission lists when their account is suspended or deleted

### Key Entities

- **PagePermission**: Stores permission settings for each page including permission mode (everyone/specific/private), owner user ID, and list of permitted users with their access levels
- **PermissionEntry**: Represents a single user's access to a page with user ID, access level (view/edit), and grant date
- **FolderPermission**: Stores permission settings for folders that can be inherited by child pages
- **PermissionTemplate**: Named, reusable permission configuration with list of users and access levels (e.g., "Adults Only", "Medical Team")
- **PermissionInheritance**: Tracks whether a page uses inherited permissions from its folder or has explicit override

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Page owners can set page to "Private" in under 10 seconds with clear visual confirmation
- **SC-002**: Users can share a page with specific family members and assign view/edit access in under 30 seconds
- **SC-003**: 100% of unauthorized access attempts are blocked with appropriate "Access Denied" messages
- **SC-004**: Permission indicators (lock icons) appear consistently across navigation, search results, and folder views
- **SC-005**: Permission checks complete in under 100ms for pages with up to 50 specific user grants
- **SC-006**: Folder permission inheritance applies to all child pages within 200ms of folder permission update
- **SC-007**: Admins can access 100% of pages regardless of permission settings with clear indication of admin override
- **SC-008**: Users successfully understand permission levels through icons and tooltips without referring to documentation (measured by user testing)
- **SC-009**: Zero instances of restricted pages appearing in search results or navigation for unauthorized users
- **SC-010**: Permission templates reduce permission setup time by 60% for common patterns like "Adults Only"

## Technical Considerations *(optional)*

### Permission Storage Architecture

**DynamoDB Schema Approach**:
- Store page permissions in DynamoDB alongside page metadata
- Partition key: `pageId`, additional attributes: `permissionMode` (everyone/specific/private), `ownerId`, `permittedUsers` (list of {userId, accessLevel})
- For folder permissions: Similar structure with `folderId` and `inheritedBy` list of page IDs
- Use Global Secondary Index (GSI) on `ownerId` for "My Private Pages" queries
- Use GSI on `permittedUsers` for "Pages Shared With Me" queries

**Permission Check Flow**:
1. User requests page → Check if pageId exists in user's accessible pages cache (client-side)
2. Server-side: Lambda function checks PagePermission record
3. If permission mode = "everyone" → allow access
4. If permission mode = "private" → allow only if userId = ownerId OR user is admin
5. If permission mode = "specific" → check if userId in permittedUsers list
6. If page has `inheritFromFolder` flag → check FolderPermission record
7. Cache results in CloudFront/API Gateway for 5 minutes to reduce DynamoDB reads

**Search Integration**:
- DynamoDB search must filter results by permission checks
- Pre-filter: Only return pages where permissionMode = "everyone" OR user is in permittedUsers OR user is admin
- Use GSI for efficient "user can access" queries

### Frontend Permission UI

**React Component Structure**:
```
<PageSettings>
  <PermissionSelector 
    modes={["everyone", "specific", "private"]}
    currentMode={page.permissionMode}
    onChange={handlePermissionChange}
  />
  
  {mode === "specific" && (
    <UserPicker 
      users={allWikiUsers}
      selected={page.permittedUsers}
      onUserAdd={handleUserAdd}
      onUserRemove={handleUserRemove}
      onAccessLevelChange={handleAccessChange}
    />
  )}
  
  <PermissionPreview 
    mode={page.permissionMode}
    users={page.permittedUsers}
  />
</PageSettings>
```

**Navigation Component Integration**:
- Modify `<PageListItem>` to show permission icons based on page.permissionMode
- Add CSS classes: `.page-private`, `.page-specific`, `.page-public`
- Icons: 🔒 (private), 🔓 (specific users), no icon (public)

### API Endpoints

**New/Modified Endpoints**:
- `PUT /api/pages/{pageId}/permissions` - Update page permissions
  - Body: `{ mode: "specific", permittedUsers: [{ userId, accessLevel }] }`
  - Authorization: Only page owner or admin
  - Validation: Ensure owner always has access, at least one user if "specific"
  
- `GET /api/pages/{pageId}/permissions` - Get current permissions
  - Returns: Full permission object including inherited settings
  - Shows resolved permissions if inherited from folder
  
- `POST /api/pages/{pageId}/permissions/transfer` - Transfer ownership
  - Body: `{ newOwnerId }`
  - Authorization: Current owner or admin only
  
- `PUT /api/folders/{folderId}/permissions` - Set folder permissions
  - Body: Similar to page permissions
  - Triggers update for all pages with `inheritFromFolder: true`
  
- `GET /api/permissions/templates` - List permission templates
- `POST /api/permissions/templates` - Create permission template
- `PUT /api/permissions/templates/{templateId}/apply` - Apply template to page(s)

### Performance Optimization

**Caching Strategy**:
- Cache user's accessible page IDs in JWT token claims (refreshed every 15 minutes)
- Client-side: Store accessible pages in React Context/Zustand for navigation filtering
- CloudFront: Cache public pages aggressively, private pages not at all
- API Gateway: Cache permission check results for 5 minutes per user-page combination

**DynamoDB Optimization**:
- Use batch GetItem for checking multiple pages in folder views
- Implement permission materialization: Store computed "userCanAccess" list for faster queries
- Use DynamoDB Streams to trigger permission recalculation when folder permissions change

## Alignment with Constitution *(mandatory)*

**Core Principles Addressed**:

1. **Family-Friendly Experience** ✅
   - Enables "adults only" content while maintaining family wiki structure
   - Simple permission UI suitable for all family members
   - Clear visual indicators prevent confusion about access levels

2. **Privacy & Security** ✅
   - Family data can be segmented by sensitivity (financial, medical, personal)
   - Role-based access (admin) is enhanced with page-level granular control
   - Admin override ensures emergency access without compromising normal privacy

3. **Content-First Architecture** ✅
   - Permissions stored as metadata (YAML frontmatter or separate permission files)
   - Content ownership remains with family, permission data is portable
   - Can export permission settings alongside content for migration

4. **Simplicity & Cost-Effectiveness** ✅
   - Permission checks use existing DynamoDB infrastructure (no new services)
   - Efficient query patterns minimize DynamoDB read costs
   - Caching reduces repeated permission checks

5. **Pluggable Module Architecture** ✅
   - Permission system could be implemented as optional "Permissions Module"
   - Can operate with simple "everyone" mode if module is disabled
   - Permission templates could be separate "Permission Templates Plugin"

**Non-Negotiables Compliance**:
- ✅ **Pluggable Architecture**: Permissions can be a module, default mode = "everyone" if disabled
- ✅ **Storage Plugin Compatibility**: Permission metadata stored in frontmatter works with S3 and GitHub
- ✅ **Cost Target**: Uses existing DynamoDB, adds ~1-2KB per page with permissions (negligible cost)
- ✅ **Hierarchical Structure**: Folder permission inheritance aligns with parent-child page model
- ✅ **Markdown Files**: Permissions stored in YAML frontmatter of .md files

## Open Questions / Needs Clarification

1. **Permission Granularity for Attachments**: Should attachments inherit the page's permissions, or have independent permissions? (Recommend: inherit page permissions for simplicity)

2. **Permission Audit Log**: Should all permission changes be logged with timestamps and who made the change? (Recommend: yes, for security and family accountability)

3. **Notification Preferences**: ✅ **RESOLVED** - Marked as Post-MVP. When notification module is specified, recommend always notifying users of permission grants with global opt-out setting.

4. **Default Permission for New Pages**: Should new pages default to "Everyone" or inherit parent folder permissions automatically? (Recommend: inherit if in folder, "Everyone" if at root)

5. **Anonymous/Guest Access**: Should there be support for "shareable links" that allow temporary read-only access without authentication for sharing outside the family? (Recommend: P4 future enhancement, not MVP)

6. **Permission Expiration**: Should permissions be able to have expiration dates (e.g., "Grant access for 30 days")? (Recommend: P4 future enhancement)

7. **Permission Groups**: Instead of selecting individual users, should there be support for groups like "Adults", "Kids", "Medical Team"? (Recommend: yes via Permission Templates, covered in User Story 7)

8. **View History Permissions**: Can users with "Can View" access see the page's edit history, or is that restricted to editors/owners? (Recommend: view-only users can see history but not restore versions)

## Related Specifications

- **1-user-auth**: Authentication system that provides user identity for permission checks
- **8-user-management**: Admin user management provides user list for permission picker
- **3-folder-management**: Folder hierarchy enables permission inheritance
- **7-wiki-search**: Search must respect page permissions and filter results
- **4-page-editor**: Editor must check permissions before allowing edits
- **9-page-history**: History viewing and restore should respect permission levels

## Next Steps

1. **Review with stakeholders**: Confirm permission model meets family wiki needs (adults only, private pages, shared pages)
2. **Validate with constitution**: Ensure alignment with pluggable architecture and cost targets
3. **Prototype permission UI**: Create mockup of permission dialog and user picker
4. **Database schema design**: Finalize DynamoDB schema for PagePermission and FolderPermission
5. **API contract definition**: Define exact request/response formats for permission endpoints
6. **Test plan creation**: Write integration tests for permission scenarios including edge cases
7. **Documentation**: Create user guide for "How to make a private page" and "How to share with family members"
