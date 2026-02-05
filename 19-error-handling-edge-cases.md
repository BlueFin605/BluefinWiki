# Error Handling & Edge Cases

## Overview
This specification defines how BlueFinWiki handles errors, service failures, edge cases, and unexpected scenarios to ensure a resilient and user-friendly experience. It covers AWS service outages, concurrent editing conflicts, data validation, network failures, and graceful degradation strategies.

## Cross-References

**Covers Error Scenarios for:**
- [2-s3-storage-plugin.md](2-s3-storage-plugin.md) - Story 1: AWS S3 service outages and graceful degradation
- [9-page-history.md](9-page-history.md) - Story 2: Concurrent editing conflicts with optimistic locking (ETags)
- [1-user-authentication.md](1-user-authentication.md) - Story 7: Authentication service failures and rate limiting
- [6-page-attachments.md](6-page-attachments.md) - Story 5: File upload failures and validation
- [7-wiki-search.md](7-wiki-search.md) - Story 6: Search service unavailability
- [4-page-editor.md](4-page-editor.md) - Story 3: Network connectivity loss with localStorage drafts

**Security & Validation:**
- Story 4: Input validation and XSS prevention applies to all user input across specifications
- Story 9: Data corruption detection for all page content

---

## Constitutional Alignment
- **Non-Negotiable: Reliability** - System must handle failures gracefully without data loss
- **Non-Negotiable: Security** - Error messages must not expose sensitive information
- **Principle: User Experience** - Clear, actionable error messages that help users understand what went wrong
- **Principle: Simplicity** - Errors should be easy to understand and recover from

---

## User Stories

### Story 1: AWS S3 Service Outage
**As a** wiki user  
**I want** the system to handle AWS S3 outages gracefully  
**So that** I can still access cached content and know when the service will be available

**Priority:** P1  
**Rationale:** AWS outages are rare but impact all users. Graceful degradation is critical.

**Acceptance Criteria:**
- [ ] System detects S3 connectivity issues within 5 seconds
- [ ] Read-only mode activated automatically when S3 is unavailable
- [ ] Users see clear banner: "Wiki is in read-only mode due to storage service issues. You can view content but cannot save changes."
- [ ] Cached/previously loaded pages remain accessible
- [ ] System automatically recovers when S3 is available (health check every 30 seconds)
- [ ] Any attempted writes during outage are queued (if feasible) or clearly rejected with explanation
- [ ] Admin receives notification of service degradation

**Technical Notes:**
- Implement circuit breaker pattern for S3 calls
- Cache recently accessed pages in browser localStorage
- Use AWS CloudWatch for S3 health monitoring
- Exponential backoff for retry attempts

---

### Story 2: Concurrent Editing Conflict Resolution
**As a** wiki editor  
**I want** to be warned when someone else edits the same page simultaneously  
**So that** I don't accidentally overwrite their changes

**Priority:** P1  
**Rationale:** In family wikis, multiple people may edit simultaneously. Data loss is unacceptable.

**Acceptance Criteria:**
- [ ] System tracks last edit timestamp and editor for each page
- [ ] When user attempts to save, system checks if page was modified since user started editing
- [ ] If conflict detected, user sees modal: "Someone else modified this page while you were editing"
- [ ] Modal shows:
  - Who made the conflicting edit
  - When the edit was made
  - Side-by-side diff of their changes vs the current saved version
- [ ] User can choose:
  - **Overwrite** - Replace current version with their changes (requires confirmation)
  - **Merge manually** - Open merge editor to combine both versions
  - **Discard** - Abandon their changes and reload current version
  - **Copy to clipboard** - Save their work and review conflict later
- [ ] System automatically saves user's version to localStorage before showing conflict
- [ ] If user chooses to overwrite, a version is created for the changes they're replacing

**Technical Notes:**
- Use optimistic locking with version/ETag mechanism
- Store edit session start timestamp on client
- Compare timestamp with last_modified on save
- Implement diff library (e.g., diff-match-patch) for visual comparison

---

### Story 3: Network Connectivity Loss
**As a** wiki user  
**I want** to be notified when I lose internet connection  
**So that** I don't lose my work and understand why features aren't working

**Priority:** P1  
**Rationale:** Users may work from unstable connections. Must prevent data loss.

**Acceptance Criteria:**
- [ ] System detects network disconnection within 3 seconds
- [ ] Non-intrusive banner appears: "You're offline. Your changes are being saved locally."
- [ ] Unsaved editor content auto-saved to localStorage every 30 seconds
- [ ] Read-only features continue to work with cached data
- [ ] Write operations are queued or clearly disabled
- [ ] When connection restored, banner shows: "You're back online. Click here to save your changes."
- [ ] If user navigates away while offline, their draft is preserved
- [ ] On next login, system offers to restore unsaved work

