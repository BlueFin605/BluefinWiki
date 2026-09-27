# Phase 3 — Editor & preview

**Goal:** bring the editor toolbar, view modes, save affordances, breadcrumbs,
and the markdown preview pipeline to React parity.

**Depends on:** Phase 1 — step 1.3 (layout store) for the Split-view divider,
step 1.4 (keymap) already done. Step 2.7 pairs with step 3.8.

## Steps

| # | Step | Impact | Depends on |
|---|---|---|---|
| 3.1 | [Split view](step-3.1-split-view.md) | 🔴 | 1.3 |
| 3.2 | [Refresh button](step-3.2-refresh-button.md) | 🔴 | — |
| 3.3 | [Save-status pill + failure copy](step-3.3-save-status-pill.md) | 🟠 | — |
| 3.4 | [Toolbar: Image + Attachment + compact](step-3.4-markdown-toolbar-image-attachment.md) | 🔴 | 1b.6 (mobile parts) |
| 3.5 | [Breadcrumbs: Home + collapse](step-3.5-breadcrumbs-home-collapse.md) | 🟠 | 1b.7 (mobile collapse) |
| 3.6 | [`[[` autocomplete outside-click dismiss](step-3.6-link-autocomplete-outside-dismiss.md) | ⚪→do | — |
| 3.7 | [Preview: attachment URLs + authed images + resize](step-3.7-preview-attachments-authed-images.md) | 🔴 | — |
| 3.8 | [Preview: anchors + wiki-links + broken-link resolver](step-3.8-preview-anchor-and-wiki-links.md) | 🟠 | pairs w/ 2.7 |
| 3.9 | [Preview: typography polish](step-3.9-preview-typography-polish.md) | ⚪→🟠 | — |
| 3.10 | [Table of Contents](step-3.10-table-of-contents.md) | 🔴 | 1b.8 (mobile bar) |

Parallel-safe: 3.2, 3.3, 3.6, 3.9 are independent. 3.7 & 3.8 both touch the
pipeline — sequence 3.7 → 3.8. 3.1 after 1.3. 3.10 standalone.

## Phase exit criteria

All ticked items below are jsdom / Testing-Library verified (83 suites / 613
tests green, `npm run lint` clean at `2cc674f`). Real-browser drag-feel and
scroll smoothness smoke checks are still owed — see follow-ups.

- [x] All step acceptance criteria met; `npm test` + `npm run lint` green
      (whole-branch review passed *with fixes* — 1 Critical + 6 Important fixed
      in `59a93b7` / `2cc674f`; Minor findings rolled to the branch-finish sweep).
- [x] `Edit | Split | Preview` control; Split shows live preview and its
      divider position persists.
- [x] Refresh discards the draft and reloads from server.
- [x] save-status pill cycles Read-only / Saving… / ● Unsaved / ✓ Saved;
      a failed save keeps the draft and shows the reassurance banner.
- [x] toolbar has Image + Attachment; attachment upload from the toolbar
      inserts markdown at the cursor (also drains a queued insert if fired
      from Preview sub-mode — I1 fix).
- [x] breadcrumb starts with Home (clears selection); long trails collapse.
- [x] an image referenced by bare filename renders via an authed request;
      `![alt|300]` can be drag-resized and the markdown updates (resize now
      targets by document-order index, not alt text — I2 fix).
- [x] `#heading` links smooth-scroll; `[[Page]]` links navigate and never
      404 on a title — unresolved / failed-resolve targets render as inert
      non-navigable anchors, never a bare-title href (C1 fix); a genuinely
      missing target renders broken + opens the create modal.
- [x] a doc with ≥3 headings shows the TOC rail with active-heading tracking.
