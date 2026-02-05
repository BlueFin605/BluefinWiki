# Clarification Questions: Mobile Experience

**Feature**: Mobile Experience  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Mobile-First vs. Responsive Design Strategy
**Question**: Is the wiki being built mobile-first or desktop-first with responsive adaptations?

**Why this matters**: Affects fundamental CSS architecture and design approach.

**ANSWER**: Desktop-first with responsive adaptations
- Primary use case is desktop (documentation/wiki creation is desktop-heavy)
- Base styles for desktop, use media queries with `max-width` for mobile overrides
- Simplifies development since desktop features are richer and can be progressively simplified for mobile
- Use standard CSS frameworks that support desktop-first (can work with most libraries)

---

### 2. Target Mobile Screen Sizes
**Question**: What specific screen sizes/devices are being targeted?

**Current spec mentions**: "375px viewport"

**ANSWER**: Standard 3-breakpoint system
- Minimum supported width: **375px** (covers most modern phones, iPhone 12+)
- Breakpoints:
  - Desktop: base styles (>1024px)
  - Tablet: 768px-1024px (`max-width: 1024px`)
  - Mobile: <768px (`max-width: 767px`)
- Test targets: Chrome DevTools responsive mode, iPhone 13/14, iPad, modern Android
- Landscape orientation supported automatically through responsive breakpoints

---

### 3. Touch Target Size Standard
**Question**: What's the minimum touch target size across all interactive elements?

**Current spec says**: "Minimum 44px touch target height"

**ANSWER**: 44px minimum standard (iOS HIG)
- **44px × 44px minimum** for all interactive elements (buttons, links, icons)
- Apply to all touchable elements on mobile breakpoint (<768px)
- Minimum **8px spacing** between adjacent touch targets
- Exceptions: In-content links can be smaller (inherit text size) but have adequate padding
- Enforcement: CSS utility classes (`.touch-target { min-height: 44px; min-width: 44px; }`)

---

### 4. Mobile Editor Library Choice
**Question**: What markdown editor works well on mobile?

**Why this matters**: Desktop editors often fail on mobile (keyboard issues, poor touch support).

**ANSWER**: Same editor with mobile adaptations (simplest, lowest cost)
- Use same markdown editor library as desktop (consistency, single codebase)
- Apply mobile-specific CSS for touch-friendly toolbar buttons (44px minimum)
- Disable preview split-pane on mobile, use toggle instead
- Ensure textarea has proper mobile attributes (`autocapitalize="sentences"`, `autocorrect="on"`)
- Test with iOS Safari and Chrome Android for keyboard handling
- Fallback: If editor fails badly on mobile, swap to native `<textarea>` with simple toolbar on mobile only

---

### 5. PWA Implementation Scope
**Question**: Is PWA (Progressive Web App) in MVP or post-MVP?

**Current spec says**: "Priority P3"

**ANSWER**: Minimal PWA in MVP, full features post-MVP
- MVP: Include basic `manifest.json` (app name, icons, theme color) - 30 minutes of work
- MVP: Meta tags for "Add to Home Screen" appearance
- Post-MVP: Service worker for offline caching
- Post-MVP: Background sync, push notifications
- Rationale: Manifest is nearly free, service worker adds complexity - defer for now

---

## 🟡 High Priority - Important for User Experience

### 6. Mobile Navigation Menu Implementation
**Question**: What's the exact behavior of the mobile hamburger menu?

**Current spec says**: "Collapsible hamburger menu provides access to folder tree"

**ANSWER**: Left slide-in overlay (standard pattern)
- Slides in from **left** (280px width, covers ~75% of screen)
- Dismiss: Click outside overlay OR close button (X) in header
- Menu closes automatically after page navigation (better mobile UX)
- Same folder tree component as desktop (code reuse)
- Search as separate full-screen modal (activated from hamburger menu or header icon)

---

### 7. Mobile Keyboard Handling
**Question**: How is the mobile keyboard handled during editing?

