# Feature Specification: Mobile Experience

**Feature Branch**: `12-mobile-experience`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: User description: "Specific mobile UX considerations for editing, navigation on small screens"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mobile-Optimized Page Navigation (Priority: P1)

A mobile user navigates through the wiki hierarchy, accesses pages, and uses core navigation features on a small screen without usability issues.

**Why this priority**: Family members frequently access wikis from phones and tablets. Without mobile-optimized navigation, the wiki becomes unusable for a significant portion of users, violating the "family-friendly" principle.

**Independent Test**: Open wiki on mobile device (or browser with 375px viewport), navigate from home page through folder hierarchy to a specific page, use breadcrumbs to go back, and access search - verify all tap targets are appropriately sized and layout adapts correctly.

**Acceptance Scenarios**:

1. **Given** a user accesses the wiki on mobile device, **When** viewing the page list, **Then** each page/folder item has minimum 44px touch target height with adequate spacing
2. **Given** a mobile user viewing a page, **When** they want to navigate, **Then** a collapsible hamburger menu provides access to folder tree and navigation options
3. **Given** the folder tree menu is open, **When** a user taps a folder, **Then** it expands/collapses with smooth animation and shows child pages
4. **Given** a mobile user on a page, **When** they view breadcrumbs, **Then** breadcrumbs wrap gracefully or truncate middle segments showing "Home > ... > Current Page"
5. **Given** a user scrolls down a long page on mobile, **When** they need navigation, **Then** a floating "back to top" and "menu" button appears for quick access

---

### User Story 2 - Mobile Markdown Editor Experience (Priority: P1)

A mobile user creates or edits wiki pages using a mobile-optimized markdown editor with touch-friendly controls and appropriate keyboard handling.

**Why this priority**: Content creation is core functionality. Mobile users must be able to contribute content, especially for quick updates or on-the-go documentation. This directly supports the "family-friendly" principle.

**Independent Test**: Open a page for editing on mobile device, use the formatting toolbar, type markdown content with mobile keyboard, switch between edit and preview modes, save changes - verify all controls are touch-friendly and keyboard doesn't obscure content.

**Acceptance Scenarios**:

1. **Given** a mobile user clicks "Edit" on a page, **When** the editor loads, **Then** it defaults to a single-pane view (not split-pane) optimized for mobile screen width
2. **Given** the mobile editor is active, **When** the virtual keyboard appears, **Then** the editor viewport adjusts to remain visible above the keyboard
3. **Given** a user is editing on mobile, **When** they tap the formatting toolbar, **Then** toolbar buttons have minimum 44px touch targets with icons clearly visible
4. **Given** a mobile editor, **When** a user needs to preview, **Then** a prominent toggle button switches between "Edit" and "Preview" modes (not simultaneous)
5. **Given** a user types in the mobile editor, **When** they insert markdown syntax via toolbar, **Then** the markdown is inserted at cursor position with proper formatting
6. **Given** a mobile editing session, **When** a user rotates device to landscape, **Then** the editor adapts layout utilizing additional width while maintaining usability
7. **Given** a mobile user wants to save, **When** they tap "Save" button, **Then** button is sticky/fixed at top or bottom for easy access regardless of scroll position

---

### User Story 3 - Touch-Optimized Search and Quick Actions (Priority: P1)

A mobile user performs wiki search, accesses quick actions (create page, upload attachment), and uses common features through touch-optimized interfaces.

**Why this priority**: Search is a critical discovery tool, and quick actions enable productivity. Mobile users need efficient access to core features without desktop-centric UI patterns.

**Independent Test**: On mobile device, open search, type query using mobile keyboard, view results, tap a result to navigate - verify search UI is optimized for mobile and results are easily tappable.

**Acceptance Scenarios**:

1. **Given** a mobile user taps the search icon, **When** the search interface opens, **Then** it expands to full-screen modal with large search input and mobile-optimized keyboard
2. **Given** search results are displayed, **When** a user views results, **Then** each result card has minimum 44px height with clear visual separation and full-width tap targets
3. **Given** a mobile user wants quick actions, **When** they tap a floating action button (FAB), **Then** a radial or sheet menu appears with "Create Page", "Upload File", "Scan QR" options
4. **Given** a mobile user views an attachment, **When** they tap an image or PDF, **Then** it opens in a mobile-friendly viewer with pinch-to-zoom and swipe gestures
5. **Given** a user performs a long-press on a page in list view, **When** the gesture completes, **Then** a context menu appears with options like "Edit", "Delete", "Move", "Share"

---

### User Story 4 - Mobile Page Reading Experience (Priority: P2)

A mobile user reads wiki pages with content optimized for small screens, including proper text sizing, image handling, and table formatting.

**Why this priority**: Reading is the most frequent wiki activity. While less critical than navigation and editing (which enable contribution), a poor reading experience frustrates users and reduces engagement.

**Independent Test**: Open a content-rich page (with headings, images, tables, code blocks) on mobile device and verify text is readable without horizontal scrolling, images scale appropriately, and tables are accessible.

**Acceptance Scenarios**:

1. **Given** a mobile user views a page, **When** content renders, **Then** body text is minimum 16px with appropriate line-height (1.5-1.6) for readability
2. **Given** a page contains images, **When** rendered on mobile, **Then** images scale to fit viewport width (max-width: 100%) without breaking layout
3. **Given** a page contains tables, **When** viewed on mobile, **Then** tables either wrap cells, scroll horizontally with visible indicator, or convert to card-based layout
4. **Given** a page contains code blocks, **When** rendered on mobile, **Then** code blocks have horizontal scroll with clear visual affordance and maintain monospace formatting
5. **Given** a user reads a long page, **When** they scroll, **Then** the page header/title collapses to maximize content area (sticky header shrinks)
6. **Given** a page contains internal links, **When** a user taps a link, **Then** the minimum touch target is 44px with adequate spacing from adjacent links

---

### User Story 5 - Offline and Progressive Web App (PWA) Capabilities (Priority: P3)

A mobile user can add the wiki to their home screen as a PWA and access recently viewed pages offline, providing app-like experience on mobile devices.

**Why this priority**: While valuable for mobile experience, PWA capabilities are enhancement rather than core functionality. Most wiki usage requires server connectivity for real-time updates.

**Independent Test**: Add wiki to home screen on iOS/Android device, open PWA, view recently cached pages while offline, verify app icon and splash screen work correctly.

**Acceptance Scenarios**:

1. **Given** a mobile user visits the wiki, **When** they use the browser menu, **Then** an "Add to Home Screen" prompt/option is available
2. **Given** the PWA is installed, **When** a user launches from home screen, **Then** it opens in standalone mode (no browser chrome) with custom app icon
3. **Given** the PWA is active, **When** a user goes offline, **Then** previously viewed pages are accessible from cache with clear "Offline" indicator
4. **Given** the user is offline, **When** they attempt to edit a page, **Then** editor opens with warning "Changes will sync when online" and saves to local queue
5. **Given** offline edits exist, **When** connectivity returns, **Then** changes auto-sync with conflict detection and user notification

---

### User Story 6 - Mobile Attachment Upload with Camera Integration (Priority: P3)

A mobile user uploads photos directly from their device camera or photo library, enabling quick documentation with visual content.

**Why this priority**: Camera integration is a mobile-specific enhancement that increases content richness, but users can still upload images via traditional file picker. This is a nice-to-have rather than essential.

**Independent Test**: On mobile device, click "Add Attachment" in editor, verify options include "Take Photo", "Choose from Library", and "Browse Files" - select camera, take photo, confirm it uploads and inserts into page.

**Acceptance Scenarios**:

1. **Given** a mobile user editing a page, **When** they tap "Add Image" in toolbar, **Then** they see mobile-specific options: "Take Photo", "Photo Library", "Files"
2. **Given** a user selects "Take Photo", **When** camera permission is granted, **Then** native camera app launches for photo capture
3. **Given** a photo is captured, **When** returned to editor, **Then** image preview shows with options to "Crop", "Rotate", "Use", or "Retake"
4. **Given** a user confirms photo, **When** upload begins, **Then** progress indicator shows with "Uploading... 45%" and option to cancel
5. **Given** image upload completes, **When** inserted into page, **Then** markdown syntax is auto-generated with attachment URL and user can add alt text

