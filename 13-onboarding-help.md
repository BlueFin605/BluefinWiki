# 13. Onboarding & Help System

## Overview
The Onboarding & Help System provides new and existing users with guidance on using BlueFinWiki effectively. This includes a first-time user experience, contextual help throughout the application, and quick reference materials for Markdown syntax.

## Constitutional Alignment
- **Simplicity & Ease of Use**: Aligns with "intuitive for all ages" by providing clear guidance
- **Family-Friendly**: Makes the wiki accessible to users of all technical levels
- **Progressive Enhancement**: Help is available but doesn't obstruct experienced users

## User Stories

### US-13.1: First-Time User Onboarding (P2)
**As a** new user who just accepted an invite  
**I want** to see a guided walkthrough of key features  
**So that** I can quickly understand how to use the wiki

**Acceptance Criteria:**
- On first login, user sees a welcome modal/overlay with "Start Tour" and "Skip" options
- Tour includes 5-7 key steps:
  1. Welcome & overview (what this wiki is for)
  2. Navigation (folders, pages, search)
  3. Creating a page
  4. Using the Markdown editor
  5. Adding links and attachments
  6. Finding help later
  7. Tour complete with link to more help
- Each step highlights the relevant UI element
- User can navigate: Next, Back, Skip Tour, or close (×)
- Tour progress is saved (user can resume if interrupted)
- After completing/skipping, tour doesn't show again automatically
- User can manually restart tour from Help menu
- Tour adapts based on user role (Admin sees admin features, Viewer doesn't see editing)

**Priority Rationale:** P2 - Significantly improves first-time experience, but not blocking for MVP. Users can learn by exploring.

**Technical Notes:**
- Use a lightweight tour library (e.g., Shepherd.js, Intro.js, or Driver.js)
- Store tour completion status in user preferences (DynamoDB)
- Make tour dismissible and non-blocking
- Ensure tour works on mobile (touch-friendly)

**Dependencies:**
- User authentication system (2-user-authentication.md)
- User preferences storage
- All core features being toured

---

### US-13.2: Markdown Help Reference (P1)
**As a** user editing a page  
**I want** quick access to Markdown syntax help  
**So that** I can format my content without leaving the editor

**Acceptance Criteria:**
- Editor has a "Markdown Help" button/icon (? or "help" icon) in toolbar
- Clicking opens a side panel or modal with Markdown syntax reference
- Reference includes common syntax with examples:
  - **Headings** (# ## ###)
  - **Bold** (`**bold**`) and *italic* (`*italic*`)
  - **Lists** (ordered and unordered)
  - **Links** (`[text](url)`)
  - **Images** (`![alt](url)`)
  - **Code blocks** (inline and fenced)
  - **Blockquotes** (`>`)
  - **Tables** (basic syntax)
  - **Horizontal rules** (`---`)
- Each example shows both the Markdown code and the rendered result
- Reference is searchable/filterable (optional for P1, required for P2)
- Panel/modal is closable and doesn't block editing
- "Copy" button next to each example to copy syntax to clipboard
- Link to external full Markdown documentation (if desired)

**Priority Rationale:** P1 - Essential for non-technical users who are the primary audience. Without this, users may struggle with Markdown.

**Technical Notes:**
- Static content (can be a JSON/Markdown file)
- Render examples using the same Markdown parser as the editor
- Side panel preferred over modal for better UX (user can see editor while referencing)
- Make responsive for mobile (collapse to modal on small screens)

**Dependencies:**
- Markdown editor (5-page-links.md)
- Markdown parser/renderer

---

### US-13.3: Contextual Help Throughout App (P2)
**As a** user navigating the wiki  
**I want** help hints and tooltips on unfamiliar features  
**So that** I can understand what actions are available without extensive training

**Acceptance Criteria:**
- Tooltips appear on hover (desktop) or tap-and-hold (mobile) for:
  - All toolbar buttons in editor (e.g., "Bold (Ctrl+B)")
  - Action buttons (e.g., "Create New Page", "Upload Attachment")
  - Settings/configuration options
  - Role badges in user management
- Tooltips are concise (1 sentence max)
- Tooltips include keyboard shortcuts where applicable
- Help icon (?) next to complex features opens inline explanation
- Inline explanations can be expanded/collapsed
- Empty states include helpful guidance:
  - Empty folder: "This folder has no pages yet. Create your first page."
  - No search results: "No pages found. Try different keywords or browse folders."
  - New wiki: "Welcome! Create your first page to get started."
- Error messages include helpful suggestions (e.g., "File too large. Maximum size is 10MB. Try compressing your image.")

**Priority Rationale:** P2 - Improves usability significantly, but wiki is usable without it. Can be added iteratively.

**Technical Notes:**
- Use semantic HTML (`title` attributes) for basic tooltips
- Consider a tooltip library for advanced features (e.g., Tippy.js)
- Ensure tooltips don't obstruct content
- Make keyboard-accessible (tooltips appear on focus, not just hover)
- Translations-ready (if multi-language support planned)

**Dependencies:**
- All UI components
- Accessibility requirements (WCAG 2.1 AA)

---

### US-13.4: Help Center/Documentation Page (P2)
**As a** user who needs detailed help  
**I want** a dedicated help section with comprehensive documentation  
**So that** I can find answers to specific questions

**Acceptance Criteria:**
- Help link in main navigation (e.g., header or user menu)
- Help page includes:
  - **Getting Started** guide (expanded version of onboarding tour)
  - **User Guides** by role (Admin, Editor, Viewer)
  - **Common Tasks** (how-to guides):
    - Creating and organizing pages
    - Formatting with Markdown
    - Adding images and attachments
    - Linking between pages
    - Using search effectively
    - Managing users (admin only)
  - **Keyboard Shortcuts** reference
  - **Troubleshooting/FAQ**
  - **Contact/Support** information
- Help content is searchable
- Help pages are themselves wiki pages (dogfooding) OR static Markdown files
- Help center is accessible to all users (Viewer role can see it)
- Mobile-friendly layout

**Priority Rationale:** P2 - Nice to have for comprehensive support, but inline help and Markdown reference cover most needs for MVP.

**Technical Notes:**
- If using wiki pages: Create a special "Help" folder with restricted edit permissions
- If static: Use Markdown files rendered with the same parser
- Consider versioning (help content may change with features)
- Keyboard shortcuts should be dynamically generated from actual keybindings

**Dependencies:**
- Page rendering system
- Search (if help is searchable)

---

### US-13.5: Video Tutorials (P3)
**As a** visual learner  
**I want** short video tutorials for key tasks  
**So that** I can see exactly how to use features

**Acceptance Criteria:**
- Video tutorials available in Help Center
- Videos cover:
  - Creating your first page (2-3 min)
  - Using the Markdown editor (3-4 min)
  - Organizing with folders (2 min)
  - Admin: Managing users (3 min)
- Videos are embedded (YouTube, Vimeo, or self-hosted)
- Videos are captioned/subtitled
- Videos work on mobile
- Alternative text descriptions for accessibility

**Priority Rationale:** P3 - Post-MVP enhancement. Requires video production resources. Text/interactive help is sufficient initially.

**Technical Notes:**
- External hosting (YouTube/Vimeo) recommended for bandwidth
- Consider using screen recording tools (Loom, ScreenFlow)
- Keep videos short and focused (< 5 min each)
- Update videos when UI changes significantly

**Dependencies:**
- Help Center (US-13.4)
- Video production and hosting

---

### US-13.6: Interactive Onboarding Checklist (P3)
**As a** new user  
**I want** a checklist of recommended first steps  
**So that** I feel guided in setting up my wiki experience

**Acceptance Criteria:**
- Checklist appears on user dashboard after first login
- Checklist items:
  - ☐ Complete onboarding tour
  - ☐ Create your first page
  - ☐ Add an image or attachment
  - ☐ Link between two pages
  - ☐ Invite a family member (if admin)
  - ☐ Customize your profile
- Items auto-check when completed
- Checklist is collapsible/dismissible
- User can permanently dismiss checklist
- Progress is saved (persists across sessions)

**Priority Rationale:** P3 - Gamification element that improves engagement but not essential for core functionality.

**Technical Notes:**
- Track checklist progress in user preferences/DynamoDB
- Detect completion by listening to relevant user actions
- Make dismissible but retrievable from Help menu

**Dependencies:**
- User dashboard/home page
- User preferences storage
- Activity tracking

---

## Accessibility Requirements (WCAG 2.1 AA)

### Keyboard Navigation
- All help elements (tooltips, modals, tour) are keyboard-accessible
- Tour can be navigated with Tab, Enter, Escape
- Help panel can be opened/closed with keyboard
- Focus management: when help opens, focus moves to help content; when closed, returns to trigger element

### Screen Reader Support
- Tooltips have proper ARIA labels (`aria-describedby`, `role="tooltip"`)
- Tour steps are announced with context ("Step 2 of 7: Navigation")
- Help modals use `role="dialog"` with `aria-modal="true"`
- Code examples in Markdown help have accessible labels

### Visual Design
- Help icons have sufficient color contrast (4.5:1 minimum)
- Tooltips have readable text contrast
- Tour overlays don't completely obscure content (semi-transparent)
- Focus indicators are visible on all interactive help elements

### Mobile Accessibility
- Touch targets are at least 44×44 pixels
- Tooltips work with tap (not just hover)
- Tour is swipeable on mobile
- Help content is scrollable and doesn't overflow viewport

---

## UI/UX Design Notes

### Tour Design
- **Overlay Style**: Semi-transparent dark backdrop (80% opacity) with highlighted element in full color
- **Tooltip Positioning**: Auto-adjust to avoid viewport edges
- **Progress Indicator**: "Step X of Y" with visual dots/progress bar
- **Branding**: Welcome screen includes BlueFinWiki logo and personalized greeting

### Markdown Help Panel
- **Layout**: Right side panel (300-400px wide) or modal on mobile
- **Organization**: Tabs or accordion for categories (Basics, Advanced, Formatting, Links & Media)
- **Examples**: Side-by-side view (Markdown source | Rendered result)
- **Sticky Toolbar**: "Search" and "Close" buttons stay visible while scrolling

### Contextual Help
- **Tooltip Style**: Dark background, light text, subtle shadow, rounded corners
- **Timing**: Appear after 500ms hover, dismiss after 3s of no interaction or on mouse leave
- **Icon Consistency**: Use "?" icon for help, "i" icon for information
- **Placement**: Prefer top/bottom positioning over left/right (more space)

### Help Center
- **Navigation**: Sidebar with collapsible sections (Getting Started, Guides, FAQ, etc.)
- **Search**: Prominent search bar at top
- **Breadcrumbs**: Show user location within help docs
- **Feedback**: "Was this helpful? Yes / No" on each help article

---

## Non-Functional Requirements

### Performance
- Tour library should be < 50KB gzipped
- Tooltip rendering should not cause layout jank
- Help content should load within 1 second
- Markdown help examples should render instantly (pre-rendered or cached)

### Scalability
- Help content should be modular (easy to add/update articles)
- Tour steps should be configurable (JSON/YAML file)
- Markdown help should support i18n (internationalization) structure

### Security
- Help content is read-only for non-admin users
- XSS protection in user-generated help content (if allowing community contributions)
- No sensitive information exposed in help examples

### Maintainability
- Help content version-controlled (Git)
- Tour steps documented with screenshots in repo
- Markdown help is a single source of truth (not duplicated across codebase)

---

## Technical Architecture

### Components

```
/help
  /components
    OnboardingTour.tsx       # Interactive tour component
    MarkdownHelpPanel.tsx    # Side panel with Markdown reference
    ContextualTooltip.tsx    # Reusable tooltip component
    HelpCenter.tsx           # Help documentation page
    HelpSearch.tsx           # Search within help content
    
  /data
    tour-steps.json          # Tour configuration
    markdown-help.json       # Markdown syntax examples
    keyboard-shortcuts.json  # Shortcut reference
    
  /hooks
    useOnboarding.ts         # Track onboarding progress
    useTooltip.ts           # Tooltip logic
```

### Data Models

**User Preferences (DynamoDB)**
```json
{
  "userId": "user-uuid",
  "onboarding": {
    "tourCompleted": true,
    "tourLastStep": 7,
    "checklistDismissed": false,
    "checklist": {
      "completedTour": true,
      "createdPage": true,
      "addedAttachment": false,
      "linkedPages": true,
      "invitedUser": false,
      "customizedProfile": true
    }
  },
  "helpPreferences": {
    "markdownPanelLastOpened": "2026-01-10T14:23:00Z"
  }
}
```

**Tour Step Configuration (JSON)**
```json
{
  "steps": [
    {
      "id": "welcome",
      "target": null,
      "title": "Welcome to BlueFinWiki!",
      "content": "Let's take a quick tour of the key features...",
      "placement": "center",
      "showSkip": true
    },
    {
      "id": "navigation",
      "target": "#sidebar-nav",
      "title": "Navigation",
      "content": "Browse pages and folders here...",
      "placement": "right",
      "highlightTarget": true
    }
  ]
}
```

---

## Integration Points

### With User Authentication (2-user-authentication.md)
- Detect first login to trigger onboarding tour
- Store help preferences in user profile

### With Markdown Editor (5-page-links.md)
- Integrate Markdown Help button in editor toolbar
- Share Markdown parser/renderer for consistent examples

### With User Management (8-user-management.md)
- Show admin-specific tour steps only to admins
- Include user management help in admin guides

### With Search (7-search.md)
- Make help content searchable
- Help Center has its own search for help articles

---

## Testing Strategy

### Unit Tests
- Tour navigation (next, back, skip, close)
- Tooltip rendering with different placements
- Markdown help examples render correctly
- Onboarding checklist state updates

### Integration Tests
- Tour completion updates user preferences
- Markdown help opens from editor
- Help Center search returns relevant results
- Keyboard navigation through tour

### E2E Tests
- New user completes onboarding tour
- User opens Markdown help, copies example, pastes in editor
- User navigates Help Center and finds article
- Mobile: Tour works on tablet/phone screen sizes

### Accessibility Tests
- Screen reader announces tour steps correctly
- All help elements keyboard-navigable
- Focus management works (trap focus in modal, return focus on close)
- Color contrast meets WCAG AA (4.5:1)

### Usability Tests
- Observe first-time users completing tour (without external help)
- Test if users can find Markdown help when needed
- Measure time to complete first task with vs. without onboarding
- Gather feedback on help content clarity

---

## Future Enhancements (Post-MVP)

### Intelligent Help Suggestions
- Context-aware help (suggest relevant articles based on user's current action)
- AI-powered help chatbot

### Community Help
- User-contributed tips and tricks
- FAQ generated from common support questions

### Personalized Onboarding
- Different tour tracks based on user role and experience level
- Adaptive checklist based on user goals

### Analytics
- Track which help articles are most viewed
- Identify features where users need most help (improve UX)
- A/B test different onboarding flows

### Gamification
- Badges for completing onboarding milestones
- "Wiki Expert" achievement for advanced features

---

## Open Questions

1. **Tour Trigger**: Should tour auto-play on first login, or require user to click "Start Tour"?
   - **Recommendation**: Auto-show modal with option to start or skip. Less friction but respects user choice.

2. **Help Content Hosting**: Should help articles be wiki pages (dogfooding) or static Markdown?
   - **Recommendation**: Static Markdown initially (easier to maintain, no risk of accidental edits). Consider wiki pages post-MVP.

3. **Video Hosting**: Self-host videos or use YouTube/Vimeo?
   - **Recommendation**: YouTube (unlisted) for bandwidth efficiency. Self-host if privacy is critical.

4. **Markdown Help Scope**: Include advanced Markdown extensions (e.g., footnotes, task lists)?
   - **Recommendation**: Start with CommonMark basics. Add extensions in v2 if Markdown parser supports them.

5. **Multi-language Support**: Should help be translatable?
   - **Recommendation**: Structure for i18n from start (use JSON for strings), but English-only for MVP.

6. **Onboarding for Returning Users**: What if user hasn't logged in for 6 months and UI changed?
   - **Recommendation**: "What's New" banner for significant updates. Optional re-tour for major UI changes.

---

## Success Metrics

- **Onboarding Completion Rate**: % of new users who complete tour (target: >60%)
- **Time to First Page Created**: Measure days from signup to first page (target: <1 day)
- **Help Content Usage**: % of users who access Markdown help or Help Center (target: >40% in first week)
- **Support Ticket Reduction**: Decrease in "How do I...?" questions after implementing help system
- **User Satisfaction**: Survey rating for "Ease of learning BlueFinWiki" (target: >4/5)

---

## Implementation Phases

### Phase 1: Foundation (MVP - P1)
1. Markdown Help Panel in editor
2. Basic tooltips on key buttons
3. Empty state guidance

### Phase 2: Guided Experience (Post-MVP - P2)
4. Onboarding tour
5. Help Center with documentation
6. Contextual help throughout app

### Phase 3: Enhanced Support (Future - P3)
7. Video tutorials
8. Interactive checklist
9. Advanced features (analytics, AI help)

---

## Notes
- Keep help content concise and scannable (users won't read long paragraphs)
- Use screenshots/GIFs in help docs where applicable
- Update help content whenever features change
- Consider accessibility from the start (don't retrofit)
- Test with actual users (especially non-technical family members)
- Markdown help is CRITICAL for MVP since target audience may not know Markdown
