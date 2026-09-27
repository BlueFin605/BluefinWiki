# Step 1.4 — Editor formatting keymap (§0.7)

| | |
|---|---|
| Phase | 1 — Cross-cutting enablers |
| Gap refs | §0.7 keyboard shortcuts; punch list 🟠 "Editor keymaps … missing" |
| Impact | 🟠 |
| Depends on | none |
| Est. size | S |

## Problem

The CodeMirror keymap in `shared/codemirror/wiki-codemirror.ts` has only
`Mod-s` (save) plus defaults. Missing vs React's editor keymap:

| Chord | Action |
|---|---|
| `Ctrl/Cmd+B` | bold (wrap `**…**`) |
| `Ctrl/Cmd+I` | italic (wrap `*…*`) |
| `` Ctrl/Cmd+` `` | inline code (wrap `` `…` ``) |
| `Ctrl/Cmd+Shift+X` | strikethrough (wrap `~~…~~`) |
| `Ctrl/Cmd+K` | insert link — **and this must win over the global Search `Ctrl/Cmd+K`** while the editor is focused |

## Target behaviour

- Each chord runs the **same** action the toolbar buttons already run
  (`wiki-codemirror.applyAction` / `markdown-toolbar` action ids) — wrap
  selection, or insert placeholder at cursor.
- `Ctrl/Cmd+K` in the focused editor inserts a link and **stops propagation**
  so `pages-view`'s `@HostListener` Search shortcut does not also fire. React:
  "editor keymap wins over Search".
- Chords return `true` from their CodeMirror command handlers (prevents default
  + marks handled).

## Implementation notes

**Files:** `shared/codemirror/wiki-codemirror.ts` (keymap extension),
possibly `features/pages/pages-view.ts` (ensure its `Ctrl/Cmd+K` handler
ignores the event when it originates inside the editor / when
`event.defaultPrevented`).

- Add a `keymap.of([...])` entry alongside the existing `Mod-s`. Use
  `Mod-b`, `Mod-i`, `Mod-\``, `Mod-Shift-x`, `Mod-k`.
- Reuse the existing action functions — do not duplicate the wrap logic.
- For the Search precedence: simplest is the CM command calls
  `event`-less but returns `true`; CodeMirror will `preventDefault`. Then in
  `pages-view` guard the host listener with
  `if (e.defaultPrevented) return;` and/or
  `if ((e.target as HTMLElement).closest('.cm-editor')) return;`.

## Tests first (TDD)

- `wiki-codemirror.spec.ts`: dispatching each chord on a doc with a selection
  wraps it with the right markers; on an empty selection inserts the
  placeholder. `Mod-k` triggers the link action.
- `pages-view.spec.ts`: a `keydown` `Ctrl+K` whose target is inside `.cm-editor`
  (or with `defaultPrevented`) does **not** open the Search dialog; a global
  `Ctrl+K` still does.

## Acceptance criteria

- [ ] `Ctrl/Cmd+B / I / \` / Shift+X` format text in the editor.
- [ ] `Ctrl/Cmd+K` in the editor inserts a link and does not open Search.
- [ ] `Ctrl/Cmd+K` outside the editor still opens Search.
- [ ] Chords reuse the toolbar action functions.
- [ ] Tests cover each chord + the Search precedence.

## Out of scope

- Adding Image / Attachment toolbar buttons (→ 3.4).
- Tree arrow-key navigation (→ 2.3).
