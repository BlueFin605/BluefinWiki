# 12. Configuration & Admin Settings

## Overview
The Configuration & Admin Settings feature provides administrators with comprehensive tools to manage site-wide settings, configure modules/plugins, and monitor system health. This ensures the wiki can be customized to family needs while maintaining operational visibility.

## Cross-References

**Manages Configuration for:**
- All specifications - US-12.3 Module Configuration UI enables/disables optional features
- [2-s3-storage-plugin.md](2-s3-storage-plugin.md) - US-12.5 monitors S3 connection status
- [1-user-authentication.md](1-user-authentication.md) - US-12.4 configures session timeout and password requirements
- [6-page-attachments.md](6-page-attachments.md) - US-12.4 sets max file upload size and allowed types

**System Health Monitoring for:**
- [2-s3-storage-plugin.md](2-s3-storage-plugin.md) - S3 connection status
- [7-wiki-search.md](7-wiki-search.md) - Search service availability (future)
- [1-user-authentication.md](1-user-authentication.md) - Auth service status

**Related:**
- [19-error-handling-edge-cases.md](19-error-handling-edge-cases.md) - US-12.6 error logs for troubleshooting
- [8-user-management.md](8-user-management.md) - Admin role required for access

## Constitutional Alignment
- **Simplicity First**: Admin interface remains clean and intuitive, avoiding overwhelming configuration options
- **Pluggable Architecture**: Module configuration UI supports enabling/disabling plugins without code changes
- **Performance**: System health monitoring ensures the wiki meets <2s load time requirements
- **Family Focus**: Settings prioritize features families need (name, branding, accessibility)

## User Stories

### US-12.1: Site Settings Management (P1)
**As an** Administrator  
**I want to** configure basic site settings (wiki name, logo, theme)  
**So that** the wiki reflects our family's identity and preferences

**Acceptance Criteria:**
- Admin can access Settings page from navigation menu (Admin role only)
- Can edit wiki name (displays in header, page titles, emails)
- Can upload custom logo (max 2MB, PNG/JPG/SVG)
  - Logo preview shown before saving
  - Default BlueFinWiki logo if none uploaded
- Can select from predefined themes:
  - Light (default)
  - Dark
  - High Contrast (WCAG 2.1 AAA)
- Can set default language/locale (for date formats, etc.)
- Can configure timezone for timestamps
- Changes take effect immediately across all pages
- Validation prevents empty wiki name
- Success/error messages displayed after save

**Priority Rationale:**
P1 - Essential for personalization and branding. Families need to make the wiki "theirs" from day one.

---

### US-12.2: Theme Customization (P2)
**As an** Administrator  
**I want to** customize color schemes and visual elements  
**So that** the wiki matches our family's aesthetic preferences

**Acceptance Criteria:**
- Can customize colors for selected theme:
  - Primary color (buttons, links)
  - Secondary color (accents, highlights)
  - Background color
  - Text color
- Color picker with accessibility contrast checker (WCAG 2.1 AA minimum)
- Real-time preview of changes before saving
- "Reset to default" button for each color
- Can upload custom CSS file (advanced users, P3 future enhancement)
- Theme changes persist for all users
- Mobile-responsive theme editor

**Priority Rationale:**
P2 - Nice-to-have for personalization but not critical for MVP. Predefined themes (US-12.1) cover most needs.

---

### US-12.3: Module Configuration UI (P1)
**As an** Administrator  
**I want to** enable/disable plugin modules through a UI  
**So that** I can control which features are active without touching code

**Acceptance Criteria:**
- "Modules" section in admin settings shows all available plugins
- Each module displays:
  - Module name and description
  - Current status (Enabled/Disabled)
  - Toggle switch to enable/disable
  - Version number
  - Dependencies (if any)
- Core modules cannot be disabled (Auth, Storage, Pages)
- Optional modules can be toggled:
  - Comments (future)
  - Export (future)
  - Advanced search (future)
  - Third-party integrations (future)
- Disabling module shows confirmation dialog
- Changes take effect after page refresh (with notification)
- Module status persisted in DynamoDB configuration table
- Error handling if module fails to load/unload

**Priority Rationale:**
P1 - Critical for pluggable architecture. Aligns with constitution's modularity principle.

---

