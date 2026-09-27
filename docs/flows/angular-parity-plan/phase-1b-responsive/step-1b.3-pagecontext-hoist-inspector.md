# Step 1b.3 — PageContext service + hoist the inspector

| | |
|---|---|
| Phase | 1b — Responsive / mobile layer |
| Design | DESIGN.md D3, §"PageContext service" |
| Gap refs | §3.4 "Inspector panel — Panel placement"; F4; F5 |
| Impact | 🔴 Functional (largest step in 1b) |
| Depends on | 1b.1; **Phase 4** (inspector feature-complete); step 4.1 |
| Est. size | L |

## Problem

The inspector (`wiki-inspector-panel`) is rendered inside `page-detail`, which
itself sits in `<router-outlet>`. For the single hoisted `mat-sidenav-container`
(step 1b.4) to own the inspector as an `end` sidenav sibling of the routed
content, the inspector must move **up** into `pages-view`. Today
`page-detail` wires the inspector's `metadataChange` / `insertMarkdown` /
`canInsert` directly — those bindings need a channel.

## Target behaviour

- New root service `PageContext` (`features/pages/page-context.ts`):
  - signals: `guid`, `metadata`, `mode` (`'view'|'edit'`), `canInsert`
    (`computed(() => mode() === 'edit')`), and `inspectorSheetOpen` (mobile);
  - `insert$: Observable<string>` + `emitInsert(md)` (a `Subject`);
  - `toggleInspector()` — desktop → `layout.update({ inspectorVisible: !… })`;
    mobile → toggles `inspectorSheetOpen`;
  - `reset()` — clears `guid` / `metadata`.
- `page-detail`:
  - on load / mode change, pushes `guid`, `metadata`, `mode` into `PageContext`;
  - subscribes to `insert$` (via `takeUntilDestroyed`) and routes the markdown
    into `wiki-codemirror` at the cursor (the same `onInsertMarkdown` it has
    today);
  - `metadata` is now **owned by `PageContext`** — `page-detail` reads it from
    there (it still needs it for dirty-detection / title); the inspector's
    `metadataChange` writes back to `PageContext.metadata`;
  - its `.bar` inspector button calls `pageContext.toggleInspector()`;
  - calls `pageContext.reset()` on destroy.
- `pages-view` renders `<wiki-inspector-panel>` from `PageContext` (the actual
  sidenav placement + responsive mode is step 1b.5; this step can park it in the
  existing static position and just prove the data channel).

## Implementation notes

**Files:** new `features/pages/page-context.ts`,
`features/pages/page-detail.ts` (remove the inspector from its template + the
`mat-sidenav-container` wrapper — see step 1b.4 for the container; here just
detach the inspector and publish to `PageContext`),
`features/pages/pages-view.ts` (render the inspector).

- Keep `page-detail`'s dirty-detection working — it compares `metadata` fields
  to the server baseline; point it at `PageContext.metadata()`.
- `EditorErrorState` / editor-crash scoping (step 0.7) is unaffected — the
  editor stays in `page-detail`.
- Do this step with Phase 3 (Split view, save pill) already merged so the
  `page-detail` template is in its final shape before you carve the inspector
  out.

## Tests first (TDD)

- `page-context.spec.ts`: `canInsert` tracks `mode`; `emitInsert` pushes to
  `insert$`; `toggleInspector` hits `Layout` on desktop and the sheet signal on
  mobile (with the `Breakpoint` stub); `reset` clears.
- `page-detail.spec.ts`: on load it publishes `guid`/`metadata`/`mode`;
  an `emitInsert('![x](x.png)')` inserts into the editor; `metadataChange` from
  the inspector updates dirty-detection; destroy calls `reset()`.
- `pages-view.spec.ts`: renders the inspector panel bound to `PageContext`;
  no inspector when `guid()` is null.

## Acceptance criteria

- [ ] `PageContext` service exists with the signals + `insert$` + `toggle` +
      `reset`.
- [ ] The inspector renders from `pages-view`, fed by `PageContext`.
- [ ] `insertMarkdown` from the inspector reaches the editor cursor.
- [ ] `metadataChange` still drives dirty-detection.
- [ ] `page-detail` no longer renders the inspector or owns a sidenav container.
- [ ] Service + both components unit-tested.

## Out of scope

- The responsive sidenav mode / bottom-sheet styling (→ 1b.5).
- The tree drawer / shell container (→ 1b.4).
