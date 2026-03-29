# Clarification Questions: Page History & Version Management

**Spec**: 9-page-history  
**Created**: 2026-01-13  
**Status**: Awaiting Resolution  

This document contains questions and ambiguities identified in the Page History & Version Management specification that require decisions before implementation can begin.

---

### NEW: Version Permalinks with Short-Code URLs
**Question**: How are version permalinks structured with the new short-code system?

**ANSWERED**: Permalinks use short-code GUID format

**Implementation**:
- Current version: `/pages/{short-code}/Page Title`
- Specific version: `/pages/{short-code}/Page Title?v={version-number}`
- Short-code remains stable across page moves and renames
- URL mapping service resolves short-code to S3 path
- Version parameter routes to specific version file
- When page is renamed, all historical permalinks still work
- URL mapping tracks current title for display

---

## 1. Storage Backend Version Strategy (Priority: HIGH)

### Current Ambiguity
The spec presents two approaches for S3 storage but doesn't make a clear decision:
- **Option A**: S3 Object Versioning (built-in AWS feature)
- **Option B**: Explicit Version Files (separate files per version)
- **Mentioned**: "Hybrid approach" using S3 versioning + DynamoDB metadata

### Questions
**Q1.1**: Which S3 versioning approach should be implemented for MVP?
- [ ] A. S3 Object Versioning only
- [X] B. Explicit Version Files only  
- [ ] C. Hybrid (S3 versioning + DynamoDB metadata)
- [ ] D. Support both with configuration toggle

**Q1.2**: If using S3 Object Versioning, how will custom metadata be stored?
- S3 object versions have limited metadata (no change descriptions, author info)
- Options:
  - [ ] Store all metadata in DynamoDB, S3 only for content
  - [ ] Use S3 object metadata where possible, DynamoDB for the rest
  - [X] Store metadata in version file frontmatter (requires explicit files)

**Q1.3**: Should version content be cached, or always fetched from S3? MVP does not need caching, I will only implement it if costs increase or performance degrade
- Performance vs. cost tradeoff
- Suggestion needed for caching strategy

### Impact
- Affects backend architecture decisions
- Determines DynamoDB schema requirements
- Impacts cost estimates

---

## 2. Version Numbering Across Storage Backends (Priority: HIGH)

### Current Ambiguity
- DynamoDB schema uses `versionNumber` (integer, auto-incrementing)
- GitHub storage uses Git commit SHA as `versionId`
- Unclear how these two systems relate

#### Clarification
- All Meta data should be stored in a Meta data file, regardless of storage type
- Version numbers should be stored in the meta data file and incremented after each update

### Questions
**Q2.1**: For GitHub storage, how are version numbers assigned?
- [ ] A. Sequential numbers stored in DynamoDB (separate from Git)
- [ ] B. Derived from commit order dynamically
- [ ] C. Not used; only Git commit SHA serves as identifier
- [ ] D. Combination: SHA is primary, number is computed
- [X] E. Store current version numbers in metadata file. e.g. in S3 and increment from there

**Q2.2**: What happens if Git history is rewritten (rebase, force push)?
- [ ] A. Prevent history rewrites on wiki pages (protected branches)
- [ ] B. Detect and handle gracefully (show warning)
- [ ] C. Allow; version numbers may become inconsistent
- [X] D. Not a concern (GitHub storage assumes append-only)

**Q2.3**: Should version IDs be universally unique or backend-specific?
- S3: Can use GUIDs
- GitHub: Should use commit SHAs
- Does abstraction layer need to normalize these? All ID's should be GUIDs as they are platform agnostic

### Impact
- Affects `IStorageBackend` interface design
- Determines whether DynamoDB is required for GitHub storage
- Impacts version comparison and permalink generation

---

## 3. Concurrent Edit Detection Mechanism (Priority: HIGH)

### Current Ambiguity
- FR-012 requires conflict detection
- Edge case mentions "detect conflicts and allow manual resolution"
- No implementation details provided

### Questions
**Q3.1**: What mechanism will detect concurrent edits?
- [X] A. Optimistic locking with version tokens (ETags)
- [ ] B. Timestamp comparison (last-modified checks)
- [ ] C. Content hash comparison before save
- [ ] D. Database-level transaction isolation

