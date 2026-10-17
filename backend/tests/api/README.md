# BlueFinWiki API suite

FullyRested collection (`bluefinwiki.frcol`) covering the REST API, run against the local stack.

1. Start the local stack (Aspire) so the API answers on http://localhost:3000.
2. From the BluefinWiki repo root, run the whole suite with the FullyRested CLI (build it once in `FullyRested/App/cli-command`):

```
node ../FullyRested/App/cli-command/dist/index.js run -c backend/tests/api/bluefinwiki.frcol -e local --all
```

The CLI exits 1 if any case fails. Alternatively use the FullyRested MCP `run` tool with `all: true`, environment `local`.

## Expected failures

Cases named `KNOWN FAILURE` assert the correct behaviour of a real BlueFinWiki bug, so they fail until the bug is fixed (see `GAPS.md`). Do not delete them. `get ancestors > unknown page` is the same kind. `board-order backfill > existing page` also fails when the seeded `pageGuid` is missing locally.

Current baseline: 279 passed, 12 failed (all expected). Anything else failing is a regression.

Fixture ids (`crudPageGuid`, `commentId`, ...) live in the `local` environment and must be re-created by hand if the local stack is reset.
