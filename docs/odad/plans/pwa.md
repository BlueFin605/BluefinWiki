---
description: Plan for Progressive Web App — installability, service worker, offline caching
tags: [bluefinwiki, plan, pwa, offline, service-worker]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Progressive Web App (PWA)

Implements: [Design](../design.md) — Frontend, Vite
Related: [Mobile Responsive](mobile.md)

## Scope

**Covers:**
- Web app manifest for installability
- Service worker for asset caching
- Runtime API caching (NetworkFirst)
- PWA icons generated from favicon.svg
- Apple touch icon and iOS meta tags

**Does not cover:**
- Full offline editing (save queue / replay on reconnect)
- Push notifications
- Background sync

## Enables

Once PWA works:
- **Members can install the wiki as an app** on their phone or desktop — standalone window, home screen icon
- **Previously-visited pages are readable offline** — API responses cached by service worker
- **Faster repeat visits** — static assets served from cache

## Prerequisites

- Responsive design — **done** (implemented alongside PWA)
- Vite build pipeline — **done**
- CloudFront deployment — **done**

## North Star

A family member adds BlueFinWiki to their home screen and opens it like a native app. The wiki loads instantly on repeat visits. If they lose connection, they can still read pages they recently visited.

## Done Criteria

### Manifest
- The web app manifest shall declare `name`, `short_name`, `theme_color`, `background_color`, `display: standalone`, `start_url: /`
- The manifest shall reference icons at 64x64, 192x192, and 512x512 sizes
- The manifest shall include a maskable icon for Android adaptive icons

### Service Worker
- A service worker shall precache all Vite-built assets (JS, CSS, HTML, icons)
- The service worker shall use `autoUpdate` registration — new versions activate immediately
- API requests (`/api/*`) shall use NetworkFirst caching with a 3-second timeout fallback to cache
- The API cache shall expire entries after 24 hours and hold a maximum of 100 entries

### Icons
- PWA icons shall be generated from `public/favicon.svg` using `@vite-pwa/assets-generator`
- Icons: `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`

### Meta Tags
- `index.html` shall include `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, and `<meta name="apple-mobile-web-app-capable">`
- The viewport meta shall include `viewport-fit=cover` for iOS safe area support

### Deployment
- The service worker file (`sw.js`) shall be served with no-cache headers from CloudFront
- The deploy workflow shall ensure `sw.js` is not served with the 1-hour asset cache

## Constraints

- **vite-plugin-pwa** — uses Workbox under the hood, standard Vite ecosystem plugin
- **No custom service worker code** — rely on the plugin's generated worker and Workbox strategies
- **20-user family wiki** — cache sizes and strategies optimized for small scale

## References

- [Design](../design.md) — Frontend architecture
- [Mobile Responsive](mobile.md) — Responsive layout (companion plan)
- vite-plugin-pwa documentation

## Error Policy

Service worker registration failures should be logged but not block the app. The wiki must work without the service worker (graceful degradation). Users on browsers that don't support service workers get the standard web experience.
