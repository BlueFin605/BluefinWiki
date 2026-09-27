# Step 7.3 — AI instruction injection

| | |
|---|---|
| Phase | 7 — AI sidebar |
| Gap refs | §3.7 "Instruction picker"; §11 checklist; punch list 🔴 #13 |
| Impact | 🔴 Functional |
| Depends on | — |
| Est. size | M |

## Problem

`AiInstructions` service is fully ported (`listInstructions`,
`getInstructionContent`, `createInstruction` with lazy root creation). But
`instruction-picker.ts` is a plain `mat-select multiple` that **never calls
`getInstructionContent`**, `AiSidebar` **never reads `getSelected()`**, and
**nothing injects instruction text into the session**. Selecting instructions
has **no effect**. No "In context" lock. No "Create" button.

## Target behaviour

- On starting / continuing a chat, the selected instructions' **content**
  (`getInstructionContent`) is injected into the session — as a system turn or
  prepended context, matching how React injects it.
- Once injected, an instruction is **locked** ("In context") in the picker and
  cannot be removed until **New chat** (React: "locked until New chat").
- A **"Create"** button in the picker: calls `AiInstructions.createInstruction`
  (which lazily creates the "AI Instructions" root page and adds a child), then
  navigates to the new instruction's editor (`/pages/:guid/edit`).
- "New chat" clears messages/usage/loaded instructions but **keeps the
  selection** (React parity).

## Implementation notes

**Files:** `features/ai/instruction-picker.ts` (lock UI + Create button +
expose selection), `features/ai/ai-sidebar.ts` (read `getSelected()`, fetch
content, pass to `ai.ts`), `features/ai/ai.ts` (accept an
`instructionContext` and include it in the session/system turn).

- Track `loadedInstructionIds` on the session; the picker disables/locks those.
- Fetch each selected instruction's content once (cache per session).
- Create → `router.navigate(['/pages', newGuid, 'edit'])`.

## Tests first (TDD)

- `instruction-picker.spec.ts`: selecting instructions exposes them via the
  output/`getSelected`; a locked instruction shows "In context" and can't be
  unselected; "Create" calls `createInstruction` and navigates to the editor.
- `ai-sidebar.spec.ts` / `ai.spec.ts`: on send, selected instruction content is
  fetched and included in the session context; "New chat" clears loaded
  instructions but keeps the selection.

## Acceptance criteria

- [ ] Selected instruction content is actually injected into the session.
- [ ] "In context" lock until New chat.
- [ ] "Create" button creates + routes to the editor.
- [ ] New chat keeps the selection, clears the loaded content.
- [ ] Picker + sidebar + service wiring unit-tested.

## Out of scope

- The RAG context loader (already parity).