**Q3.2**: When is the conflict check performed?
- [ ] A. On page load (pre-emptive warning if newer version exists)
- [X] B. On save attempt (block if conflict detected)
- [ ] C. Both (warn on load, verify on save)
- [ ] D. Continuous (websocket notifications of concurrent editors)

**Q3.3**: What does the conflict resolution UI show?
- User Story 7 acceptance #7 mentions warning, but specifics unclear
- Options:
  - [ ] A. Show diff of current vs. conflicting version, choose winner
  - [X] B. Show both versions side-by-side, manual merge interface
  - [ ] C. Force refresh to see latest, user must re-apply changes
  - [ ] D. Auto-merge with conflict markers (Git-style)

**Q3.4**: Is there a time window for considering edits "concurrent"?
- If User A loads page at 2:00 PM, edits until 2:30 PM, should they be warned about User B's 2:15 PM save? No
- Suggestion needed for staleness threshold

### Impact
- Affects user experience for collaborative editing
- Determines backend validation logic
- May require WebSocket or polling infrastructure

---

## 4. Deleted Page History Access (Priority: MEDIUM)

### Current Ambiguity
Edge case mentions "maintain history in archive table for recovery within retention period (30 days)" but user-facing behavior is unclear.

#### Clarification
- State can be held in the meta data file
- deleted files will be marked as deleted in meta data as that is platform agnostic
- do not rely on Github or S3 versioning or data retention
- permanantly deleting a file will delete the markdown file and the metadata file

### Questions
**Q4.1**: How do users access deleted page history?
- [X] A. "Recently Deleted" section in UI (like trash)
- [ ] B. Still appears in search results but marked as deleted
- [ ] C. Admin-only access via special tool
- [ ] D. Not accessible through UI; backend recovery only

**Q4.2**: What happens after the 30-day retention period?
- [ ] A. Permanently deleted (unrecoverable)
- [ ] B. Moved to long-term archive (S3 Glacier)
- [X] C. Configurable retention policy per wiki
- [ ] D. Never deleted if using GitHub storage (Git history retained)

**Q4.3**: Can users permanently delete pages before 30 days?
- [ ] A. Yes, with "Permanent Delete" action (requires confirmation)
- [X] B. No, soft deletes only
- [ ] C. Only admins can permanently delete
- [ ] D. Different rules per storage backend

**Q4.4**: For GitHub storage, does deleting a page delete the file?
- Deleting file in Git creates commit (history preserved)
- Should deleted pages remain in repo but hidden in UI?

### Impact
- Affects UI design (deleted page management)
- Determines storage costs for retention
- Impacts privacy/GDPR compliance

---

## 5. Permission Model for Version History (Priority: MEDIUM)

### Current Ambiguity
- FR-015 specifies edit permission required for restore
- Unclear what permissions are needed for viewing history, comparing versions

### Questions
**Q5.1**: What permission is required to view page version history?
- [X] A. Same as viewing current page (view permission)
- [ ] B. Read permission for page (may differ from view)
- [ ] C. Edit permission (only editors see history)
- [ ] D. Special "history" permission (separate from view/edit)

**Q5.2**: Can users view diffs of pages they can't currently access?
- Scenario: User had access to page, created version, then lost access
- [ ] A. Yes, they can view their own historical contributions
- [X] B. No, permission loss revokes history access
- [ ] C. Can see metadata (author, date) but not content
- [ ] D. Admin configurable per wiki

**Q5.3**: Should version history show all versions or only user-visible ones?
- In collaborative wikis, some versions might be marked private/draft
- [ ] A. Show all versions (transparency)
- [ ] B. Hide versions based on per-version permissions
- [ ] C. Show all but redact content of restricted versions
- [X] D. Not applicable (no per-version permissions in MVP)

**Q5.4**: Can users export versions they don't have edit permission for? yes
- Story 6 mentions export functionality
- Security consideration: preventing unauthorized data extraction

### Impact
- Affects permission system design
- Determines authorization checks in version APIs
- May impact user experience (what users can/cannot see)

---

## 6. DynamoDB Requirements for GitHub Storage (Priority: MEDIUM)

### Current Ambiguity
The spec shows DynamoDB `PageVersions` table for both S3 and GitHub storage, but GitHub already has metadata in Git commits.

#### Clarification
- meta data will be stored in a file next to markdown file
= Not sure if dynamodb is actually required for page storage

