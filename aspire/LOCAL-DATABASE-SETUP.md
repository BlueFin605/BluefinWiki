# Local Database Setup Guide

This guide explains how to set up and use DynamoDB tables for local development with LocalStack.

## Prerequisites

- Node.js 20+ installed
- LocalStack running (automatically started by Aspire)
- AWS CLI installed (optional, for manual queries)

## Quick Start

### 1. Start Aspire (which starts LocalStack)

```powershell
dotnet run --project aspire/BlueFinWiki.AppHost
```

This will start:
- LocalStack (DynamoDB + S3 + SES) on port 4566
- MailHog (email testing) on port 8025
- Backend API on port 3000
- Frontend on port 5173

### 2. Initialize Database Tables

```powershell
cd aspire/scripts
npm install
npm run init-db
```

This creates all 11 DynamoDB tables in LocalStack with the correct schema.

### 3. Seed Test Data

```powershell
npm run seed
```

This populates the tables with:
- **2 test users**:
  - Admin: `admin@bluefinwiki.local` / `Test123!`
  - Standard: `user@bluefinwiki.local` / `Test123!`
- **2 invitation codes**:
  - `WELCOME1` for `newuser1@bluefinwiki.local`
  - `WELCOME2` for `newuser2@bluefinwiki.local`
- **Site configuration** (wiki name, features, email settings)
- **User preferences** (theme, language, dashboard layout)

### 4. Verify Setup

View tables:
```powershell
aws dynamodb list-tables --endpoint-url http://localhost:4566 --region us-east-1
```

Query users:
```powershell
aws dynamodb scan --table-name bluefinwiki-user-profiles-local --endpoint-url http://localhost:4566 --region us-east-1
```

## Tables Created

1. **bluefinwiki-user-profiles-local** - User accounts and authentication
2. **bluefinwiki-invitations-local** - Registration invite codes
3. **bluefinwiki-page-links-local** - Wiki link relationships (backlinks)
4. **bluefinwiki-activity-log-local** - Audit trail and user activity
5. **bluefinwiki-page-index-local** - Search/listing index over pages
6. **bluefinwiki-tags-local** - Tag registry
7. **bluefinwiki-page-types-local** - Page-type schema definitions
8. **bluefinwiki-attachments-local** - File attachment metadata (local-only, no production equivalent yet)
9. **bluefinwiki-comments-local** - Page comments and discussions (local-only, no production equivalent yet)
10. **bluefinwiki-user-preferences-local** - User settings and customizations (local-only, no production equivalent yet)
11. **bluefinwiki-site-config-local** - Global wiki configuration (local-only, no production equivalent yet)

## Reset Database

To completely reset the database:

```powershell
# Stop Aspire (Ctrl+C)
# Delete LocalStack data
Remove-Item -Recurse -Force aspire/BlueFinWiki.AppHost/localstack-data

# Restart Aspire
dotnet run --project aspire/BlueFinWiki.AppHost

# Reinitialize
cd aspire/scripts
npm run init-db
npm run seed
```

## Manual Table Operations

### Create a User

```javascript
// Using AWS SDK
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userId = uuidv4();
const passwordHash = await bcrypt.hash('password123', 10);

await docClient.send(new PutCommand({
  TableName: 'bluefinwiki-user-profiles-local',
  Item: {
    userId,
    email: 'test@example.com',
    passwordHash,
    role: 'Standard',
    status: 'active',
    displayName: 'Test User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}));
```

### Query by Email

```javascript
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');

const result = await docClient.send(new QueryCommand({
  TableName: 'bluefinwiki-user-profiles-local',
  IndexName: 'email-index',
  KeyConditionExpression: 'email = :email',
  ExpressionAttributeValues: {
    ':email': 'admin@bluefinwiki.local'
  }
}));
```

## Troubleshooting

### Tables not visible

**Check LocalStack is running**:
```powershell
curl http://localhost:4566/_localstack/health
```

**Verify environment variables**:
```powershell
$env:AWS_ENDPOINT = "http://localhost:4566"
$env:AWS_REGION = "us-east-1"
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
```

### Seed script fails

**Install dependencies**:
```powershell
cd aspire/scripts
npm install
```

**Check table exists first**:
```powershell
npm run init-db
npm run seed
```

### Connection refused

- Ensure LocalStack port 4566 is not blocked by firewall
- Check Aspire Dashboard at http://localhost:15888 for service status
- Verify LocalStack container is running

## Production Deployment

For production (AWS DynamoDB):

1. Tables are created via AWS CDK in `infrastructure/src/Infrastructure/Stacks/UnifiedStack.cs` (only 7 of the 11 local tables have a production equivalent — see the local-only note in "Tables Created" above)
2. `cdk deploy` (see `../DEPLOY-AWS.md`) creates the whole stack, tables included
3. Tables use environment-specific names, e.g. `bluefinwiki-user-profiles-production`
4. No seed data in production (create admin via registration)
