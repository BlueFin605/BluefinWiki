# BlueFinWiki - Specification Clarifications

**Last Updated**: February 6, 2026

This document tracks important design decisions and clarifications made to the specifications.

---

## Session Management Approach (Feb 6, 2026)

**Issue Identified**: Ambiguity between stateless JWT tokens and tracked sessions in authentication specification.

**Original Conflict**:
- [1-user-authentication.md](1-user-authentication.md) defined `AuthSession` entity suggesting session tracking
- Clarifications document stated: "We do not need to track sessions, access token should expire"
- Unclear whether sessions could be immediately revoked

**Resolution - Stateless JWT Approach**:
- **No server-side session tracking** - JWT tokens are self-contained
- Access tokens stored in secure, httpOnly cookies
- Token expiration: 7 days (default) or 30 days with "Remember me"
- **Sessions cannot be revoked** until token naturally expires
- Refresh token validation checks user status (deleted/disabled users cannot refresh)

**Implications**:
1. **User Suspension Delay**: When an admin suspends a user, that user can continue accessing the wiki until their token expires (7-30 days)
2. **No "Sign Out Everywhere"**: Cannot force logout from all devices
3. **No Active Session View**: Admin cannot see list of active user sessions
4. **Cost-Effective**: No DynamoDB storage/queries for session management
5. **Serverless-Friendly**: No session state to maintain across Lambda invocations

**Trade-offs**:
- ✅ **Pros**: Simpler architecture, lower cost, better serverless scalability
- ❌ **Cons**: Cannot immediately revoke access, no session management visibility

**Future Enhancement Option**:
- Post-MVP: Implement token blacklist in DynamoDB for immediate revocation capability
- Would add ~$0.10-0.50/month cost but enable "Sign Out Everywhere" feature

**Updated Specifications**:
- [1-user-authentication.md](1-user-authentication.md):
  - Removed `AuthSession` entity from Key Entities section
  - Updated Assumptions to clarify stateless JWT approach
  - Added Out of Scope section documenting session revocation limitations
- [8-user-management.md](8-user-management.md):
  - US-4: Added Important Note about suspension delay (7-30 days)
  - Updated acceptance criteria to reflect token expiration behavior
  - Modified warning message to inform admin about session expiration delay

**Rationale**:
1. **Architectural Consistency**: Aligns with serverless, stateless design principles
2. **Cost Optimization**: Eliminates DynamoDB reads/writes for every request
3. **Family Use Case**: Low security risk - family wikis have trusted users
4. **Simplicity**: Reduces complexity, no session cleanup jobs needed

---

## Draft Page Permissions (Feb 6, 2026)

**Issue Identified**: Original spec for page status ([16-page-metadata.md](16-page-metadata.md)) stated "Draft pages visible to all authenticated users" which contradicted the purpose of draft status.

**Clarification Made**:
- **Draft pages are now visible ONLY to the page author and admins**
- Draft pages are hidden from navigation, search, and page lists for other users
- This aligns with typical wiki behavior where drafts are private working areas

**Rationale**:
1. **Privacy**: Authors need a safe space to work on sensitive content before publishing
2. **Family Wiki Use Case**: Parents may want to draft "adults only" content before it's ready
3. **Work-in-Progress Protection**: Prevents family members from seeing incomplete/incorrect information
4. **Consistency**: Aligns with common wiki patterns (MediaWiki, Confluence, Notion)

**Interaction with Page Permissions**:
- Draft status is **independent** from page permissions (Spec #11)
- A page can be both "Draft" AND "Private"
- Status transitions:
  - **Draft + Private** → Only author + admins can access
  - **Published + Private** → Only owner + admins + specific users (per permission settings)
  - **Draft + Public** → Only author + admins (draft overrides public)
  - **Published + Public** → All authenticated users

**Technical Implementation**:
```javascript
// Draft visibility check
function canViewDraft(page, currentUser) {
  if (page.status !== 'Draft') return true; // Not a draft, check other permissions
  return (currentUser.id === page.authorId || currentUser.role === 'Admin');
}
```

**Updated Sections**:
- [16-page-metadata.md](16-page-metadata.md) - US-11.4: Set Page Status
  - Acceptance Criteria updated
  - Status Definitions clarified
  - UI/UX Notes added for draft visibility
  - Technical Notes added for query logic
  - New section: "Permission Interaction" explaining how draft status works with page permissions

---

## Specification Organization (Feb 6, 2026)

**Issue Identified**: Dual numbering system with specs 1-13 in `.specify/memory/specs/` and specs 9-14 in root folder, causing collision on numbers 9-13.

**Resolution**:
- Consolidated all 19 specifications into root `BlueFinWiki/` directory
- Renumbered root specs to avoid collision:
  - Old 9-export → New 14-export
  - Old 10-comments → New 15-comments
  - Old 11-metadata → New 16-metadata
  - Old 12-admin → New 17-admin
  - Old 13-onboarding → New 18-onboarding
  - Old 14-errors → New 19-errors
- Created [SPECIFICATIONS.md](SPECIFICATIONS.md) master index
- Updated [gaps.md](gaps.md) to reflect completed specifications

**Rationale**: Single source of truth, easier navigation, eliminates confusion.

---

## Accessibility Requirements Added (Feb 6, 2026)

**Issue Identified**: Gaps.md noted that accessibility (WCAG 2.1 AA) was only comprehensively covered in [18-onboarding-help.md](18-onboarding-help.md), while other specs mentioned accessibility inconsistently.

**Resolution**:
- Created accessibility template: [.specify/templates/accessibility-template.md](.specify/templates/accessibility-template.md)
- Added **Accessibility Requirements (WCAG 2.1 AA)** sections to:
  - [4-page-editor.md](4-page-editor.md) - Editor keyboard shortcuts, screen reader support
  - [7-wiki-search.md](7-wiki-search.md) - Search dialog accessibility
  - [14-export-functionality.md](14-export-functionality.md) - Export UI and generated PDF/HTML accessibility
  - [15-page-comments.md](15-page-comments.md) - Comment threading and form accessibility
  - [16-page-metadata.md](16-page-metadata.md) - Tag input, status badges, category navigation
  - [17-admin-configuration.md](17-admin-configuration.md) - Admin controls, system health dashboard

**Accessibility Standards Applied**:
- **Keyboard Navigation**: All features operable via keyboard
- **Screen Reader Support**: Proper ARIA labels, roles, and announcements
- **Visual Design**: 4.5:1 contrast ratio, color-independent information
- **Content Structure**: Semantic HTML, proper heading hierarchy
- **Mobile Accessibility**: 44x44px touch targets, responsive layouts

**Benefits**:
1. Consistent accessibility across all features
2. Clear requirements for implementation
3. Testable accessibility criteria
4. Constitutional compliance (WCAG 2.1 AA requirement)

**Remaining Work**:
- Specs 1-3, 5-6, 8-13 can reference the template as needed
- Spec 18 already has comprehensive accessibility section
- Spec 19 (error handling) should ensure error messages meet accessibility standards

---

## Future Clarifications

When additional design decisions are made, document them here with:
- Date
- Issue identified
- Clarification/decision made
- Rationale
- Affected specifications
- Technical details if applicable