### Questions
**Q6.1**: Is DynamoDB required when using GitHub storage?
- [ ] A. Yes, always required for performance/consistency
- [X] B. No, query Git directly (DynamoDB optional cache)
- [ ] C. Optional based on configuration (perf vs. cost tradeoff)
- [ ] D. Required only for features Git doesn't support

**Q6.2**: If using DynamoDB with GitHub, is it authoritative or cache?
- [ ] A. Authoritative (Git syncs to DynamoDB on commit)
- [X] B. Cache (Git is source of truth, DynamoDB for fast queries)
- [ ] C. Hybrid (some metadata only in DynamoDB)
- [ ] D. Separate (track different aspects)

**Q6.3**: How is DynamoDB kept in sync with Git commits?
- If user makes commit outside of wiki UI (direct Git push):
- [ ] A. Background sync job reconciles on interval
- [ ] B. GitHub webhooks trigger DynamoDB updates
- [ ] C. Lazy sync on first UI access after commit
- [X] D. Not supported (all commits must go through wiki)

**Q6.4**: Can GitHub storage work without DynamoDB for MVP? yes, in fact lomng term we may not need it either if we are storing metadata in a file
- Tradeoff: Simplicity vs. query performance
- API rate limits may be concern

### Impact
- Affects infrastructure requirements and costs
- Determines complexity of GitHub storage plugin
- May impact performance characteristics

---

## 7. Change Description UX Flow (Priority: LOW)

### Current Ambiguity
User Story 4 acceptance #1 mentions "save dialog" with change description field, but the page editor flow isn't specified elsewhere in the spec.

#### Clarification
- let's not have a change description

### Questions
**Q7.1**: When does the change description dialog appear?
- [ ] A. Every time user clicks "Save" (blocking modal)
- [ ] B. Optional field in page editor (always visible)
- [ ] C. Expandable section shown on save (inline, not modal)
- [ ] D. Only when user clicks "Save with description" (separate button)

**Q7.2**: Is the change description field required or optional?
- Spec says optional, but confirm:
- [ ] A. Always optional (can be blank)
- [ ] B. Optional but encouraged (UI nudge)
- [ ] C. Required for major edits, optional for minor
- [ ] D. Configurable per wiki/page

**Q7.3**: Is there a character limit on change descriptions?
- DynamoDB attributes have limits
- Suggestion: 500 characters? 1000? unlimited?

**Q7.4**: Should change descriptions support markdown formatting?
- [ ] A. Plain text only
- [ ] B. Basic markdown (bold, italic, links)
- [ ] C. Full markdown support
- [ ] D. Not in MVP

### Impact
- Affects page editor UI design
- Minor impact on DynamoDB schema (text field sizing)
- User experience consideration

---

## 8. Performance Requirements Justification (Priority: LOW)

#### Clarification
ignore timing requirements - if performance is an issue at MVP it can be addressed then

### Current Ambiguity
NFR-001 through NFR-005 specify precise timing requirements (2s, 3s, 5s) without explanation of how these were determined.

### Questions
**Q8.1**: How were the performance targets determined?
- [ ] A. Based on measurements from similar systems
- [ ] B. Industry standards / best practices
- [ ] C. User expectation research
- [ ] D. Estimated based on technical architecture

**Q8.2**: What are the assumptions behind these targets?
- Network latency? (local, cloud, international)
- Storage backend performance? (S3 latency, GitHub API response)
- Client device capabilities?

**Q8.3**: What happens if these SLOs aren't met?
- [ ] A. Blocking issue (must optimize before launch)
- [ ] B. Best-effort (optimize if possible)
- [ ] C. Warn users if operations are slow
- [ ] D. Different targets for different scenarios

**Q8.4**: Should there be separate targets for S3 vs. GitHub storage?
- GitHub API may have different latency characteristics
- S3 generally faster for object retrieval

### Impact
- Determines testing requirements
- May affect architectural decisions (caching, optimization)
- Sets user expectations

---

## 9. Version Retention Policy (Priority: MEDIUM)

#### Clarification
- versions will be help as seperate files so consistent across storage platforms

### Current Ambiguity
The spec mentions different retention policies in different places:
- Open Question #1: "unlimited for GitHub, configurable for S3"
- Edge cases: "keep last 100 versions + monthly snapshots"
- Cost analysis assumes 10 versions per page average

