---
description: Plan for mobile-responsive design — breakpoints, navigation drawer, touch-friendly editor
tags: [bluefinwiki, plan, mobile, responsive, tailwind]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Mobile Responsive Design

Implements: [Design](../design.md) — Frontend, Tailwind CSS

## Scope

**Covers:**
- Responsive breakpoints in Tailwind
- Mobile header with hamburger menu
- Collapsible navigation drawer
- Mobile-optimized editor toolbar
- Touch-friendly UI sizing
- Responsive page layouts

**Does not cover:**
- Native mobile app (web only)
- Offline mode / PWA (post-MVP)
- Accessibility beyond responsive layout (considered throughout but not dedicated plan)

## Enables

Once mobile works:
- **Members can read the wiki on their phone** — the primary consumption device for many family members
- **Members can make quick edits on mobile** — not the primary editing experience, but workable
- **No separate mobile app needed** — responsive web covers the use case

## Prerequisites

- Tailwind CSS configured — **done**
- Page tree sidebar component — **done**
- CodeMirror editor — **done**
- All page layouts — **done** (desktop-first)

## North Star

A family member picks up their phone, opens the wiki, and reads or edits a page without pinching, zooming, or fighting the UI. It's not the same layout as desktop — it's a layout designed for phones.

## Done Criteria

### Breakpoints
- The Tailwind config shall define breakpoints: mobile (0-767px), tablet (768-1023px), desktop (1024px+)
- All page layouts shall adapt to these breakpoints

### Mobile Header
- On mobile, the header shall show a hamburger menu icon replacing the full navigation
- The header shall show a search icon that opens the search overlay
- The header shall show the wiki name or logo, truncated if needed

### Navigation Drawer
- On mobile, the page tree shall be a slide-in drawer from the left
- The drawer shall overlay content with a dimmed background
- The drawer shall close on navigation (page selected) or tap outside
- Swipe right from the left edge shall open the drawer
- Swipe left shall close the drawer

### Mobile Editor
- On mobile, the editor shall show a simplified toolbar with essential buttons only (bold, italic, link, image, save)
- The toolbar shall be positioned at the bottom of the screen (thumb-friendly)
- The preview pane shall be hidden by default with a toggle button
- The editor shall fill the viewport height minus toolbar

### Touch-Friendly UI
- All interactive elements shall have a minimum touch target of 44x44px
- Spacing between interactive elements shall prevent accidental taps
- Links in content shall have adequate tap padding
- Form inputs shall be large enough to tap without zooming

### Responsive Layouts
- The page content area shall use full width on mobile (no sidebar)
- Tables in Markdown shall be horizontally scrollable on mobile
- Images shall scale to fit the viewport width
- The attachment panel shall stack below the editor on mobile
- The metadata panel shall be collapsible on mobile

## Constraints

- **CSS-only responsive** — no JavaScript-based breakpoint detection. Tailwind responsive utilities only.
- **No feature removal on mobile** — all features available, just different layout. Exception: simplified editor toolbar.
- **Testing scope** — iOS Safari and Android Chrome are the primary mobile targets.

## References

- [Design](../design.md) — Frontend architecture, Tailwind
- [North Star](../north-star.md) — Mobile & Accessibility declarations
- Tailwind responsive design: `sm:`, `md:`, `lg:` prefixes

## Error Policy

Responsive layout issues should be caught during manual testing. No automated responsive regression tests in MVP. Key pages to test: page view, editor, search, page tree, login.