**Current spec says**: "Editor viewport adjusts to remain visible above the keyboard"

**ANSWER**: Standard viewport handling (simple approach)
- Use viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Let browser handle keyboard naturally (avoid complex `visualViewport` API unless needed)
- Save button in fixed header remains accessible (above keyboard)
- Textarea auto-scrolls to cursor on focus (native browser behavior)
- Test on iOS Safari and Chrome Android to validate behavior

---

### 8. Single-Pane Editor Layout
**Question**: How does the edit/preview toggle work on mobile?

**Current spec says**: "Defaults to single-pane view (not split-pane)" with toggle

**ANSWER**: Tab-based toggle in editor header
- Two tabs in editor header: **Edit** | **Preview**
- Tabs switch content below (same view, not overlay)
- Simple **fade transition** (200ms) between modes
- Remember last mode in sessionStorage (persists per session)
- Quick toggle enables fast formatting checks
- Default to Edit tab on new page

---

### 9. Table Responsive Strategy
**Question**: What's the exact solution for responsive tables?

**Current spec lists options**: "Wrap cells, scroll horizontally, or convert to card-based layout"

**ANSWER**: Horizontal scroll with visual affordance (simplest)
- All tables: Wrap in scrollable container (`overflow-x: auto`)
- Show **shadow gradient** on right edge to indicate more content
- Minimum column width to prevent text crushing
- No automatic card conversion (adds complexity, inconsistent with markdown)
- Tables remain tables on mobile (predictable behavior)
- Consider alternative data presentation in documentation rather than complex tables

---

### 10. Floating Action Button (FAB) Behavior
**Question**: How does the FAB work in mobile UI?

**Current spec mentions**: "Floating action button (FAB)" for quick actions

**ANSWER**: Defer FAB to post-MVP (simplicity)
- MVP: Primary actions in header/navigation (standard mobile pattern)
- Post-MVP: If needed, single FAB at bottom-right (16px from edges)
- Post-MVP: Bottom sheet expansion on tap (simpler than radial menu)
- Rationale: FAB adds UI complexity; header actions are more standard and discoverable
- Mobile users can access "Create Page" from navigation menu

---

### 11. Mobile Page Reading Font Size
**Question**: What's the body text font size on mobile?

**Current spec says**: "Minimum 16px"

**ANSWER**: 16px base with relative sizing
- Body text: **16px** (1rem) minimum - prevents iOS zoom on input focus
- Use **rem** units for scalability (respects user browser settings)
- Headings: Scale proportionally (h1: 2rem, h2: 1.5rem, h3: 1.25rem, etc.)
- Line height: 1.6 for body text (readability)
- No user preference control in MVP (defer to post-MVP if requested)
- Let users zoom page with browser controls if needed

---

### 12. Image Scaling and Zoom
**Question**: How do images work on mobile?

**Current spec says**: "Images scale to fit viewport width (max-width: 100%)"

**ANSWER**: Simple responsive images with native zoom
- Images: `max-width: 100%; height: auto;` (responsive by default)
- Native pinch-to-zoom enabled (browser default - no JavaScript needed)
- No lightbox in MVP (adds complexity and library dependency)
- Lazy loading: Use native `loading="lazy"` attribute (no JavaScript)
- Tall images scale proportionally (no cropping)
- Post-MVP: Consider lightbox library if users request it

---

### 13. Mobile Back-to-Top Button
**Question**: When does the "back to top" button appear?

**Current spec mentions**: "Floating 'back to top' and 'menu' button appears"

**ANSWER**: Simple scroll-triggered button
- Appears after scrolling **400px** down (approximately 1 viewport height)
- Position: **bottom-right** corner (60px from bottom, 20px from right)
- **Smooth scroll** to top (`behavior: 'smooth'`)
- Fade in/out with CSS transition (200ms)
- Since FAB deferred to post-MVP, no conflict in MVP
- Post-MVP: If FAB added, place back-to-top above it or combine functionality

---

### 14. Long-Press Context Menu
**Question**: What actions are in the long-press context menu?

