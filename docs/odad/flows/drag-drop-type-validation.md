---
description: Flow for validating page type constraints during drag-and-drop reparenting in the page tree
tags: [bluefinwiki, flow, drag-drop, page-types, validation, tree]
audience: { human: 40, agent: 60 }
purpose: { flow: 90, design: 10 }
---

# Flow: Drag-Drop Type Validation

Implements: [Page Types Plan](../plans/kanban/page-types.md) — type constraint enforcement on move
Relates to: [Reorder Plan](../plans/reorder.md) — drag-drop in page tree

## Purpose

When a user drags a page onto another page in the sidebar tree (reparent operation), the system checks whether the move is allowed by the page type constraints of both the parent and the child. This prevents accidental structural mistakes — like dragging an Episode under the wrong parent — while keeping the system advisory (warn, not block).

## Trigger

User drags a page in the sidebar tree and hovers over a target page in the "onto" drop position (reparent, not reorder).

## Preconditions

- `pageTypesMap` is already loaded in the tree (fetched once at tree root level)
- Both the dragged page and the target page have their `pageType` available in the page summary data

## Flow

### During Drag (hover over target)

```
1. User drags page A over target page B in "onto" position
2. Frontend reads:
   - A.pageType → look up A's type definition from pageTypesMap
   - B.pageType → look up B's type definition from pageTypesMap
3. Run two checks:

   CHECK 1 — Parent allows this child? (B's perspective)
   ├─ B has no pageType → PASS (untyped parents accept anything)
   ├─ A has a pageType:
   │  ├─ B.allowedChildTypes is empty → PASS (no restriction)
   │  └─ B.allowedChildTypes is non-empty → A.pageType must be in the list
   └─ A has no pageType:
      └─ B.allowWikiPageChildren must be true

   CHECK 2 — Child allows this parent? (A's perspective)
   ├─ A has no pageType → PASS (untyped pages accept any parent)
   ├─ A.allowedParentTypes is empty → PASS (no restriction)
   ├─ A.allowedParentTypes is non-empty:
   │  ├─ B has a pageType → B.pageType must be in A.allowedParentTypes
   │  └─ B has no pageType → A.allowAnyParent must be true
   └─ (allowedParentTypes can list multiple type GUIDs — the child
       can be placed under any of those parent types)

4. If BOTH checks pass:
   → Show normal drop indicator (blue dashed border, standard "onto" style)

5. If EITHER check fails:
   → Show warning drop indicator:
     - Amber/orange dashed border instead of blue
     - Small warning icon (⚠) next to the drop target
     - Tooltip: "{Child type} cannot be placed under {Parent type}"
```

### On Drop (user releases)

```
6a. If checks passed (normal indicator was shown):
    → Proceed with move immediately (existing movePage behaviour)

6b. If checks failed (warning indicator was shown):
    → Show confirmation dialog:
      Title: "Type constraint warning"
      Body: "Moving {page title} under {target title} violates type rules:
             • {specific violation message(s)}"
      Actions: [Cancel] [Move Anyway]

    → "Cancel": abort the drop, page returns to original position
    → "Move Anyway": proceed with movePage (advisory, not blocking)
```

### Backend (move endpoint)

```
7. PUT /pages/{guid}/move receives the move request
8. Backend runs the same two checks (allowedChildTypes + allowedParentTypes)
9. If violations found: include warnings[] in the response body
   (move still succeeds — advisory only)
10. Frontend can display a toast with backend warnings as confirmation
```

## Visual States

| State | Drop Indicator Style | Icon |
|-------|---------------------|------|
| Valid drop (type checks pass) | `bg-blue-100 border-2 border-blue-400 border-dashed` | None |
| Warning drop (type checks fail) | `bg-amber-50 border-2 border-amber-400 border-dashed` | Warning triangle |
| Invalid drop (circular ref, same page) | No indicator / cursor: not-allowed | None |

## Data Requirements

No additional API calls during drag. All data needed for validation is already available:

- **pageTypesMap**: fetched once by `usePageTypes()` at the PageTree root — contains all type definitions including `allowedChildTypes`, `allowWikiPageChildren`, `allowedParentTypes`, and `allowAnyParent`
- **page.pageType**: available on every `PageSummary` in the tree

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Dragged page has no type, target has no type | Always allowed — standard wiki behaviour |
| Dragged page has deleted/unknown type | Treat as untyped — no child-side constraints apply |
| Target page has deleted/unknown type | Treat as untyped — no parent-side constraints apply |
| Reorder (before/after, same parent) | No type check needed — page stays under same parent |
| Multiple violations (both checks fail) | Show both messages in the confirmation dialog |

## Examples

### TV Tracker hierarchy: Show → Season → Episode

**Type definitions:**
- **Show**: `allowedChildTypes: [Season]`, `allowedParentTypes: []` (any parent), `allowAnyParent: true`
- **Season**: `allowedChildTypes: [Episode]`, `allowedParentTypes: [Show]`, `allowAnyParent: false`
- **Episode**: `allowedChildTypes: []`, `allowWikiPageChildren: false`, `allowedParentTypes: [Season]`, `allowAnyParent: false`

**Drag scenarios:**
| Action | Check 1 (parent) | Check 2 (child) | Result |
|--------|------------------|------------------|--------|
| Drag Season under Show | Show allows Season child | Season allows Show parent | Normal drop |
| Drag Episode under Season | Season allows Episode child | Episode allows Season parent | Normal drop |
| Drag Episode under Show | Show does NOT allow Episode child | Episode does NOT allow Show parent | Warning (both fail) |
| Drag Season under wiki page | Wiki page (untyped) = no restriction | Season does NOT allow untyped parent | Warning (check 2 fails) |
| Drag wiki page under Show | Show.allowWikiPageChildren = true? depends | Wiki page = no child-side constraints | Depends on Show config |

## References

- [Page Types Plan](../plans/kanban/page-types.md) — type model, validation rules
- [Reorder Plan](../plans/reorder.md) — drag-drop mechanics, drop position detection
- `frontend/src/components/pages/PageTree.tsx` — tree drag-drop implementation
- `frontend/src/components/pages/PageTreeItem.tsx` — drop indicator rendering
- `backend/src/pages/page-type-validation.ts` — backend validation logic