### Questions
**Q9.1**: What is the default version retention policy for S3 storage?
- [ ] A. Unlimited (never delete)
- [ ] B. Last 100 versions per page
- [ ] C. Last 100 + monthly snapshots (as mentioned in edge cases)
- [X] D. Configurable per wiki (admin setting)

**Q9.2**: How are "monthly snapshots" implemented?
- If keeping "last 100 + monthly snapshots":
- [ ] A. Special tag/flag on version record
- [ ] B. Separate DynamoDB table for snapshots
- [ ] C. S3 lifecycle policy with tagging
- [X] D. Not implementing in MVP

**Q9.3**: For GitHub storage, are versions truly unlimited?
- [ ] A. Yes, rely on Git's unlimited history
- [ ] B. No, implement pruning for very large repos
- [ ] C. Configurable (can prune if desired)
- [ ] D. Unlimited but warn if repo size exceeds threshold

**Q9.4**: Can administrators configure retention policy?
- [X] A. Yes, per-wiki setting
- [ ] B. Yes, global setting for all wikis
- [ ] C. No, hardcoded based on storage backend
- [ ] D. Phase 2 feature

**Q9.5**: What happens when retention limit is reached?
- [X] A. Oldest versions deleted automatically
- [ ] B. Warn admin and pause versioning
- [ ] C. Compress/archive old versions
- [ ] D. Use S3 lifecycle transitions to Glacier

### Impact
- Affects long-term storage costs
- Determines cleanup/archival logic
- May require admin UI for policy configuration

---

## 10. Export Formats and Permalink URLs (Priority: LOW)

### Current Ambiguity
User Story 6 mentions export and permalink features but leaves format choices open.

### Questions
**Q10.1**: For version history export (all versions), which format?
- Story 6 acceptance #6 says "JSON or CSV"
- [ ] A. JSON only (richer data structure)
- [ ] B. CSV only (spreadsheet compatibility)
- [ ] C. Both formats (user chooses)
- [ ] D. JSON for API, CSV for UI download
- [X] E. Not in MVP

**Q10.2**: What should JSON export format look like?
- Nested structure? Flat array? Include full content or references? Nested
- Need schema definition

**Q10.3**: For version permalinks, which URL format?
- Spec shows two options:
- [X] A. `/pages/{pageId}/versions/{versionId}` (RESTful path)
- [ ] B. `/pages/{pageId}?version={versionId}` (query parameter)
- [ ] C. Both supported (canonical + convenience)
- [ ] D. Short form: `/p/{pageId}/v/{versionId}`

**Q10.4**: Should permalinks include authentication tokens?
- For sharing with users who might not be logged in
- [X] A. No, require authentication always
- [ ] B. Optional time-limited token in URL
- [ ] C. Public share links (separate from permalinks)
- [ ] D. Not in MVP

**Q10.5**: For single version export, include what metadata?
- Story 6 acceptance #2 mentions "YAML frontmatter with version metadata"
- Specify exact fields to include? Do not support version export

### Impact
- Affects API design and URL routing
- Determines export file schemas
- Minor user experience consideration

---

## Additional Considerations

### Implementation Dependencies
Several clarifications are blocked by or depend on other specs:
- **Storage plugin interface**: Need to review storage architecture spec to align version methods
- **Permission system**: Need to understand existing permission model before version-specific permissions can be designed
- **Page editor UX**: Change description dialog depends on how editor save flow works

### Recommendation
Prioritize clarifications in this order:
1. **HIGH priority** (blocking architecture decisions): #1, #2, #3
2. **MEDIUM priority** (needed before development): #4, #5, #6, #9
3. **LOW priority** (can be decided during implementation): #7, #8, #10

### Next Steps
- [ ] Review and answer each question section
- [ ] Update spec.md with decisions
- [ ] Create follow-up specs for complex areas (e.g., conflict resolution UI)
- [ ] Review related specs for consistency
- [ ] Validate decisions against constitution

---

## Decision Log

*Record decisions here as they are made, with date and rationale.*

### [Date] - Decision Title
**Question**: [Reference to question above]  
**Decision**: [Chosen option]  
**Rationale**: [Why this option was selected]  
**Impact**: [What this affects]

---

*This document should be reviewed and updated as decisions are made. Once all questions are resolved, update the main spec.md and archive this document.*
