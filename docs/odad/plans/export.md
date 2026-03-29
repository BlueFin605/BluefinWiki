---
description: Plan for PDF and HTML export — Puppeteer Lambda, HTML bundler, export UI
tags: [bluefinwiki, plan, export, pdf, html]
audience: { human: 30, agent: 70 }
purpose: { plan: 95, design: 5 }
---

# Plan: Export Functionality

Implements: [Design](../design.md) — Lambda compute, S3 storage

## Scope

**Covers:**
- PDF export API (GET /pages/{guid}/export/pdf)
- HTML export API with children (GET /pages/{guid}/export/html)
- Puppeteer setup in Lambda for PDF rendering
- Export UI (dropdown, progress indicator, download)

**Does not cover:**
- PDF caching (post-MVP)
- Service worker for offline viewing (P3)
- Print CSS optimization (P3)

## Enables

Once export exists:
- **Members can share pages outside the wiki** — PDF for email/print
- **Members can archive wiki sections** — HTML bundle as backup
- **Members can produce printable content** — formatted PDF with headers/footers

## Prerequisites

- Page CRUD and storage plugin — **done**
- Markdown rendering (react-markdown pipeline) — **done** (frontend), needs server-side equivalent for PDF
- Lambda with sufficient memory — allocate 1024MB+ for Puppeteer

## North Star

A family member should be able to click "Export" and get a professional-looking PDF or a self-contained HTML archive — without installing anything.

## Done Criteria

### PDF Export API
- The `export-pdf` endpoint shall render page content as HTML with print-friendly CSS
- The endpoint shall use Puppeteer (via Lambda layer with Chromium binary) to generate PDF
- The PDF shall include: page title as header, author and date, page numbers in footer
- The PDF shall preserve code block syntax highlighting and table formatting
- The endpoint shall upload PDF to S3 and return a presigned download URL (1-hour expiry)
- When the page is larger than what Lambda can process in 30 seconds, the endpoint shall return 504 with "Page too large for export"

### HTML Export API
- The `export-html` endpoint shall fetch the target page and all descendant pages recursively
- Each page shall be rendered as static HTML with inline CSS
- The bundle shall include a navigation page with TOC linking all included pages
- Attachments shall be included in the bundle with relative link paths
- The endpoint shall create a ZIP archive and upload to S3
- The endpoint shall return a presigned download URL

### Export UI
- The page actions area shall include an "Export" dropdown with: "Export as PDF" and "Export as HTML (with children)"
- Clicking an export option shall show a progress indicator
- On completion, the download shall start automatically
- For HTML export with many children, the UI shall show "Exporting X of Y pages"
- On error, show a clear message ("Export failed — page may be too large")

## Constraints

- **Lambda 30-second timeout** for PDF generation — large pages may fail
- **Puppeteer Lambda layer** — requires Chromium binary as Lambda layer (~50MB). Use `@sparticuz/chromium` or equivalent.
- **No PDF caching** — each export generates fresh. Post-MVP: cache with content hash.
- **Server-side Markdown rendering** — need a Node.js Markdown-to-HTML pipeline matching the frontend rendering (same remark plugins) for PDF accuracy

## References

- [Design](../design.md) — Lambda compute, S3 storage
- [North Star](../north-star.md) — Portability & Export declarations
- [@sparticuz/chromium](https://github.com/Sparticuz/chromium) — Chromium binary for Lambda
- [Puppeteer](https://pptr.dev/) — headless browser API for PDF generation

## Error Policy

PDF generation failure: return 500 with specific error. Lambda timeout: return 504. S3 upload failure: return 500. ZIP creation failure: return 500. All errors include human-readable messages.
