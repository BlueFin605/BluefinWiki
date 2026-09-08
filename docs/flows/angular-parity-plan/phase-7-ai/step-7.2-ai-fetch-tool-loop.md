# Step 7.2 — AI auto fetch-tool loop

| | |
|---|---|
| Phase | 7 — AI sidebar |
| Gap refs | §3.7 "Auto fetch-tool loop"; §3.7 message roles; §11 checklist; punch list 🔴 #13 |
| Impact | 🔴 Functional |
| Depends on | — |
| Est. size | L |

## Problem

React automatically executes `fetch_url` (`POST /fetch-url`) and
`fetch_imdb_show` (`GET /imdb/show-details`), feeds the results back as the next
user turn, caps at **3 fetches/turn**, does duplicate-fetch detection + an
anti-loop nudge, and renders tool results as grey rows. Angular: **not
implemented** ("not in Phase 7's scope"). The model can *propose* these actions;
nothing runs them. `ChatRole` has no `'tool'` value.

## Target behaviour

- When a model response's `action.type` is `fetch_url` or `fetch_imdb_show`,
  the sidebar **executes it automatically** (no Apply button for these):
  - `fetch_url` → `POST /api/fetch-url` with the URL,
  - `fetch_imdb_show` → `GET /api/imdb/show-details` with the query params.
- Feed the result back into the session as the next turn (React feeds it as a
  user turn; match that), and let the model continue.
- **Cap 3 fetches per user turn.** On the 4th, stop and inject an anti-loop
  nudge instead of fetching.
- **Duplicate detection:** if the same URL/query was already fetched this turn,
  don't re-fetch — inject a "you already fetched X" nudge.
- Add `'tool'` to `ChatRole`; render tool turns as grey info rows
  (`chat-message.ts`).

## Implementation notes

**Files:** `features/ai/ai.ts` (the send/response loop), `features/ai/ai-sidebar.ts`,
`features/ai/chat-message.ts` (tool row), a `Fetch`/`AiTools` service for the
two endpoints, `features/ai/*` types (`ChatRole`).

- Loop guard: a per-turn counter + a `Set` of fetched keys, both reset when a
  new user message is sent.
- Keep the JSON response-contract parsing unchanged; only the *dispatch* of
  fetch actions is new.

## Tests first (TDD)

- `ai.spec.ts`: a response with `fetch_url` → the tool endpoint is called, its
  result is appended as a turn, the model is re-prompted; 3 sequential fetch
  actions all run, the 4th is replaced by a nudge; a repeated URL triggers the
  duplicate nudge, not a second call.
- `chat-message.spec.ts`: a `tool` role renders the grey row.

## Acceptance criteria

- [ ] `fetch_url` + `fetch_imdb_show` execute automatically and feed back.
- [ ] Hard cap of 3 fetches/turn with an anti-loop nudge.
- [ ] Duplicate-fetch detection with a nudge.
- [ ] `'tool'` role added + rendered as a grey row.
- [ ] Loop, cap, and dedupe unit-tested.

## Out of scope

- Applying create/update/delete/move actions (→ 7.1).
