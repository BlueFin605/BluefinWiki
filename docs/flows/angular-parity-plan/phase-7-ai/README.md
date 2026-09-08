# Phase 7 — AI sidebar

**Goal:** make the AI sidebar functional. Today it can hold a RAG conversation
and render action previews, but **applying actions, the fetch-tool loop, and
instruction attachment are all non-functional** — it is largely a display shell.

**Depends on:** step 1.2 (per-resource invalidation) so the action runner
invalidates precisely. `AiInstructions` service is already fully ported.

**Already parity:** Prompt API engine + availability states, response contract /
schema, per-turn RAG context, context meter, destructive-action gate, debug
logging.

## Steps

| # | Step | Impact | Depends on |
|---|---|---|---|
| 7.1 | [Action runner](step-7.1-ai-action-runner.md) | 🔴 | 1.2 |
| 7.2 | [Auto fetch-tool loop](step-7.2-ai-fetch-tool-loop.md) | 🔴 | — |
| 7.3 | [Instruction injection](step-7.3-ai-instruction-injection.md) | 🔴 | — |
| 7.4 | [Auto-scroll to bottom](step-7.4-ai-autoscroll.md) | 🟠 | — |

Parallel-safe: 7.1 / 7.2 / 7.3 touch `ai.ts` + `ai-sidebar.ts` — sequence
7.1 → 7.2 → 7.3 to avoid churn, or split by concern carefully. 7.4 is trivial
and independent.

## Phase exit criteria

- [ ] All step acceptance criteria met; `npm test` + `npm run lint` green.
- [ ] Manual: propose a `create_page` action → Apply actually creates the page,
      the message shows applying → applied, GUIDs in the card render as titles.
- [ ] Manual: ask something that needs a URL fetch → `fetch_url` runs
      automatically (≤3/turn), a grey tool row appears, the model continues with
      the result.
- [ ] Manual: attach an instruction → its content is in the session; the picker
      locks it "In context" until New chat; "Create" makes a child under
      "AI Instructions" and opens its editor.
- [ ] Manual: the transcript auto-scrolls to the newest message.
