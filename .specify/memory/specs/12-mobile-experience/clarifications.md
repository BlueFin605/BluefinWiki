# Clarification Questions: Mobile Experience

**Feature**: Mobile Experience  
**Generated**: 2026-01-13  
**Status**: Awaiting Answers

---

## 🔴 Critical Priority - Must Answer Before Implementation

### 1. Mobile-First vs. Responsive Design Strategy
**Question**: Is the wiki being built mobile-first or desktop-first with responsive adaptations?

**Why this matters**: Affects fundamental CSS architecture and design approach.

**Needs clarification**:
- Mobile-first design (base styles for mobile, adapt up for desktop)?
- Or desktop-first with mobile overrides?
- What's the primary use case (mobile or desktop)?
- Different component libraries optimized for each approach?

---

### 2. Target Mobile Screen Sizes
**Question**: What specific screen sizes/devices are being targeted?

**Current spec mentions**: "375px viewport"

**Needs complete definition**:
- Minimum supported width: 320px (iPhone SE)? 375px (iPhone)? 360px (Android)?
- Breakpoints: Mobile (<768px), Tablet (768-1024px), Desktop (>1024px)?
- Or more granular breakpoints?
- Test devices: iPhone 15, Pixel 8, iPad, etc.?
- Support for landscape orientation?

---

### 3. Touch Target Size Standard
**Question**: What's the minimum touch target size across all interactive elements?

**Current spec says**: "Minimum 44px touch target height"

**Needs clarification**:
- 44px x 44px (iOS HIG) or 48px x 48px (Material Design)?
- Apply to ALL buttons/links or just primary actions?
- Spacing between touch targets (how much buffer)?
- Exceptions for dense UI (data tables)?
- Enforcement/validation strategy?

---

### 4. Mobile Editor Library Choice
**Question**: What markdown editor works well on mobile?

**Why this matters**: Desktop editors often fail on mobile (keyboard issues, poor touch support).

**Needs decision**:
- Use same editor as desktop with mobile adaptations?
- Or different editor for mobile (SimpleMDE, EasyMDE, custom)?
- Native textarea with custom toolbar (simplest)?
- Does chosen editor handle mobile keyboards well?

---

### 5. PWA Implementation Scope
**Question**: Is PWA (Progressive Web App) in MVP or post-MVP?

**Current spec says**: "Priority P3"

**Needs clarification**:
- If P3, can it be completely deferred?
- Or are some PWA features (manifest, service worker) needed earlier?
- Offline capability - essential or nice-to-have?
- App icon and splash screen - easy wins or complex?
- What's the minimum viable PWA implementation?

---

## 🟡 High Priority - Important for User Experience

### 6. Mobile Navigation Menu Implementation
**Question**: What's the exact behavior of the mobile hamburger menu?

**Current spec says**: "Collapsible hamburger menu provides access to folder tree"

**Needs clarification**:
- Slide-in from left, right, or full-screen overlay?
- Dismiss by clicking outside, swipe, or only close button?
- Does menu close after navigation or stay open?
- Is folder tree same component as desktop or simplified?
- Search integrated into menu or separate?

---

### 7. Mobile Keyboard Handling
**Question**: How is the mobile keyboard handled during editing?

**Current spec says**: "Editor viewport adjusts to remain visible above the keyboard"

**Needs clarification**:
- Using `visualViewport` API?
- Or fixed positioning hacks?
- What about iOS Safari keyboard toolbar?
- Does save button remain accessible with keyboard open?
- Scroll to cursor position when keyboard opens?

---

### 8. Single-Pane Editor Layout
**Question**: How does the edit/preview toggle work on mobile?

**Current spec says**: "Defaults to single-pane view (not split-pane)" with toggle

**Needs clarification**:
- Toggle button location (top of editor, floating, tab bar)?
- Animation between edit/preview (slide, fade)?
- Remember last view mode per session?
- Can user quickly swap between modes (important for checking formatting)?
- Preview opens in same view or as overlay?

---

### 9. Table Responsive Strategy
**Question**: What's the exact solution for responsive tables?

**Current spec lists options**: "Wrap cells, scroll horizontally, or convert to card-based layout"

**Needs decision**:
- Which approach for which types of tables?
- Simple tables (3-4 columns) - different from complex tables (10+ columns)?
- Scrollable tables - show scroll affordance (shadow gradient)?
- Card conversion - automatic or user toggle?
- What about nested tables?

---

### 10. Floating Action Button (FAB) Behavior
**Question**: How does the FAB work in mobile UI?

**Current spec mentions**: "Floating action button (FAB)" for quick actions

**Needs clarification**:
- Location (bottom-right corner, bottom-center)?
- Actions shown (create page, upload, scan QR - list from spec)?
- Expand as radial menu or bottom sheet?
- Hide on scroll or always visible?
- Collision with other UI elements?

---

### 11. Mobile Page Reading Font Size
**Question**: What's the body text font size on mobile?