**Technical Notes:**
- Use `navigator.onLine` API and periodic health checks
- Implement service worker for offline detection
- Store drafts in IndexedDB with page ID and timestamp
- Show "last saved" timestamp in editor

---

### Story 4: Invalid or Malicious Input Handling
**As a** system administrator  
**I want** the system to validate and sanitize all user input  
**So that** malicious users cannot compromise security or corrupt data

**Priority:** P1  
**Rationale:** Security is a non-negotiable constitutional requirement.

**Acceptance Criteria:**
- [ ] All user input is validated on both client and server side
- [ ] Markdown content is sanitized to prevent XSS attacks
- [ ] File uploads are validated for:
  - File type (whitelist only: images, PDFs, common docs)
  - File size (max 50MB per file, configurable)
  - File name (no path traversal characters)
  - MIME type verification (not just extension)
- [ ] SQL injection prevented through parameterized queries
- [ ] Path traversal attacks blocked (e.g., `../../etc/passwd`)
- [ ] Rate limiting applied to all API endpoints
- [ ] Suspicious activity logged and admin notified
- [ ] Error messages don't reveal sensitive system information

**Error Messages (Client-Facing):**
- ✅ "File type not allowed. Please upload an image, PDF, or document."
- ❌ "File upload failed: S3 bucket 'bluefin-prod-us-east-1' permission denied"

**Technical Notes:**
- Use DOMPurify or similar for HTML sanitization
- Implement express-validator or zod for input validation
- Use AWS WAF for additional protection
- Log all validation failures with context

---

### Story 5: File Upload Failures
**As a** wiki editor  
**I want** clear feedback when file uploads fail  
**So that** I can resolve the issue and successfully attach files

**Priority:** P2  
**Rationale:** File uploads can fail for many reasons. Users need actionable guidance.

**Acceptance Criteria:**
- [ ] Upload progress bar shows percentage complete
- [ ] If upload fails, user sees specific error message:
  - File too large: "File exceeds 50MB limit. Please compress or split the file."
  - Invalid type: "This file type is not supported. Allowed types: images, PDFs, documents."
  - Network error: "Upload interrupted. Check your connection and try again."
  - Storage full: "Storage quota exceeded. Please contact admin or delete unused files."
- [ ] User can retry upload without re-selecting file
- [ ] Partial uploads are cleaned up automatically
- [ ] Large files show estimated time remaining
- [ ] Option to cancel upload mid-process

**Technical Notes:**
- Use resumable upload for files >5MB (S3 multipart upload)
- Implement retry logic with exponential backoff
- Clean up orphaned multipart uploads daily (S3 lifecycle policy)
- Validate file size before starting upload

---

### Story 6: Search Service Unavailable
**As a** wiki user  
**I want** alternative ways to find content when search is down  
**So that** I can still navigate the wiki effectively

**Priority:** P2  
**Rationale:** Search is important but not critical for basic wiki functionality.

**Acceptance Criteria:**
- [ ] If search service fails, user sees: "Search is temporarily unavailable. Try browsing by folder or use recent pages."
- [ ] Recent pages list still accessible
- [ ] Folder navigation still works
- [ ] Page history shows recent edits
- [ ] Error is logged but doesn't block other features
- [ ] Search automatically recovers when service is available
- [ ] Admin receives notification if search is down >5 minutes

**Technical Notes:**
- Implement fallback to basic text matching if OpenSearch fails
- Cache search index for limited offline capability
- Monitor OpenSearch cluster health

---

### Story 7: Authentication Service Failures
**As a** wiki user  
**I want** to understand authentication issues clearly  
**So that** I know how to resolve login problems

**Priority:** P1  
**Rationale:** Authentication is critical for access. Errors must be clear and actionable.

