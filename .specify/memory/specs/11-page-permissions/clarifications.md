# Clarification Questions: Page Permissions

**Feature**: Page Permissions (Role-Based Only)  
**Generated**: 2026-01-13  
**Updated**: 2026-02-06  
**Status**: Awaiting Answers

**MAJOR DESIGN CHANGE**: This feature no longer implements individual page permissions. The wiki uses a simple two-role system: **Admin** and **Standard** users. All users with an account can view and edit all pages. Admins have additional privileges for user management and system configuration.

---

## ✅ CLARIFIED - No Individual Page Permissions

**Decision**: The wiki will NOT support granular page permissions, individual user access controls, or folder-level permissions.

**Rationale**: 
- Simplified user experience for family wiki use case
- All authenticated users have equal access to content
- Access control is at the account level only (invite-only)
- Reduced complexity in implementation and maintenance

**Implications**:
- All content is accessible to all authenticated users
- No "private pages" or "restricted folders"
- No permission UI needed in page settings
- No access denied pages for authenticated users
- Simpler caching and performance model

---

## 🔴 QUESTIONS NOW OBSOLETE

The following questions are no longer relevant due to the design change:

### ~~1. Permissions Storage Location~~ - NOT APPLICABLE
No individual page permissions to store.

---

### ~~2. Permission Check Performance~~ - NOT APPLICABLE  
Only authentication check required (is user logged in?). Role check only needed for admin features.

---

### ~~3. Role-Based vs. User-Based Permissions~~ - CLARIFIED
**Answer**: Only two roles exist (Admin and Standard). All authenticated users can access all content. Roles only differentiate access to admin features, not content.

---

### ~~4. Folder Permissions Inheritance Mechanism~~ - NOT APPLICABLE
No folder permissions to inherit.

---

### ~~5. Admin Override Implementation~~ - NOT APPLICABLE
No page-level permissions to override. Admins simply have access to additional system features.

---

## � QUESTIONS NOW OBSOLETE (continued)

### ~~6. Permission UI Discoverability~~ - NOT APPLICABLE
No permission UI needed.

### ~~7. User Picker Implementation~~ - NOT APPLICABLE
No user selection for page permissions.

### ~~8. Permission Change Confirmation~~ - NOT APPLICABLE
No permission changes to confirm.

### ~~9. Access Denied Error Page Design~~ - NOT APPLICABLE
Authenticated users never see access denied for content (only for admin features if they're not admin).

### ~~10. Permission Indicator Tooltips~~ - NOT APPLICABLE
No permission indicators needed.

### ~~11. Search Result Filtering~~ - CLARIFIED
**Answer**: All search results are visible to all authenticated users. No permission-based filtering needed.

### ~~12. Navigation Hiding Strategy~~ - CLARIFIED
**Answer**: All pages and folders are visible to all authenticated users. No hiding based on permissions.

### ~~13. Override Permissions UI~~ - NOT APPLICABLE
No inherited permissions to override.

### ~~14. Bulk Permission Management~~ - NOT APPLICABLE
No individual page permissions to manage.

### ~~15. Permission Templates~~ - NOT APPLICABLE
No permission templates needed.

### ~~16. Permission Change Audit Log~~ - NOT APPLICABLE
No permission changes to log (though user management actions are still logged).

### ~~17. Temporary Access Grants~~ - NOT APPLICABLE
No time-limited access controls.

### ~~18. Permission Request Workflow~~ - NOT APPLICABLE
All authenticated users have access.

### ~~19. Group/Team Permissions~~ - NOT APPLICABLE
No group-based permissions.

### ~~20. Anonymous/Guest Access~~ - CLARIFIED
**Answer**: No anonymous access. Authentication required for all content. Invite-only system controls account creation.

### ~~21. Permalink Permissions~~ - CLARIFIED
**Answer**: All versions accessible to all authenticated users.

### ~~22. Attachment Permissions~~ - CLARIFIED
**Answer**: All attachments accessible to all authenticated users.

### ~~23. Print/Export Permissions~~ - CLARIFIED
**Answer**: All authenticated users can print and export all content.

### ~~24. Permission Conflict Resolution~~ - NOT APPLICABLE
No conflicting permissions possible.

### ~~25. Default Permission Setting~~ - CLARIFIED
**Answer**: All pages are accessible to all authenticated users by default and always.

---

## 📝 Remaining Considerations

1. **Role Differentiation** - Define what additional capabilities admins have beyond content access (user management, system configuration, etc.)
2. **Admin Feature Access** - Clarify which UI elements/features are admin-only (not content, but tools)
3. **Future Extensibility** - Document decision to keep permissions simple for MVP, note if this might change in future versions

Would you like me to:
- Document the specific admin-only features that differentiate admin from standard users?
- Create a simple access control matrix showing what each role can do?
- Update any cross-references in other specifications that mention page permissions?