### US-12.4: User Management Settings (P2)
**As an** Administrator  
**I want to** configure user-related settings  
**So that** I can control access and user behavior

**Acceptance Criteria:**
- Can set default user role (Standard/Admin) for new invites
- Can enable/disable user self-registration (off by default for invite-only)
- Can configure session timeout (default 30 days)
- Can set password requirements:
  - Minimum length (default 8)
  - Require uppercase/lowercase/numbers/symbols
- Can enable/disable "Remember Me" on login
- Can configure maximum file upload size (default 10MB)
- Can set allowed file types for attachments
- All settings have sensible defaults
- Changes affect new sessions/actions only (not existing)

**Priority Rationale:**
P2 - Important for security and control but defaults work for MVP. Can be refined post-launch.

---

### US-12.5: System Health Monitoring (P1)
**As an** Administrator  
**I want to** monitor system health and performance metrics  
**So that** I can identify and resolve issues proactively

**Acceptance Criteria:**
- "System Health" dashboard shows:
  - **Service Status:**
    - AWS S3 connection status (green/yellow/red)
    - DynamoDB connection status
    - Lambda function health
    - CloudFront CDN status
  - **Performance Metrics:**
    - Average page load time (target <2s)
    - API response times
    - Error rate (4xx/5xx responses)
  - **Storage Metrics:**
    - Total storage used (pages, attachments)
    - Storage limit (if applicable)
    - Number of pages/attachments
  - **User Statistics (MVP):**
    - Total registered users
  - **User Activity (Post-MVP):**
    - Active users (last 24 hours) [Post-MVP]
    - Recent page edits [Post-MVP]
- Metrics updated every 5 minutes
- Color-coded indicators (green/yellow/red) for each metric
- Click metric to see detailed breakdown
- Export metrics as CSV (P3 future)
- Alert icon if any critical issues detected

**Priority Rationale:**
P1 - Essential for operational visibility. Admin needs to know if AWS services are degraded or costs are ballooning.

---

### US-12.6: Error Logs & Troubleshooting (P2)
**As an** Administrator  
**I want to** view system error logs and diagnostic information  
**So that** I can troubleshoot issues when they occur

**Acceptance Criteria:**
- "Error Logs" section shows recent errors:
  - Timestamp
  - Error type (Auth, Storage, Lambda, etc.)
  - Error message
  - User affected (if applicable)
  - Stack trace (expandable, for developers)
- Can filter logs by:
  - Date range
  - Error type
  - Severity (error/warning/info)
- Pagination for large log sets (50 per page)
- "Clear old logs" button (clears logs older than 30 days)
- Logs stored in CloudWatch Logs
- No sensitive data (passwords, tokens) in logs
- Download logs as JSON (P3 future)

**Priority Rationale:**
P2 - Helpful for troubleshooting but not critical for MVP if CloudWatch Logs accessible directly.

---

### US-12.7: Backup & Restore Configuration (P3)
**As an** Administrator  
**I want to** export and import wiki configuration  
**So that** I can backup settings or migrate to another instance

**Acceptance Criteria:**
- "Export Configuration" button downloads JSON file with:
  - Site settings (name, logo URL, theme)
  - Module enabled/disabled states
  - User management settings
  - Does NOT include user data or page content
- "Import Configuration" uploads JSON file
  - Validates JSON structure before import
  - Confirmation dialog showing what will change
  - Rollback option if import fails