**Acceptance Criteria:**
- [ ] Specific error messages for different auth failures:
  - "Incorrect email or password" (don't reveal which)
  - "Your account is not yet activated. Check your email for the invitation."
  - "Your account has been disabled. Contact the administrator."
  - "Authentication service is temporarily unavailable. Please try again in a few minutes."
  - "Your session has expired. Please log in again."
- [ ] Rate limiting after 5 failed login attempts (show CAPTCHA or delay)
- [ ] Account lockout after 10 failed attempts (15-minute cooldown)
- [ ] Active session preserved in localStorage to recover from temporary auth service issues
- [ ] If auth service is down, existing authenticated users can continue (with cached credentials validation)

**Technical Notes:**
- Use AWS Cognito health checks
- Implement session token refresh before expiration
- Cache user permissions for 5 minutes
- Log all authentication failures with IP address

---

### Story 8: Page Load Failures
**As a** wiki user  
**I want** helpful error messages when pages fail to load  
**So that** I can troubleshoot or report the issue

**Priority:** P2  
**Rationale:** Pages may fail to load for various reasons. Users need guidance.

**Acceptance Criteria:**
- [ ] If page fails to load, show error page with:
  - Clear explanation: "This page couldn't be loaded"
  - Possible reasons (in plain language)
  - Actions to try: "Refresh page", "Go to homepage", "Contact support"
  - Error ID for support reference
- [ ] Different messages for different scenarios:
  - 404: "This page doesn't exist. It may have been deleted or moved."
  - 403: "You don't have permission to view this page. Contact an admin if you need access."
  - 500: "Something went wrong on our end. We've been notified and are looking into it."
  - Timeout: "This page is taking too long to load. Try refreshing."
- [ ] Option to view cached version if available
- [ ] Breadcrumb trail still visible for navigation
- [ ] Error logged with full context for debugging

**Technical Notes:**
- Implement custom error pages for each HTTP status code
- Use error boundaries in React to catch rendering errors
- Log errors to CloudWatch with request ID correlation

---

### Story 9: Data Corruption Detection
**As a** system administrator  
**I want** the system to detect and handle corrupted data  
**So that** users don't see broken pages or lose content

**Priority:** P2  
**Rationale:** Data corruption is rare but catastrophic if not handled properly.

**Acceptance Criteria:**
- [ ] System validates data integrity when loading pages:
  - JSON structure validation
  - Markdown parsing validation
  - Character encoding validation
- [ ] If corruption detected:
  - Page marked as "needs recovery"
  - Admin receives immediate alert
  - User sees: "This page appears to be damaged. An administrator has been notified."
  - Option to view previous version (if available)
- [ ] Automated recovery attempts:
  - Try to load previous version
  - Attempt to repair common JSON issues
  - Fallback to raw content display
- [ ] All corruption incidents logged with full page data for forensic analysis
- [ ] Daily integrity checks on all pages (background job)

**Technical Notes:**
- Implement JSON schema validation
- Use MD5 checksums for data integrity verification
- Store page backups in separate S3 bucket (versioning enabled)
- Implement automated recovery procedures

---

### Story 10: Browser Compatibility Issues
**As a** wiki user  
**I want** to know if my browser is incompatible  
**So that** I can use a supported browser or understand limitations

**Priority:** P2  
**Rationale:** Modern features may not work in old browsers. Set clear expectations.

**Acceptance Criteria:**
- [ ] System detects browser version on load
- [ ] Supported browsers:
  - Chrome/Edge 90+
  - Firefox 88+
  - Safari 14+
  - Mobile: iOS Safari 14+, Chrome Android 90+
- [ ] If unsupported browser detected, show banner:
  - "Your browser is not fully supported. Some features may not work correctly."
  - List of supported browsers
  - Option to continue anyway (remember choice)
- [ ] Graceful degradation for specific features:
  - Markdown editor fallback to textarea
  - Disable advanced formatting if not supported
- [ ] No browser-specific JavaScript errors logged as application errors

**Technical Notes:**
- Use feature detection (not user agent sniffing)
- Implement polyfills for critical features
- Test on minimum supported browser versions
- Progressive enhancement approach

---

## Global Error Handling Strategy

### Error Categories

| Category | User Visibility | Logging | Recovery |
|----------|----------------|---------|----------|
| **Critical** | Modal/Page block | Immediate alert | Manual intervention |
| **High** | Banner message | Log + monitor | Auto-retry + degrade |
| **Medium** | Toast notification | Log | Auto-retry |
| **Low** | Console only | Log | Silent recovery |

### Error Response Format (API)

```json
{
  "error": {
    "code": "S3_UNAVAILABLE",
    "message": "Storage service is temporarily unavailable",
    "userMessage": "We're having trouble saving changes. Please try again in a few minutes.",
    "timestamp": "2026-01-12T10:30:00Z",
    "requestId": "req-abc123",
    "retryable": true,
    "retryAfter": 60
  }
}
```

### Retry Logic

- **Transient errors**: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Service unavailable**: Circuit breaker pattern (fail fast after 3 failures)
- **Network errors**: Retry up to 3 times
- **User errors**: No automatic retry (require user action)

### Logging Standards

All errors must be logged with:
- Timestamp
- User ID (if authenticated)
- Request ID
- Error code and message
- Stack trace (server-side only)
- Context (page being accessed, action being performed)
- Browser/device info (for client-side errors)

**Do NOT log:**
- Passwords or tokens
- Personal identifiable information (PII)
- Full page content (store page ID instead)

---

## Edge Cases

### Extremely Large Pages
- **Issue**: Pages with >100,000 characters may cause performance issues
- **Handling**:
  - Warn user at 50,000 characters: "This page is getting very large. Consider splitting it."
  - Block save at 200,000 characters: "Page too large. Please split into multiple pages."
  - Lazy load content in editor (virtualization)
  - Paginate history view for large pages

### Special Characters in Page Names
- **Issue**: Some characters break URLs or filesystem operations
- **Handling**:
  - Validate page names: alphanumeric, spaces, hyphens, underscores only
  - Auto-generate URL-safe slugs (e.g., "My Page!" → "my-page")
  - Show both display name and slug to user
  - Prevent duplicate slugs with numeric suffix

### Orphaned Files
- **Issue**: Files uploaded but not attached to any page
- **Handling**:
  - Weekly job identifies orphaned files (not referenced in any page)
  - Files kept for 30 days after becoming orphaned
  - Admin report shows orphaned files for review
  - Option to delete or attach to a page

### Circular Page Links
- **Issue**: Page A links to Page B links back to Page A (navigation loops)
- **Handling**:
  - Detect circular references when building breadcrumbs
  - Limit breadcrumb depth to 10 levels
  - Show "..." for circular paths
  - Allow navigation but warn user in UI

### User Deleted Mid-Session
- **Issue**: Admin deletes user account while user is actively using the system
- **Handling**:
  - Current session continues until next auth check (5 minutes)
  - After auth check, user logged out with message: "Your account has been deactivated"
  - User's in-progress edits saved to admin-accessible archive
  - Option for admin to reassign user's pages

### Clock Skew Issues
- **Issue**: Client and server clocks out of sync
- **Handling**:
  - Server-side timestamps are source of truth
  - Display all times in user's local timezone
  - Use relative times ("5 minutes ago") when possible
  - Sync client clock with server on page load (NTP)

### Quota Exceeded
- **Issue**: Storage quota or API rate limits exceeded
- **Handling**:
  - Storage quota: Block new uploads, allow edits, show banner to admin
  - API rate limit: Queue requests, show spinner, inform user of delay
  - Admin dashboard shows quota usage with projections
  - Warning emails at 80%, 90%, 95% quota usage

---

## Testing Requirements

### Error Simulation Tests
- [ ] Simulate S3 outage (disconnect network to S3 endpoint)
- [ ] Simulate concurrent edits (two users, same page, <10s apart)
- [ ] Simulate network interruption mid-upload
- [ ] Simulate malformed JSON in page data
- [ ] Simulate authentication service timeout
- [ ] Simulate OpenSearch unavailability

### Load Testing
- [ ] Test error handling under high load (100+ concurrent users)
- [ ] Test retry logic doesn't cause cascade failures
- [ ] Test circuit breaker activates correctly

### Security Testing
- [ ] Verify XSS prevention in error messages
- [ ] Verify error messages don't leak sensitive data
- [ ] Test rate limiting effectiveness
- [ ] Test SQL injection prevention

---

## Monitoring & Alerting

### Key Metrics to Monitor
- Error rate by type (per minute)
- Failed authentication attempts
- S3 request failure rate
- Page load time (P95, P99)
- Concurrent edit conflicts
- Search unavailability duration

### Alert Thresholds
- **Critical**: S3 error rate >5% for 2 minutes → Page admin immediately
- **High**: Authentication failure rate >10% for 5 minutes → Alert admin
- **Medium**: Page load P95 >3 seconds for 10 minutes → Alert admin
- **Low**: Daily summary of all errors → Email admin

### Health Check Endpoints
- `/health` - Overall system health
- `/health/storage` - S3 connectivity
- `/health/auth` - Authentication service
- `/health/search` - OpenSearch cluster

---

## Future Considerations
- Offline mode with full sync when back online (PWA)
- Automatic conflict resolution with AI-assisted merging
- Distributed consensus for real-time collaborative editing
- Machine learning for predicting and preventing errors
- Self-healing capabilities for common failures

---

## Open Questions
- [ ] Should we implement optimistic UI updates with rollback?
- [ ] What's the acceptable data loss window (Recovery Point Objective)?
- [ ] Should we cache entire site for offline viewing?
- [ ] How long should we retain error logs (storage cost vs debugging value)?

---

**Document Version:** 1.0  
**Last Updated:** January 12, 2026  
**Status:** Draft - Ready for Review