---

### User Story 7 - Mobile Gesture Navigation (Priority: P3)

A mobile user can use intuitive swipe gestures for common navigation actions, providing an app-like experience that feels natural on touchscreens.

**Why this priority**: Gestures are enhancement to mobile UX but not essential. Standard tap-based navigation works perfectly well. This is polish rather than core functionality.

**Independent Test**: On mobile device viewing a page, swipe right from left edge to go back, swipe left on a page in list view to reveal actions, pinch-to-zoom on images - verify gestures work smoothly and intuitively.

**Acceptance Scenarios**:

1. **Given** a mobile user viewing a page, **When** they swipe right from left screen edge, **Then** they navigate back to previous page (browser-native or implemented back action)
2. **Given** a user views a page list, **When** they swipe left on a page item, **Then** quick actions appear (Edit, Delete, Move, Share)
3. **Given** a user views an image, **When** they pinch-to-zoom, **Then** image scales smoothly with multi-touch gesture support
4. **Given** a user views the folder sidebar, **When** they swipe right, **Then** sidebar closes with smooth animation
5. **Given** a user is at the top of a page, **When** they pull down, **Then** page refreshes content (pull-to-refresh pattern)

---

### Edge Cases

- What happens when a user rotates device mid-edit? Editor preserves content and cursor position, adapts layout to new orientation, and shows toast "Layout adjusted to [orientation]" if significant UI changes occur.
- What happens when mobile keyboard obscures the "Save" button? Save button is sticky at top of viewport OR moves above keyboard OR mobile layout ensures button is always accessible (e.g., swipe down to dismiss keyboard reveals button).
- What happens when a user attempts to paste a very large image on mobile? System shows warning "Image is 25MB, recommended max is 10MB. Compress before uploading?" with options to "Compress & Upload" or "Cancel".
- What happens when a mobile user loses connectivity while saving edits? Save is queued locally with notification "Saved locally. Will sync when online." and shows sync status indicator. When connectivity returns, auto-sync attempts with conflict detection.
- What happens when a table is too wide for mobile screen? Table container allows horizontal scroll with clear visual indicator (shadow/fade at edges) OR table converts to card-based stacked layout for mobile devices.
- What happens when a user tries to edit markdown while keyboard is showing and content is obscured? Editor auto-scrolls to keep cursor visible above keyboard, or editor implements "sticky toolbar" that remains accessible above keyboard.
- What happens when a user long-presses on mobile but browser's default context menu appears? System implements custom touch event handling to show app-specific context menu and prevents browser default with `preventDefault()`.
- What happens when PWA user has multiple tabs and edits same page in two tabs? System detects concurrent edit attempt, shows warning "This page is being edited in another tab. Your changes may conflict." with option to "View Other Version" or "Continue Anyway".
- What happens on very small screens (<360px width)? Core functionality remains accessible with ultra-compact layout, but system may show one-time message "For best experience, use device with minimum 360px width" if viewport is extremely narrow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement responsive design with mobile breakpoints at 768px (tablet) and 480px (mobile)
- **FR-002**: System MUST provide mobile-optimized navigation with collapsible hamburger menu for folder hierarchy
- **FR-003**: All interactive elements MUST have minimum 44x44px touch target size (WCAG 2.1 AA Level AAA guideline)
- **FR-004**: System MUST use mobile-optimized typography with minimum 16px body text to prevent iOS zoom on focus
- **FR-005**: Editor MUST default to single-pane mode (not split view) on mobile devices to maximize editing area
- **FR-006**: Editor MUST adjust viewport when mobile keyboard appears to keep cursor and content visible
- **FR-007**: System MUST implement sticky or floating controls (Save, Cancel, Menu) accessible regardless of scroll position
- **FR-008**: Search MUST expand to full-screen modal on mobile with large touch-friendly input field
- **FR-009**: System MUST implement touch-optimized image viewer with pinch-to-zoom and swipe gestures
- **FR-010**: System MUST handle wide tables on mobile with horizontal scroll or responsive card-based layout
- **FR-011**: System MUST scale images to fit mobile viewport (max-width: 100%) without horizontal scroll
- **FR-012**: System MUST provide mobile-specific attachment upload with "Camera" and "Photo Library" options
- **FR-013**: System MUST implement floating action button (FAB) for quick access to "Create Page" and other primary actions
- **FR-014**: System MUST support device rotation with layout adaptation and state preservation
- **FR-015**: System MUST implement pull-to-refresh pattern for page content updates on mobile
- **FR-016**: System MUST provide context menus via long-press gesture on touch devices
- **FR-017**: System MUST implement swipe gestures for common actions (swipe-to-delete, swipe-to-reveal actions)
- **FR-018**: System MUST collapsing/shrinking header on scroll to maximize content area on mobile
- **FR-019**: System MUST provide clear visual feedback for all touch interactions (tap states, loading indicators)
- **FR-020**: System MUST implement mobile-friendly breadcrumb navigation with truncation for long paths
- **FR-021**: System MUST use mobile-native form controls and input types (email, url, number, date) for better keyboard
- **FR-022**: System MUST implement auto-save for mobile editing sessions with local storage fallback
- **FR-023**: System MUST handle offline scenarios gracefully with clear status indicators and queued sync
- **FR-024**: System MUST provide PWA manifest for "Add to Home Screen" capability (P3)
- **FR-025**: System MUST cache recently viewed pages for offline access via service worker (P3)
- **FR-026**: System MUST implement dark mode with mobile system preference detection
- **FR-027**: System MUST prevent horizontal scroll except where intentionally designed (tables, code blocks)
- **FR-028**: System MUST provide mobile-optimized empty states and error messages with larger text and icons
- **FR-029**: System MUST implement haptic feedback for important actions on supported devices (P3)
- **FR-030**: System MUST test on iOS Safari, Chrome Android, Samsung Internet browsers for compatibility

