# Step 0.7 — Scope the editor-crash handler

| | |
|---|---|
| Phase | 0 — Auth & app-shell correctness |
| Gap refs | F11; §10 "Editor Crashed"; punch list 🟠 "Global error handler is unscoped" |
| Impact | 🟠 |
| Depends on | none |
| Est. size | M |

## Problem

`GlobalErrorHandler` (`core/error/global-error-handler.ts`) catches **any**
unhandled app error, writes it into `EditorErrorState`
(`core/error/editor-error-state.ts`), and pops a generic snackbar. As a result
`PageDetail` shows an "editor crashed" inline panel for errors that have nothing
to do with the editor. There is no autosave-reassurance copy and no "Reload
Page" affordance distinct from the snackbar.

React scopes editor-crash UI to the **editor subtree only**
(`EditorErrorBoundary`): an "Editor Crashed" card with *Try Again* / *Reload
Page* and autosave reassurance; reset clears the active page.

## Target behaviour

- Generic unhandled errors → snackbar with a *Reload* action **only**. They do
  **not** populate `EditorErrorState` and do **not** render the editor-crash
  panel.
- Editor-originated failures → the inline "Editor Crashed" card in `PageDetail`
  with:
  - *Try Again* (reset — clears the active page / re-inits the editor),
  - *Reload Page* (`window.location.reload()`),
  - reassurance copy: your work is autosaved locally; reloading is safe.
- Determine "editor-originated" explicitly, not by catching everything:
  wrap the editor surface (`wiki-codemirror` / the edit-mode subtree in
  `page-detail.ts`) so its errors call `editorErrorState.set(...)`; everything
  else goes only through `GlobalErrorHandler`.

## Implementation notes

**Files:** `core/error/global-error-handler.ts`,
`core/error/editor-error-state.ts`, `features/pages/page-detail.ts`
(edit-mode template + a local try/catch or an error-capturing wrapper)

- Angular has no component-level error boundary primitive; options:
  1. A small `EditorErrorBoundaryComponent` that implements `ErrorHandler`
     scoped via `providers` on the editor subtree, or
  2. Explicit `try/catch` around editor init / apply-action / autosave paths
     that routes to `EditorErrorState`.
  Option 1 is closer to React and cleaner — prefer it.
- `GlobalErrorHandler`: remove the `EditorErrorState` write; keep console
  logging + snackbar (snackbar gets a *Reload* action button).
- `EditorErrorState` keeps its shape; only its *writers* narrow.
- Reassurance copy lives in the `PageDetail` editor-crash template.

## Tests first (TDD)

- `global-error-handler.spec.ts`: an arbitrary thrown error → snackbar with
  *Reload* action; `EditorErrorState` untouched.
- `page-detail.spec.ts` (Testing Library): an error thrown from the editor
  subtree → "Editor Crashed" card with *Try Again* + *Reload Page* +
  reassurance text; *Try Again* clears the active page; a non-editor error does
  **not** show the card.

## Acceptance criteria

- [ ] Non-editor errors never render the editor-crash panel.
- [ ] Editor errors render the card with *Try Again*, *Reload Page*, reassurance.
- [ ] Generic snackbar has a *Reload* action.
- [ ] Tests cover both paths.

## Out of scope

- Restyling the load-error / loading states (⚪).
