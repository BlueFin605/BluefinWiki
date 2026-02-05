# Aspire Scripts - Database Initialization

Scripts for setting up and managing DynamoDB tables in the local development environment.

## Available Scripts

### `npm run init-db`
Creates all DynamoDB tables in LocalStack with the correct schema.

**Tables created:**
- bluefinwiki-users-local (with email-index GSI)
- bluefinwiki-invitations-local (with TTL)
- bluefinwiki-page-links-local (with targetGuid-index GSI)
- bluefinwiki-attachments-local (with pageGuid-index GSI)
- bluefinwiki-comments-local (with pageGuid-createdAt-index GSI)
- bluefinwiki-activity-log-local (with TTL)
- bluefinwiki-user-preferences-local
- bluefinwiki-site-config-local

**Usage:**
```bash
npm run init-db
```

### `npm run seed`
Populates tables with test data for local development.

**Data created:**
- 2 test users (admin and standard)
- 2 invitation codes
- Site configuration
- User preferences

**Test Credentials:**
- Admin: `admin@bluefinwiki.local` / `Test123!`
- User: `user@bluefinwiki.local` / `Test123!`

**Invite Codes:**
- `WELCOME1` → newuser1@bluefinwiki.local
- `WELCOME2` → newuser2@bluefinwiki.local

**Usage:**
```bash
npm run seed
```

### `npm run setup`
Runs both init-db and seed in sequence (convenience command).

**Usage:**
```bash
npm run setup
```

## Prerequisites

1. LocalStack must be running (started by Aspire):
   ```bash
   dotnet run --project ../BlueFinWiki.AppHost
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Environment Variables

Scripts use these environment variables (defaults shown):

```bash
AWS_ENDPOINT=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

## Troubleshooting

**Error: "Failed to connect to LocalStack"**
- Ensure Aspire is running
- Check LocalStack health: `curl http://localhost:4566/_localstack/health`

**Error: "ResourceNotFoundException"**
- Run `npm run init-db` before `npm run seed`

**Tables already exist**
- The init-db script checks for existing tables and skips them
- To start fresh, delete the localstack-data directory and restart Aspire

## Files

- **init-dynamodb.js** - Creates DynamoDB tables
- **seed-data.js** - Inserts test data
- **package.json** - Dependencies and scripts

## See Also

- [LOCAL-DATABASE-SETUP.md](../LOCAL-DATABASE-SETUP.md) - Full setup guide
- [DATABASE-SCHEMA.md](../../DATABASE-SCHEMA.md) - Schema documentation