### Key Entities

- **MobileViewport**: Represents the mobile device viewport configuration
  - Attributes: width, height, devicePixelRatio, orientation (portrait/landscape), isMobile (boolean), isTablet (boolean)
  - Storage: Calculated at runtime from `window.innerWidth`, `window.innerHeight`, device detection
  - Relationships: One viewport state per user session, updates on resize/rotation events

- **TouchGesture**: Represents user touch interactions on mobile
  - Attributes: gestureType (tap/long-press/swipe/pinch), startPosition (x, y), endPosition (x, y), duration (ms), targetElement
  - Storage: Tracked via touch event listeners (touchstart, touchmove, touchend)
  - Relationships: Multiple gestures per user session, translated to action events

- **MobileEditorState**: Extends EditorState for mobile-specific properties
  - Attributes: all EditorState attributes plus keyboardVisible (boolean), keyboardHeight (px), currentMode (edit/preview), toolbarPosition (top/bottom)
  - Storage: In-memory state, synced with browser local storage for auto-save
  - Relationships: One per mobile editing session, persists across keyboard show/hide

- **PWAInstallPrompt**: Represents the installability state of the PWA
  - Attributes: isInstallable (boolean), isInstalled (boolean), promptEvent (BeforeInstallPromptEvent), installDate (timestamp)
  - Storage: In-memory state, install status persisted in local storage
  - Relationships: One per user browser, triggers install UI based on PWA criteria

- **OfflineSyncQueue**: Represents pending changes when device is offline
  - Attributes: queueId (UUID), changeType (create/update/delete), pageId, content, timestamp, syncStatus (pending/syncing/failed)
  - Storage: IndexedDB for persistent offline storage
  - Relationships: Multiple queued changes per user, processed in order when online