**Current spec mentions**: "Edit, Delete, Move, Share"

**ANSWER**: Context-aware custom menu
- **Page list context**: Edit, Delete, Move, Share
- **Page view context**: Edit, Share, Copy Link
- **Custom styled** menu (better branding control than native)
- Use CSS bottom sheet style (slides up from bottom)
- Include haptic feedback via Vibration API (`navigator.vibrate(50)`) where supported
- Cancel: Tap outside menu or Cancel button at bottom

---

### 15. Landscape Orientation Support
**Question**: How does mobile UI adapt to landscape?

**Current spec mentions**: "User rotates device to landscape, then editor adapts layout"

**ANSWER**: Responsive by viewport width, not orientation
- Breakpoints based on **width only** (simpler than orientation-specific)
- Tablets (>768px width): Can show split-pane editor even in portrait if width allows
- Phones (<768px width): Single-pane editor in both portrait and landscape
- Landscape phones (e.g., 812px × 375px): Still single-pane (height too limited for split)
- Test: All features should work in both orientations at each breakpoint

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Mobile Gestures Support
**Question**: What touch gestures are supported?

**Not explicitly covered in spec**:

**ANSWER**: Minimal gestures in MVP (simplicity)
- **Native browser gestures only**: Pinch-to-zoom (enabled), tap, long-press
- **No custom gestures** in MVP (reduces complexity and potential conflicts)
- Post-MVP considerations: Pull-to-refresh (easy with libraries), swipe back (browser-native in iOS)
- Rationale: Custom gestures require libraries, testing, and conflict resolution with native behaviors
- Focus on solid touch targets and standard interactions first

---

### 17. Mobile App Banner
**Question**: Should there be "Add to Home Screen" banner?

**Not explicitly covered in spec**:

**ANSWER**: Simple custom banner post-manifest
- Include **custom dismissible banner** after manifest.json is added (low effort)
- Show once per session at bottom of screen (non-intrusive)
- "Install app for better experience" with Add/Dismiss buttons
- Remember dismissal in localStorage (don't spam users)
- Skip iOS Smart App Banner (requires specific meta tag, auto-appears anyway)
- Android will show native install prompt automatically when PWA criteria met

---

### 18. Mobile Loading States
**Question**: How are loading states shown on mobile?

**Not explicitly covered in spec**:

**ANSWER**: Simple spinner for MVP
- **Centered spinner** (CSS animation, no library needed) for page loads
- Spinner in button during save operations (inline feedback)
- MVP: Single loading pattern for consistency
- Post-MVP: Skeleton screens for perceived performance improvement
- Post-MVP: Progressive loading (header first) for slow connections
- Keep loading indicators simple and consistent across all breakpoints

---

### 19. Mobile Error Handling
**Question**: How are errors displayed on mobile?

**Not explicitly covered in spec**:

**ANSWER**: Toast notifications at top (consistent with desktop)
- **Toast at top** of viewport (won't be hidden by keyboard like bottom toasts)
- Auto-dismiss after 5 seconds OR manual close button
- Critical errors: Keep toast visible until dismissed
- Form validation: Inline error messages below fields
- Network errors: Toast + retry button
- Same error handling as desktop for code consistency

---

### 20. Mobile Search Experience
**Question**: How does search differ from desktop?

**Current spec mentions**: "Full-screen modal"

**ANSWER**: Full-screen modal with mobile optimizations
- **Full-screen modal** (better use of limited mobile space)
- **Auto-focus** search input on open (brings up keyboard immediately)
- Show **recent searches** more prominently (top 3-5 results)
- No voice search in MVP (adds complexity, limited browser support)
- Autocomplete: Show **3-5 results** max (vs 7-10 on desktop)
- Close: Back button, Cancel button, or ESC key (tablet keyboards)

---

### 21. Mobile File Upload
**Question**: How does file upload work on mobile?

**Not explicitly covered in spec**:

**ANSWER**: Native file input (simplest approach)
- Standard `<input type="file" />` - mobile browsers handle the rest
- iOS automatically shows: Camera, Photo Library, Files
- Android shows: Camera, Gallery, File Manager
- Support `multiple` attribute for multi-file selection
- Accept attribute for file types: `accept="image/*,.pdf,.md"`
- Native UI = zero code, works everywhere, familiar to users

---

### 22. Mobile Offline Detection
**Question**: How is offline state communicated?

**Current spec mentions**: "Offline indicator"

**ANSWER**: Top banner with status
- **Banner at top** of page (yellow/orange background): "No internet connection"
- Listen to `online`/`offline` events
- Gray out Edit buttons (prevent lost work)
- **No action queue** in MVP (defer to service worker implementation later)
- Banner disappears when back online
- Same offline detection logic as desktop

---

### 23. Mobile Performance Budgets
**Question**: What are the performance targets for mobile?

**Not explicitly covered in spec**:

**ANSWER**: Pragmatic mobile performance targets
- **Initial JS bundle**: <200KB gzipped (reasonable for wiki app)
- **Time to Interactive (TTI)**: <5 seconds on 3G (test with Chrome DevTools throttling)
- **First Contentful Paint (FCP)**: <2 seconds
- **Lighthouse score**: >70 mobile (good baseline, not perfect)
- Code splitting: Split markdown editor into separate chunk (loaded only on edit)
- Monitor with Lighthouse CI in development

---

### 24. Mobile Accessibility
**Question**: What mobile accessibility standards to meet?

**Not explicitly covered in spec**:

**ANSWER**: WCAG 2.1 Level AA (same as desktop)
- **WCAG 2.1 Level AA** compliance (industry standard)
- Screen reader testing: **iOS VoiceOver** (primary), TalkBack (if time permits)
- Touch target minimum: 44px (already covered in Q3)
- Color contrast: 4.5:1 for text, 3:1 for UI components
- Keyboard navigation: Important for tablets with keyboards
- Test: Lighthouse accessibility audit, manual screen reader testing on key flows

---

### 25. Mobile Analytics
**Question**: Should mobile usage be tracked separately?

**Not explicitly covered in spec**:

**ANSWER**: Basic segmentation with existing analytics
- Track mobile vs desktop via **device type dimension** (standard in Google Analytics, etc.)
- Track **viewport width** as custom dimension (identifies actual breakpoints used)
- Track **performance metrics** (Core Web Vitals) by device type
- No separate mobile analytics implementation needed (use same analytics library)
- Post-MVP: Analyze most-used features by device type to optimize mobile UX
- Keep analytics simple and privacy-conscious

---

## 📝 Implementation Summary

### Desktop-First Responsive Approach

**Core Strategy**:
- Desktop-first development with responsive breakpoints
- Bias toward simplicity and low-cost solutions
- Reuse desktop components with mobile CSS adaptations
- Defer complex features (FAB, PWA service worker) to post-MVP

**Breakpoint System**:
```css
/* Desktop: Base styles (>1024px) */

@media (max-width: 1024px) {
  /* Tablet: 768-1024px */
}

@media (max-width: 767px) {
  /* Mobile: <768px */
}
```

**Key Technical Decisions**:
1. ✅ Same markdown editor for mobile and desktop (CSS adaptations)
2. ✅ Native HTML5 file input (zero-cost mobile file picker)
3. ✅ CSS-only touch targets and responsive design
4. ✅ Standard browser behaviors (keyboard, zoom, gestures)
5. ✅ Simple spinners and toasts (no complex loading states in MVP)
6. ✅ Horizontal scroll for tables (no card conversion)
7. ❌ Defer: FAB, service worker, skeleton screens, custom gestures

**MVP Effort Estimate**:
- Breakpoint CSS: 2-3 days
- Mobile navigation menu: 1 day
- Touch-friendly controls: 1 day
- Testing on devices: 1-2 days
- **Total: ~5-7 days** for solid mobile responsive experience

All 25 clarification questions have been answered with practical, implementable solutions.
