# BlueFinWiki - Specification Clarifications

**Last Updated**: February 6, 2026

This document tracks important design decisions and clarifications made to the specifications.

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

## Future Clarifications

When additional design decisions are made, document them here with:
- Date
- Issue identified
- Clarification/decision made
- Rationale
- Affected specifications
- Technical details if applicable