- **MobileSettings**: User preferences specific to mobile experience
  - Attributes: userId, enableGestures (boolean), toolbarPosition (top/bottom), autoRotateLock (boolean), hapticFeedback (boolean), enablePWA (boolean)
  - Storage: Browser local storage or user profile preferences
  - Relationships: One settings object per user

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of mobile users successfully complete core tasks (view page, navigate folders, search) on first attempt without assistance
- **SC-002**: Mobile editing sessions have <10% abandonment rate due to usability issues (measured via analytics)
- **SC-003**: Average time to complete "create page" task on mobile is within 20% of desktop time (e.g., desktop 45 seconds, mobile max 54 seconds)
- **SC-004**: All interactive elements pass automated accessibility testing for touch target size (minimum 44x44px)
- **SC-005**: Mobile page load time on 3G network is under 3 seconds for typical page with images
- **SC-006**: Wiki achieves perfect mobile usability score (100/100) on Google Lighthouse Mobile Audit
- **SC-007**: 95% of images and tables render correctly on mobile without horizontal scroll or layout breaks
- **SC-008**: Mobile users successfully save edits without keyboard obscuring Save button in 100% of test cases
- **SC-009**: Zero reported issues with content obscured by virtual keyboard in user testing sessions
- **SC-010**: PWA installation (if implemented) shows "Add to Home Screen" prompt within 30 seconds of first mobile visit for qualifying users
- **SC-011**: Offline mode (if implemented) allows access to 100% of cached pages without errors
- **SC-012**: Mobile experience maintains WCAG 2.1 AA compliance across all breakpoints and orientations
- **SC-013**: Support for major mobile browsers: iOS Safari 15+, Chrome Android 100+, Samsung Internet 20+
- **SC-014**: Mobile layout adapts correctly to device rotation within 300ms with no content loss

## Constitution Alignment *(mandatory)*

### Alignment with Core Principles

**Family-Friendly Experience (Core Principle IV)**:
- This specification directly addresses the constitutional requirement: "Mobile-responsive design (many family members access via phones/tablets)"
- Touch-optimized interface ensures accessibility for all ages and tech skill levels
- Large touch targets (44px minimum) comply with accessibility guidelines and make interface usable for young children and elderly family members

**Simplicity & Cost-Effectiveness (Core Principle III)**:
- Mobile optimizations are implemented client-side (CSS/JavaScript) with zero additional infrastructure costs
- PWA capabilities leverage browser features without requiring native app development or app store fees
- Responsive design eliminates need for separate mobile website or native mobile apps

**Privacy & Security (Core Principle VI)**:
- Mobile experience maintains same authentication and role-based access control as desktop
- PWA offline caching respects authentication state and only caches authorized content
- Touch interactions implement same security measures (input sanitization, XSS prevention)

**Accessibility (WCAG 2.1 AA Compliance)**:
- 44px minimum touch targets exceed WCAG Level AA requirements (24x24px) and approach Level AAA
- Mobile typography (16px minimum) prevents unintended zoom on iOS while maintaining readability
- Mobile experience supports screen readers and assistive technologies on mobile devices

**Pluggable Module Architecture (Core Principle I)**:
- Mobile optimizations work seamlessly with all pluggable storage modules (S3, GitHub)
- Mobile editor integrates with pluggable editor modules without modification
- Touch gestures and mobile UI patterns apply consistently across optional feature modules

### Technology Standards Compliance

**Frontend Stack (React SPA)**:
- Mobile optimizations implemented using responsive CSS with mobile-first approach
- React components adapt rendering based on viewport detection and device capabilities
- PWA implemented using standard service worker API and Web App Manifest

**Performance Requirements**:
- Mobile optimizations address cold start concerns mentioned in constitution (lazy loading, code splitting)
- Service worker caching improves perceived performance on subsequent mobile visits
- Mobile-optimized asset loading (responsive images, lazy loading) reduces bandwidth costs

**Content-First Architecture (Core Principle II)**:
- Mobile reading experience prioritizes content visibility and readability
- Mobile editor maintains markdown file format and YAML frontmatter compatibility
- Offline editing queue preserves content changes for sync when connectivity returns

## Open Questions *(optional)*

1. **Tablet Breakpoint Behavior**: Should tablets (768px-1024px) use mobile or desktop layout? Suggest hybrid approach based on device capabilities.