- Export includes timestamp and version number
- Imported config merged with existing (doesn't overwrite everything)
- Audit log entry created for import/export actions

**Priority Rationale:**
P3 - Nice-to-have for advanced scenarios but not essential for single-family wikis in MVP.

---

### US-12.8: Email Notification Settings (P2)
**As an** Administrator  
**I want to** configure email notification behavior  
**So that** users receive appropriate alerts without spam

**Acceptance Criteria:**
- Can enable/disable notification types:
  - User invitations (always enabled)
  - Password resets (always enabled)
  - Page change notifications (optional)
  - Comment notifications (optional, future)
  - Digest emails (optional, future)
- Can configure "From" email address and name
- Can customize email templates (P3 future)
- Can set notification frequency (immediate/daily/weekly digest)
- Test email button to verify settings
- Uses AWS SES for email delivery
- Email settings stored in DynamoDB config table

**Priority Rationale:**
P2 - Important for user engagement but basic email (invites, password resets) sufficient for MVP.

---

### US-12.9: Search & Indexing Configuration (P2)
**As an** Administrator  
**I want to** configure search behavior and indexing  
**So that** search results meet our family's needs

**Acceptance Criteria:**
- Can enable/disable search features:
  - Full-text search (always enabled)
  - Tag search
  - User search
  - Attachment content search
- Can configure search result limits (default 50)
- Can trigger manual reindex of all pages
  - Shows progress indicator
  - Estimated time to complete
- Can exclude specific folders from search (e.g., "Drafts")
- Can configure search relevance weights:
  - Page title (high)
  - Page content (medium)
  - Tags (medium)
  - Metadata (low)
- Search settings take effect immediately

**Priority Rationale:**
P2 - Enhances search capability but default settings work well for most use cases.

---

### US-12.10: Accessibility Settings (P1)
**As an** Administrator  
**I want to** configure accessibility features  
**So that** the wiki meets WCAG 2.1 AA standards

**Acceptance Criteria:**
- Can enable/disable accessibility features:
  - High contrast mode option for users
  - Screen reader optimizations
  - Keyboard navigation enhancements
  - Focus indicators
- Can set minimum font size (default 16px)
- Can enable "Skip to content" link
- Can configure alt text requirements for images:
  - Warning if alt text missing
  - Block upload if alt text empty (optional)
- Accessibility checker built into settings
  - Scans current theme for WCAG violations
  - Shows color contrast ratios
  - Suggests fixes
- "Accessibility Statement" page generator (P3 future)

**Priority Rationale:**
P1 - Constitution mandates WCAG 2.1 AA compliance. Admin must have tools to ensure this.

---

## Technical Specifications

### Configuration Storage
```javascript
// DynamoDB Table: bluefin-config
{
  "configKey": "site-settings",
  "configValue": {
    "wikiName": "The Smith Family Wiki",
    "logoUrl": "s3://bluefin-attachments/logo.png",
    "theme": "light",
    "timezone": "America/New_York",
    "locale": "en-US"
  },
  "lastModified": "2026-01-12T14:30:00Z",
  "modifiedBy": "admin@example.com"
}

{
  "configKey": "modules",
  "configValue": {
    "comments": false,
    "export": false,
    "advancedSearch": true
  }
}

{
  "configKey": "user-settings",
  "configValue": {
    "defaultRole": "Standard",
    "sessionTimeout": 30,
    "maxUploadSize": 10485760, // 10MB in bytes
    "allowedFileTypes": ["pdf", "docx", "jpg", "png", "gif"]
  }
}
```

### API Endpoints
```
GET  /api/admin/config/:configKey        # Fetch specific config
PUT  /api/admin/config/:configKey        # Update config
GET  /api/admin/health                   # System health metrics
GET  /api/admin/logs?type=error&date=... # Error logs
POST /api/admin/reindex                  # Trigger search reindex
GET  /api/admin/modules                  # List all modules
PUT  /api/admin/modules/:moduleId        # Enable/disable module
```

### Health Check Integration
```javascript
// Lambda function: checkSystemHealth
async function checkHealth() {
  return {
    s3: await checkS3Connection(),
    dynamodb: await checkDynamoDBConnection(),
    cloudfront: await checkCloudFrontStatus(),
    metrics: {
      avgLoadTime: await getAvgPageLoadTime(),
      errorRate: await getErrorRate(),
      storageUsed: await getStorageUsed()
    }
  };
}
```

### Module Lifecycle
```javascript
// Plugin registry
const modules = {
  "comments": {
    name: "Comments",
    description: "Enable page comments and discussions",
    version: "1.0.0",
    enabled: false,
    dependencies: [],
    onEnable: () => { /* load routes, UI components */ },
    onDisable: () => { /* cleanup */ }
  }
};
```

---

## UI/UX Design

### Settings Navigation
```
Admin Settings (Left Sidebar)
├── Site Settings
├── Theme Customization
├── Modules
├── User Management
├── System Health
├── Error Logs
├── Search Configuration
└── Accessibility
```

### Site Settings Screen
```
┌──────────────────────────────────────┐
│ Site Settings                    [?] │
├──────────────────────────────────────┤
│                                      │
│ Wiki Name *                          │
│ [The Smith Family Wiki          ]   │
│                                      │
│ Logo                                 │
│ ┌────────┐                           │
│ │ [logo] │  [Upload New] [Remove]   │
│ └────────┘                           │
│                                      │
│ Theme                                │
│ ○ Light  ● Dark  ○ High Contrast    │
│                                      │
│ Timezone                             │
│ [America/New_York            ▼]     │
│                                      │
│ Language                             │
│ [English (US)                ▼]     │
│                                      │
│         [Cancel]  [Save Changes]    │
└──────────────────────────────────────┘
```

### System Health Dashboard
```
┌──────────────────────────────────────┐
│ System Health           Last updated │
│                         2 minutes ago │
├──────────────────────────────────────┤
│                                      │
│ Service Status                       │
│ ✓ AWS S3               Operational   │
│ ✓ DynamoDB             Operational   │
│ ⚠ Lambda Functions     Degraded      │
│ ✓ CloudFront CDN       Operational   │
│                                      │
│ Performance Metrics                  │
│ Avg Page Load:  1.4s  ✓ (< 2s)      │
│ API Response:   120ms ✓              │
│ Error Rate:     0.2%  ✓ (< 1%)      │
│                                      │
│ Storage & Usage                      │
│ Storage Used:   2.3 GB               │
│ Total Pages:    487                  │
│ Attachments:    1,234                │
│                                      │
│ User Statistics                      │
│ Total Users:    25                   │
│                                      │
│ [Activity tracking: Post-MVP]        │
│                                      │
│         [Refresh] [Export Report]    │
└──────────────────────────────────────┘
```

### Module Configuration
```
┌──────────────────────────────────────┐
│ Modules                              │
├──────────────────────────────────────┤
│                                      │
│ Core Modules (Cannot be disabled)    │
│                                      │
│ ✓ Authentication v1.0.0              │
│   User authentication and sessions   │
│                                      │
│ ✓ Storage v1.0.0                     │
│   S3-based file and page storage     │
│                                      │
│ ✓ Pages v1.0.0                       │
│   Core wiki page functionality       │
│                                      │
│ Optional Modules                     │
│                                      │
│ Comments v1.0.0          [○ Enable]  │
│ Page comments and discussions        │
│                                      │
│ Export v1.0.0            [○ Enable]  │
│ Export pages to PDF/HTML             │
│                                      │
│ Advanced Search v1.1.0   [● Enabled] │
│ Full-text search with filters        │
│                                      │
└──────────────────────────────────────┘
```

---

## Edge Cases & Error Handling

### Logo Upload Failures
- **Case**: User uploads file >2MB
  - **Handling**: Show error "Logo must be smaller than 2MB. Please choose a smaller file."
  
- **Case**: User uploads non-image file
  - **Handling**: Show error "Logo must be PNG, JPG, or SVG format."

- **Case**: S3 upload fails
  - **Handling**: Show error "Failed to upload logo. Please try again." Keep existing logo unchanged.

### Module Enable/Disable Failures
- **Case**: Module has dependencies that aren't enabled
  - **Handling**: Show warning "This module requires [dependency]. Enable [dependency] first?"

- **Case**: Disabling module that others depend on
  - **Handling**: Show error "Cannot disable. The following modules depend on this: [list]"

- **Case**: Module fails to load after enabling
  - **Handling**: Auto-disable module, show error "Module failed to load. Check error logs for details."

### Health Monitoring Edge Cases
- **Case**: AWS service temporarily unavailable
  - **Handling**: Show "Checking..." status, retry 3 times before showing "Degraded"

- **Case**: Metrics data not available
  - **Handling**: Show "No data available" instead of breaking UI

- **Case**: Storage approaching limit (if applicable)
  - **Handling**: Show warning banner "Storage 90% full. Consider archiving old attachments."

### Configuration Import/Export
- **Case**: Imported JSON has invalid structure
  - **Handling**: Show error "Invalid configuration file. Please check the format." Don't apply anything.

- **Case**: Imported config has newer version than current
  - **Handling**: Show warning "This configuration is from a newer version. Some settings may not apply."

### Concurrent Admin Changes
- **Case**: Two admins edit settings simultaneously
  - **Handling**: Last write wins. Show notification "Settings were updated by another admin. Please review."

### Theme Customization
- **Case**: Custom colors fail WCAG contrast check
  - **Handling**: Show warning "These colors may not meet accessibility standards (contrast ratio: 2.1:1, need 4.5:1)"
  - Allow save with acknowledgment or block save (configurable)

---

## Performance Considerations

### Config Caching
- Cache configuration in CloudFront edge locations (5 min TTL)
- Invalidate cache when settings change
- Lambda fetches config from DynamoDB once, caches in memory for 1 minute

### Health Check Optimization
- Run health checks in parallel (Promise.all)
- Cache health results for 5 minutes
- Use CloudWatch metrics API for performance data (pre-aggregated)

### Module Loading
- Lazy-load module code only when enabled
- Use dynamic imports: `await import('./modules/comments.js')`
- Preload critical modules at app startup

### Log Pagination
- Query logs in batches (50 per page)
- Use DynamoDB pagination tokens
- Implement virtual scrolling for large log sets

---

## Security Considerations

### Role-Based Access
- Only Admin role can access `/admin/settings` routes
- API endpoints validate `Authorization` header + role claim
- Non-admins get 403 Forbidden

### Sensitive Data Protection
- Never log passwords, API keys, tokens
- Redact email addresses in exported logs (show first 3 chars only)
- Configuration exports don't include secrets

### Input Validation
- Sanitize all user inputs (wiki name, logo filename)
- Validate file types server-side (don't trust client MIME type)
- Prevent XSS in theme customization (sanitize CSS)

### Audit Trail
- Log all configuration changes to DynamoDB audit table:
  - Who changed what
  - Old value → New value
  - Timestamp
- Retain audit logs for 90 days minimum

### Module Security
- Modules run in isolated context (no direct DB access)
- Module manifest declares required permissions
- Admin can review module permissions before enabling

---

## Testing Scenarios

### Functional Tests
1. Admin can update wiki name and see it reflected in header
2. Admin can upload logo and it displays correctly
3. Admin can switch themes and all users see new theme
4. Admin can enable module and new features appear
5. Admin can disable module and features are hidden
6. Health dashboard shows accurate metrics
7. Error logs display recent errors with pagination
8. Configuration export creates valid JSON file
9. Configuration import applies settings correctly
10. Accessibility checker identifies WCAG violations

### Security Tests
1. Non-admin users cannot access admin settings (403)
2. Invalid JWT tokens rejected
3. Malicious file uploads blocked (e.g., PHP disguised as JPG)
4. XSS attempts in wiki name/theme sanitized
5. SQL injection attempts in log filters handled safely

### Performance Tests
1. Settings page loads in <2s with all sections
2. Health dashboard refreshes in <3s
3. Module enable/disable completes in <5s
4. Log pagination handles 10,000+ entries smoothly
5. Theme changes apply across all users in <10s

### Edge Case Tests
1. Upload logo exactly at 2MB limit (should succeed)
2. Upload logo at 2MB + 1 byte (should fail)
3. Enable module with missing dependencies (should warn)
4. Import config from newer version (should warn)
5. Two admins change settings simultaneously (last write wins)
6. AWS services unavailable (graceful degradation)

---

## Accessibility Requirements (WCAG 2.1 AA)

### Keyboard Navigation
- All settings controls accessible via Tab key
- Toggle switches operable with Space/Enter
- Focus indicators visible (3px outline)

### Screen Reader Support
- Form labels properly associated with inputs
- ARIA labels for icon-only buttons ("Upload Logo", "Refresh Health")
- Live regions announce setting changes ("Wiki name updated successfully")

### Visual Design
- Minimum font size 16px in settings UI
- Color contrast ≥4.5:1 for all text
- Status indicators use icons + text (not just color)
  - ✓ Green = Operational
  - ⚠ Yellow = Degraded
  - ✗ Red = Unavailable

### Error Messages
- Clearly worded, actionable guidance
- Associated with form fields via aria-describedby
- Not reliant on color alone

---

## Future Enhancements (Post-MVP)

### P3 Features
1. **Advanced Theme Builder**: Visual CSS editor with live preview
2. **Scheduled Maintenance Mode**: Set maintenance windows, show custom message
3. **Multi-Language Support**: Translate UI based on user preference
4. **Custom Email Templates**: Drag-and-drop email designer
5. **Webhook Integrations**: Trigger external services on config changes
6. **Role Permissions Editor**: Custom roles beyond Admin/Standard (future enhancement)
7. **Automated Backups**: Schedule daily config + data backups
8. **Performance Alerts**: Email admin if load time exceeds threshold
9. **Usage Analytics**: Page views, popular pages, user engagement
10. **API Key Management**: Generate API keys for external integrations

### Integration Ideas
- Slack/Discord notifications for system alerts
- Google Analytics integration (opt-in)
- Sentry for error tracking
- Datadog/New Relic for APM

---

## Success Metrics

### User Satisfaction
- Admin completes initial setup (name, logo, theme) in <5 minutes
- 90% of admins successfully enable/disable modules without documentation

### System Reliability
- Health dashboard correctly identifies service degradations within 5 minutes
- Error logs capture 100% of critical errors
- Zero false positives in health checks

### Performance
- Settings page loads in <2s (P95)
- Configuration changes propagate to all users in <30s
- Module enable/disable completes in <5s

### Accessibility
- Settings UI passes WCAG 2.1 AA automated tests (aXe, Lighthouse)
- Keyboard-only users can complete all admin tasks
- Screen reader users report positive experience

---

## Open Questions

1. **Logo dimensions**: Should we enforce aspect ratio or allow any dimensions? (Suggest: recommend 200x50px but allow any)

2. **Theme customization limits**: How many custom colors can admin set? (Suggest: 5 core colors to prevent overwhelming choices)

3. **Health check alerts**: Should admins receive email/SMS if critical service goes down? (P2 enhancement)

4. **Configuration versioning**: Should we track config change history beyond audit log? (P3 enhancement)

5. **Module marketplace**: Future vision for third-party modules? (Post-MVP)

6. **Multi-admin coordination**: If multiple admins, should we show "Admin X is currently editing settings"? (P3 enhancement)

7. **Backup retention**: How long should config backups be retained? (Suggest: 30 days)

8. **Performance benchmarks**: Should health dashboard compare current metrics to historical baselines? (P2 enhancement)

---

## Dependencies

### Upstream Dependencies (Must Exist First)
- **US-6.1**: User roles (Admin role must exist to access settings)
- **US-1.1**: S3 storage architecture (for logo upload)
- **US-8.1**: Search functionality (for reindexing feature)

### Downstream Dependencies (Depend on This)
- **US-10.X**: Comments module (module config UI must exist first)
- **US-11.X**: Export module (module config UI must exist first)
- Any future plugin features

### External Dependencies
- AWS CloudWatch for metrics and logs
- AWS SES for email notifications (US-12.8)
- DynamoDB for configuration storage

---

## Implementation Notes

### Phase 1: Core Settings (P1)
- Implement site settings (name, logo, theme)
- Build module configuration UI
- Create system health dashboard
- Basic accessibility settings

### Phase 2: Advanced Config (P2)
- Theme customization beyond presets
- User management settings
- Error log viewer
- Email notification settings
- Search configuration

### Phase 3: Power Features (P3)
- Configuration backup/restore
- Advanced accessibility checker
- Performance analytics
- Custom CSS upload
- Webhook integrations

### Development Estimates
- **US-12.1 (Site Settings)**: 3 days
- **US-12.3 (Module Config)**: 5 days
- **US-12.5 (System Health)**: 4 days
- **US-12.10 (Accessibility)**: 3 days
- **US-12.2 (Theme Customization)**: 4 days
- **US-12.4 (User Management)**: 3 days
- **US-12.6 (Error Logs)**: 3 days
- **US-12.8 (Email Settings)**: 2 days
- **US-12.9 (Search Config)**: 2 days
- **US-12.7 (Backup/Restore)**: 3 days

**Total Estimated Effort**: 32 days (P1: 15 days, P2: 14 days, P3: 3 days)

---

## Conclusion

The Configuration & Admin Settings feature provides administrators with the essential tools to customize, manage, and monitor the BlueFinWiki. By prioritizing P1 features (site settings, module config, system health, accessibility), the MVP delivers a self-service admin experience aligned with the constitution's principles of simplicity, modularity, and family focus.

The phased approach allows incremental delivery while maintaining flexibility for future enhancements based on real-world admin feedback.
