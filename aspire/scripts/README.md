# Aspire Scripts - Database Initialization

Scripts for setting up and managing DynamoDB tables in the local development environment.

## Available Scripts

- `npm run init-db` — creates all DynamoDB tables in LocalStack (see below).
- `npm run seed` — populates tables with test data (admin/standard users,
  invite codes, site config). See `SEED-DATA-GUIDE.md` for full detail
  including test credentials and snapshot import/export.
- `npm run setup-cognito` — creates the local Cognito user pool/client and
  test users in cognito-local.
- `npm run setup` — runs `init-db && seed && setup-cognito` in sequence.
- `npm run export-seed` / `npm run import-seed` — snapshot the current
  LocalStack data or restore from a snapshot. See `SEED-DATA-GUIDE.md`.
- `npm run seed-kanban` — seeds Kanban-specific sample data (page types, board).

**Tables created by `init-db`** (see `init-dynamodb.js` for schema/GSIs):
`bluefinwiki-user-profiles-local`, `-invitations-local`, `-page-links-local`,
`-attachments-local`, `-comments-local`, `-activity-log-local`,
`-user-preferences-local`, `-page-index-local`, `-tags-local`,
`-site-config-local`, `-page-types-local`.

## Prerequisites

1. LocalStack must be running (started by Aspire):
   ```bash
   dotnet run --project ../BlueFinWiki.AppHost
   ```
2. Install dependencies: `npm install`

## Environment Variables

```bash
AWS_ENDPOINT=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

## Troubleshooting

**Error: "Failed to connect to LocalStack"** — ensure Aspire is running; check
`curl http://localhost:4566/_localstack/health`.

**Error: "ResourceNotFoundException"** — run `npm run init-db` before `npm run seed`.

**Tables already exist** — `init-db` checks for existing tables and skips
them; to start fresh, delete the localstack-data directory and restart Aspire.

## See Also

- [SEED-DATA-GUIDE.md](SEED-DATA-GUIDE.md) — full seed-data reference (test
  credentials, invite codes, snapshot import/export) — this is the
  authoritative doc for what gets seeded.
- [LOCAL-DATABASE-SETUP.md](../LOCAL-DATABASE-SETUP.md) — full local DB setup guide.