2. **PWA Priority Decision**: Should PWA capabilities be P1 (MVP) or P3 (post-MVP)? Consider that PWA adds "app-like" feel but requires service worker implementation and testing complexity.

3. **Offline Editing Scope**: How robust should offline editing be? Simple read-only cached pages (easier) vs. full offline editing with sync queue (complex but more useful)?

4. **Mobile Editor Toolbar Position**: Should formatting toolbar be at top (standard) or bottom (thumb-friendly for one-handed use)? Consider making this a user preference.

5. **Gesture Library**: Should we implement custom gesture detection or use a library like HammerJS? Custom = lighter bundle, library = more robust gesture recognition.

6. **Camera Upload Compression**: Should system automatically compress large images from mobile camera or always prompt user? Auto-compression reduces upload times but may reduce quality.

7. **Mobile Markdown Preview**: Should mobile editor support quick preview toggle (current spec) or implement inline preview as user types (more complex but better UX)?

8. **Landscape Mode Support**: How much optimization should we do for landscape mode? Some mobile interfaces work fine in landscape with minimal changes.

9. **Mobile Search Results Limit**: Should mobile search show fewer results initially (faster loading) with "Load More" button, or match desktop behavior?

10. **Mobile Browser Support Matrix**: Which minimum browser versions should we support? Suggest iOS Safari 15+, Chrome Android 100+, Samsung Internet 20+ to balance compatibility with modern features.

## Dependencies

- **4-page-editor**: Mobile editor experience depends on base editor implementation
- **3-folder-management**: Mobile navigation requires folder hierarchy API
- **7-wiki-search**: Mobile search UI wraps core search functionality
- **6-page-attachments**: Mobile camera upload extends attachment system
- **1-user-auth**: Mobile experience respects authentication and role-based access control

## Notes for Implementation

### Recommended Approach

1. **Phase 1 - Core Mobile Responsive (P1)**:
   - Implement responsive CSS with mobile breakpoints
   - Mobile navigation with hamburger menu
   - Single-pane mobile editor
   - Touch-friendly button sizes and spacing
   - Mobile reading optimizations (typography, images, tables)

2. **Phase 2 - Mobile Editor Enhancements (P1)**:
   - Keyboard handling and viewport adjustment
   - Mobile toolbar with touch targets
   - Edit/Preview toggle
   - Sticky save/cancel buttons
   - Auto-save with local storage

3. **Phase 3 - Mobile Search and Actions (P1)**:
   - Full-screen mobile search modal
   - Floating action button (FAB)
   - Long-press context menus
   - Mobile attachment viewer

4. **Phase 4 - Advanced Mobile Features (P2-P3)**:
   - Gesture navigation (swipe, pinch-to-zoom)
   - Camera integration for attachments
   - PWA manifest and service worker
   - Offline mode with sync queue
   - Pull-to-refresh

### Testing Strategy

- Test on real devices (iPhone, Android) not just browser emulation
- Use BrowserStack or similar for multi-device testing
- Test with various keyboard sizes and orientations
- Verify touch target sizes with Chrome DevTools touch visualization
- Test offline scenarios by throttling network in DevTools
- Validate PWA with Lighthouse PWA audit
- Test gesture conflicts with browser defaults (pull-to-refresh, swipe navigation)

### Technical Considerations

- Use CSS media queries and viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Implement touch event handlers with passive listeners for better scroll performance
- Use Intersection Observer API for lazy loading images on mobile
- Consider using CSS `env()` for safe area insets on devices with notches
- Implement visual viewport API for keyboard handling: `window.visualViewport`
- Use `matchMedia` for JavaScript-based responsive behavior detection
- Implement service worker with workbox library for PWA caching strategies
- Use IndexedDB (via libraries like localforage) for offline data persistence

### Accessibility Considerations

- Ensure all mobile gestures have equivalent button/link alternatives for assistive tech users
- Test with mobile screen readers (VoiceOver on iOS, TalkBack on Android)
- Maintain focus management when keyboard appears/disappears
- Provide skip links for mobile users with assistive technology
- Ensure color contrast ratios meet WCAG AA standards on mobile screens
- Test with 200% zoom level on mobile browsers