**Current spec says**: "Minimum 16px"

**Needs clarification**:
- Exactly 16px or larger (18px)?
- Scalable text (rem/em) or fixed (px)?
- Different sizes for different content (headings, body, captions)?
- User preference for text size?
- Line height and letter spacing?

---

### 12. Image Scaling and Zoom
**Question**: How do images work on mobile?

**Current spec says**: "Images scale to fit viewport width (max-width: 100%)"

**Needs clarification**:
- Can users zoom/pinch images?
- Open in full-screen lightbox?
- Lazy loading implementation?
- What about very tall images (crop, scale)?
- Support for image galleries/carousels?

---

### 13. Mobile Back-to-Top Button
**Question**: When does the "back to top" button appear?

**Current spec mentions**: "Floating 'back to top' and 'menu' button appears"

**Needs clarification**:
- Trigger threshold (scroll 100px, 500px, 1 screen height)?
- Position (bottom-right, bottom-left)?
- Animated scroll or instant jump?
- Fade in/out animation?
- Conflicts with FAB?

---

### 14. Long-Press Context Menu
**Question**: What actions are in the long-press context menu?

**Current spec mentions**: "Edit, Delete, Move, Share"

**Needs clarification**:
- Different menus for different contexts (page list vs page view)?
- Platform-native menu or custom styled?
- What other actions (Pin, Copy link, History)?
- Haptic feedback on long-press?

---

### 15. Landscape Orientation Support
**Question**: How does mobile UI adapt to landscape?

**Current spec mentions**: "User rotates device to landscape, then editor adapts layout"

**Needs clarification**:
- Use wider space for split-pane on landscape tablets?
- Or stay single-pane on phones even in landscape?
- Different breakpoints for landscape vs portrait?
- Test all features in both orientations?

---

## 🟢 Medium Priority - Nice to Have Clarity

### 16. Mobile Gestures Support
**Question**: What touch gestures are supported?

**Not explicitly covered in spec**:
- Swipe back/forward for navigation?
- Pull-to-refresh?
- Swipe to delete in lists?
- Pinch to zoom pages (not just images)?
- Two-finger scroll?

---

### 17. Mobile App Banner
**Question**: Should there be "Add to Home Screen" banner?

**Not explicitly covered in spec**:
- iOS Smart App Banner?
- Android install prompt?
- Custom banner with "Add to Home Screen" call-to-action?
- Dismissible and remember dismissal?

---

### 18. Mobile Loading States
**Question**: How are loading states shown on mobile?

**Not explicitly covered in spec**:
- Skeleton screens?
- Spinners?
- Progressive loading (show header first)?
- Different for slow connections?

---

### 19. Mobile Error Handling
**Question**: How are errors displayed on mobile?

**Not explicitly covered in spec**:
- Toast notifications at bottom?
- Full-screen error pages?
- Inline error messages?
- Dismiss mechanism?

---

### 20. Mobile Search Experience
**Question**: How does search differ from desktop?

**Current spec mentions**: "Full-screen modal"

**Needs clarification**:
- Keyboard auto-focus on open?
- Recent searches more prominent?
- Voice search support?
- Autocomplete how many results (fewer than desktop)?

---

### 21. Mobile File Upload
**Question**: How does file upload work on mobile?

**Not explicitly covered in spec**:
- Access device camera for photos?
- Access photo library?
- Access files app?
- Multiple file selection?
- File picker UI?

---

### 22. Mobile Offline Detection
**Question**: How is offline state communicated?

**Current spec mentions**: "Offline indicator"

**Needs clarification**:
- Banner at top?
- Toast notification?
- Gray out edit controls?
- Queue actions for when online?

---

### 23. Mobile Performance Budgets
**Question**: What are the performance targets for mobile?

**Not explicitly covered in spec**:
- Page load time on 3G: <3 seconds?
- Time to interactive?
- Bundle size limit?
- Lighthouse score targets?

---

### 24. Mobile Accessibility
**Question**: What mobile accessibility standards to meet?

**Not explicitly covered in spec**:
- WCAG 2.1 Level AA?
- Screen reader testing (VoiceOver, TalkBack)?
- Keyboard navigation on tablet?
- Color contrast requirements?

---

### 25. Mobile Analytics
**Question**: Should mobile usage be tracked separately?

**Not explicitly covered in spec**:
- Track mobile vs desktop usage?
- Most used features on mobile?
- Performance monitoring mobile-specific?
- User agent analysis?

---

## 📝 Recommendations

1. **Answer Critical Priority (🔴) questions FIRST** - especially design strategy and editor choice
2. **Create mobile UI mockups** - for all key screens (navigation, editor, page view)
3. **Define complete breakpoint system** - with exact pixel values and device targets
4. **Test on real devices early** - emulators don't catch all mobile issues

Would you like me to:
- Research mobile markdown editor options?
- Create mobile UI mockups for key screens?
- Design a complete responsive breakpoint system?
- Draft a mobile performance budget?
