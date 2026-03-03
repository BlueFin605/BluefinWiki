# Aspire Scripts - Database & Seed Data Management

Scripts for setting up and managing DynamoDB tables and S3 seed data in the local development environment.

## Quick Start

```bash
# First-time setup (creates tables, seeds data, sets up Cognito)
npm run setup

# Export current data as seed snapshot
npm run export-seed

# Import seed snapshot (after resetting environment)
npm run import-seed -- --source ./seed-snapshots/2026-03-03
```

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
- Sample wiki pages in S3 (Welcome, Recipes, Family Tree)

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

### `npm run export-seed`
**NEW!** Exports all current S3 and DynamoDB data to a timestamped snapshot directory.

Use this to capture your current test data state and create reusable seed data for future environments.

**What gets exported:**
- All S3 objects from:
  - `bluefinwiki-pages-local` bucket (wiki pages)
  - `bluefinwiki-attachments-local` bucket (file attachments)
  - `bluefinwiki-exports-local` bucket (exported content)
- All DynamoDB items from:
  - Users, invitations, site config, preferences
  - Comments, page links, attachments metadata
  - Activity logs

**Output structure:**
```
seed-snapshots/
  2026-03-03/
    dynamodb/
      users.json
      invitations.json
      attachments.json
      comments.json
      page-links.json
      site-config.json
      user-preferences.json
      activity-log.json
    s3/
      pages/
        {guid}/{guid}.md
        {parent-guid}/{child-guid}/{child-guid}.md
      attachments/
        {guid}/{filename}
      exports/
        {export-id}.{format}
    metadata.json
```

**Usage:**
```bash
# Export to default timestamped directory (./seed-snapshots/YYYY-MM-DD)
npm run export-seed

# Export to custom directory
npm run export-seed -- --output ./my-snapshots/feature-123
```

**When to use:**
- After manually creating test pages/data you want to reuse
- Before adding new features (capture baseline state)
- To version control your test data
- When sharing test data with team members

### `npm run import-seed`
**NEW!** Imports S3 and DynamoDB data from a previously exported snapshot.

Use this to quickly restore your environment to a known state with rich test data.

**Usage:**
```bash
# Import from a specific snapshot
npm run import-seed -- --source ./seed-snapshots/2026-03-03

# Import from custom location
npm run import-seed -- --source ./my-snapshots/feature-123
```

**What happens:**
1. Ensures S3 buckets exist (creates if missing)
2. Uploads all files to appropriate S3 buckets
3. Imports all records to DynamoDB tables
4. Skips missing data gracefully (if a bucket/table has no data)

**Best practices:**
- Always run `npm run init-db` first to ensure tables exist
- Import will **add to** existing data (not replace)
- For clean slate: reset LocalStack, then init-db, then import-seed

### `npm run setup-cognito`
Sets up Cognito user pool in LocalStack for authentication testing.

**Usage:**
```bash
npm run setup-cognito
```

### `npm run setup`
Runs full environment setup in sequence (convenience command).

Executes: init-db → seed → setup-cognito

**Usage:**
```bash
npm run setup
```

## Seed Data Workflow

### Scenario 1: Initial Development
```bash
# Set up environment with baseline data
npm run setup

# Work on your features, create test data manually
# (create pages, upload attachments, etc.)

# Export your enriched test data
npm run export-seed
```

### Scenario 2: Add New Feature
```bash
# Capture current state before starting
npm run export-seed -- --output ./seed-snapshots/before-feature-x

# Implement feature, create relevant test data

# Export new state with feature data
npm run export-seed -- --output ./seed-snapshots/with-feature-x
```

### Scenario 3: Reset to Clean State
```bash
# Stop Aspire
# Delete aspire/BlueFinWiki.AppHost/localstack-data directory
# Restart Aspire

# Recreate tables
cd aspire/scripts
npm run init-db

# Restore from your snapshot
npm run import-seed -- --source ./seed-snapshots/2026-03-03
```

### Scenario 4: Share Test Data with Team
```bash
# Export your test data
npm run export-seed -- --output ./seed-snapshots/team-baseline

# Commit the snapshot to git (or share via other means)
git add seed-snapshots/team-baseline
git commit -m "Add baseline test data snapshot"

# Team members can import:
npm run import-seed -- --source ./seed-snapshots/team-baseline
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

**Export shows 0 objects**
- Ensure you have data in LocalStack (run `npm run seed` first)
- Check that Aspire/LocalStack is running

**Import fails with "NotFound"**
- Run `npm run init-db` before importing
- Verify the source path exists and contains data

## Files

- **init-dynamodb.js** - Creates DynamoDB tables
- **seed-data.js** - Inserts baseline test data (DynamoDB + S3)
- **export-seed-data.js** - Exports current state to snapshot
- **import-seed-data.js** - Imports snapshot to LocalStack
- **setup-cognito-local.js** - Configures Cognito user pool
- **package.json** - Dependencies and scripts

## See Also

- [LOCAL-DATABASE-SETUP.md](../LOCAL-DATABASE-SETUP.md) - Full setup guide
- [DATABASE-SCHEMA.md](../../DATABASE-SCHEMA.md) - Schema documentation
- [ASPIRE-LOCAL-DEV.md](../ASPIRE-LOCAL-DEV.md) - Aspire development guide
