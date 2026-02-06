# BlueFinWiki - Database Schema Design

**Version**: 1.0  
**Last Updated**: February 6, 2026  
**Status**: Implementation Complete

---

## Overview

BlueFinWiki uses **Amazon DynamoDB** for storing user data, metadata, and relational data. The database design follows DynamoDB best practices with single-table patterns where appropriate and separate tables for distinct access patterns.

### Design Principles

1. **Serverless-First**: Pay-per-request billing for most tables to minimize costs
2. **Access Pattern Driven**: Tables and GSIs designed around query patterns
3. **Cost Optimization**: Minimal GSIs, efficient key design
4. **Audit Trail**: Stream-enabled tables for change tracking
5. **Data Lifecycle**: TTL attributes for automatic cleanup

---

## Table Definitions

### 1. Authentication (AWS Cognito User Pool)

**Purpose**: Manage user authentication, passwords, and core identity

**Service**: AWS Cognito User Pool

**Configuration**:
- **User Pool Name**: `bluefinwiki-users-{environment}`
- **Username Attributes**: Email (required, unique)
- **Password Policy**: 
  - Minimum length: 8 characters
  - Require uppercase, lowercase, numbers, symbols
- **MFA**: Optional (can be enabled per-user)
- **Email Verification**: Required
- **User Attributes**:
  - `email` (required, unique)
  - `name` (display name)
  - `custom:role` (Standard | Admin)

**User Pool Client**:
- **OAuth Flows**: Authorization code + Implicit (for hosted UI if needed)
- **Token Expiration**: 
  - Access Token: 1 hour
  - Refresh Token: 30 days
- **Authentication Flow**: USER_SRP_AUTH (Secure Remote Password)

**Cognito Triggers** (Lambda):
- **Pre-token generation**: Add custom:role to JWT claims
- **Post-confirmation**: Create user profile in DynamoDB
- **Pre-signup** (optional): Validate invitation code before allowing registration

**Access Patterns**:
- User login: Cognito SDK `initiateAuth` API
- User registration: Custom Lambda with Cognito `adminCreateUser` API
- Password reset: Cognito `forgotPassword` / `confirmForgotPassword` APIs
- List users: Cognito `listUsers` API (admin only)
- Get user details: Cognito `adminGetUser` API

**Local Development**: cognito-local Docker container or mock service

---

### 2. User Profiles Table

**Purpose**: Store extended user profile data and application-specific attributes

**Table Name**: 
- Production: `bluefinwiki-user-profiles-{environment}`
- Local: `bluefinwiki-user-profiles-local`

**Primary Key**:
- **Partition Key (PK)**: `cognitoUserId` (String, Cognito sub claim)

**Attributes**:
```typescript
interface UserProfileRecord {
  cognitoUserId: string;    // Cognito sub (UUID from JWT)
  email: string;            // Synced from Cognito
  displayName: string;      // User's display name
  role: 'Admin' | 'Standard';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;        // ISO 8601 timestamp
  updatedAt: string;        // ISO 8601 timestamp
  lastLoginAt?: string;     // ISO 8601 timestamp
  inviteCode?: string;      // Original invite code used
  preferences?: {           // User preferences (JSON)
    theme?: 'light' | 'dark';
    emailNotifications?: boolean;
  };
}
```

**Global Secondary Indexes**:

1. **email-index**
   - **Partition Key**: `email` (String)
   - **Projection**: ALL
   - **Purpose**: Enable profile lookups by email

**Access Patterns**:
- Get profile by Cognito sub: `Query(PK=cognitoUserId)`
- Get profile by email: `Query(GSI=email-index, PK=email)`
- List all profiles: `Scan` (admin only, with pagination)

**Billing**: PAY_PER_REQUEST

**Features**:
- DynamoDB Streams enabled (NEW_AND_OLD_IMAGES) for audit logging
- Point-in-time recovery enabled (production)
- Encryption at rest (AWS managed keys)

**Note**: Core authentication data (email, password, login history) is managed by Cognito. This table stores only application-specific profile data.

---

### 3. Invitations Table

**Purpose**: Store invitation codes for user registration (works with Cognito)

**Table Name**: 
- Production: `bluefinwiki-invitations-{environment}`
- Local: `bluefinwiki-invitations-local`

**Primary Key**:
- **Partition Key (PK)**: `inviteCode` (String)

**Attributes**:
```typescript
interface InvitationRecord {
  inviteCode: string;       // 8-character alphanumeric code
  email?: string;           // Optional: pre-assigned email
  role: 'Admin' | 'Standard';
  createdBy: string;        // Cognito sub of admin who created
  createdAt: string;        // ISO 8601 timestamp
  expiresAt: number;        // Unix timestamp (for TTL)
  status: 'pending' | 'used' | 'revoked';
  usedAt?: string;          // ISO 8601 timestamp
  usedBy?: string;          // Cognito sub who used the code
}
```

**Features**:
- **TTL Attribute**: `expiresAt` - Auto-deletes expired invitations (7 days default)
- Billing: PAY_PER_REQUEST

**Access Patterns**:
- Get invitation by code: `Query(PK=inviteCode)`
- List all invitations: `Scan` (admin only)
- Filter by status: `Scan` with FilterExpression

---

### 4. Page Links Table

**Purpose**: Track wiki links between pages (for backlinks feature)

**Table Name**: 
- Production: `bluefinwiki-page-links-{environment}`
- Local: `bluefinwiki-page-links-local`

**Primary Key**:
- **Partition Key (PK)**: `sourceGuid` (String)
- **Sort Key (SK)**: `targetGuid` (String)

**Attributes**:
```typescript
interface PageLinkRecord {
  sourceGuid: string;       // Page GUID containing the link
  targetGuid: string;       // Page GUID being linked to
  linkText?: string;        // Display text of the link
  createdAt: string;        // ISO 8601 timestamp
}
```

**Global Secondary Indexes**:

1. **targetGuid-index**
   - **Partition Key**: `targetGuid` (String)
   - **Projection**: ALL
   - **Purpose**: Query all pages linking to a specific page (backlinks)

**Access Patterns**:
- Get outbound links from page: `Query(PK=sourceGuid)`
- Get backlinks to page: `Query(GSI=targetGuid-index, PK=targetGuid)`

**Billing**: PAY_PER_REQUEST

---

### 5. Attachments Table

**Purpose**: Store metadata for uploaded files (actual files in S3)

**Table Name**: 
- Production: `bluefinwiki-attachments-{environment}`
- Local: `bluefinwiki-attachments-local`

**Primary Key**:
- **Partition Key (PK)**: `guid` (String)

**Attributes**:
```typescript
interface AttachmentRecord {
  guid: string;             // Attachment GUID
  pageGuid: string;         // Parent page GUID
  filename: string;         // Original filename
  size: number;             // File size in bytes
  mimeType: string;         // MIME type (e.g., 'image/png')
  s3Key: string;            // S3 object key
  uploadedBy: string;       // Cognito sub (userId)
  uploadedAt: string;       // ISO 8601 timestamp
  status: 'active' | 'deleted';
}
```

**Global Secondary Indexes**:

1. **pageGuid-index**
   - **Partition Key**: `pageGuid` (String)
   - **Sort Key**: `uploadedAt` (String)
   - **Projection**: ALL
   - **Purpose**: List attachments for a specific page

**Access Patterns**:
- Get attachment by ID: `Query(PK=guid)`
- List attachments for page: `Query(GSI=pageGuid-index, PK=pageGuid)`

**Billing**: PAY_PER_REQUEST

---

### 6. Comments Table

**Purpose**: Store page comments and threaded discussions

**Table Name**: 
- Production: `bluefinwiki-comments-{environment}`
- Local: `bluefinwiki-comments-local`

**Primary Key**:
- **Partition Key (PK)**: `guid` (String)

**Attributes**:
```typescript
interface CommentRecord {
  guid: string;             // Comment GUID
  pageGuid: string;         // Parent page GUID
  userId: string;           // Author Cognito sub (userId)
  content: string;          // Markdown content (1-5000 chars)
  parentGuid?: string;      // Parent comment GUID (for replies)
  depth: number;            // Thread depth (0=root, max 3)
  createdAt: string;        // ISO 8601 timestamp
  updatedAt: string;        // ISO 8601 timestamp
  edited: boolean;          // True if comment was edited
  status: 'active' | 'deleted';
}
```

**Global Secondary Indexes**:

1. **pageGuid-createdAt-index**
   - **Partition Key**: `pageGuid` (String)
   - **Sort Key**: `createdAt` (String)
   - **Projection**: ALL
   - **Purpose**: List comments for a page chronologically

**Access Patterns**:
- Get comment by ID: `Query(PK=guid)`
- List comments for page: `Query(GSI=pageGuid-createdAt-index, PK=pageGuid)`

**Billing**: PAY_PER_REQUEST

---

### 7. Activity Log Table

**Purpose**: Audit trail for user actions and system events

**Table Name**: 
- Production: `bluefinwiki-activity-log-{environment}`
- Local: `bluefinwiki-activity-log-local`

**Primary Key**:
- **Partition Key (PK)**: `userId` (String)
- **Sort Key (SK)**: `timestamp` (String, ISO 8601)

**Attributes**:
```typescript
interface ActivityLogRecord {
  userId: string;           // Actor Cognito sub (userId)
  timestamp: string;        // ISO 8601 timestamp (sort key)
  action: string;           // Action type (e.g., 'page.create', 'user.login')
  resourceType: string;     // Resource type ('page', 'user', 'comment')
  resourceGuid?: string;    // Resource identifier
  details?: Record<string, any>; // Additional context
  ipAddress?: string;       // Client IP
  userAgent?: string;       // Browser/client info
  expiresAt: number;        // Unix timestamp (for TTL, 90 days)
}
```

**Features**:
- **TTL Attribute**: `expiresAt` - Auto-deletes logs after 90 days
- Billing: PAY_PER_REQUEST

**Access Patterns**:
- Get user activity: `Query(PK=userId, SK between [startDate, endDate])`
- List recent activity: `Query(PK=userId)` with Limit

---

### 7. User Preferences Table

**Purpose**: Store user-specific settings and customizations

**Table Name**: 
- Production: `bluefinwiki-user-preferences-{environment}`
- Local: `bluefinwiki-user-preferences-local`

**Primary Key**:
- **Partition Key (PK)**: `userId` (String)
- **Sort Key (SK)**: `preferenceKey` (String)

**Attributes**:
```typescript
interface UserPreferenceRecord {
  userId: string;           // User GUID
  preferenceKey: string;    // Preference name (e.g., 'theme', 'language')
  value: any;               // Preference value (string, number, boolean, array)
}
```

**Common Preference Keys**:
- `theme`: 'light' | 'dark'
- `language`: 'en' | 'es' | 'fr' | etc.
- `emailNotifications`: boolean
- `dashboardLayout`: array of widget IDs
- `favoritePages`: array of page GUIDs

**Access Patterns**:
- Get all preferences for user: `Query(PK=userId)`
- Get specific preference: `Query(PK=userId, SK=preferenceKey)`

**Billing**: PAY_PER_REQUEST

---

### 8. Site Configuration Table

**Purpose**: Store global wiki settings and configuration

**Table Name**: 
- Production: `bluefinwiki-site-config-{environment}`
- Local: `bluefinwiki-site-config-local`

**Primary Key**:
- **Partition Key (PK)**: `configKey` (String)

**Attributes**:
```typescript
interface SiteConfigRecord {
  configKey: string;        // Configuration key (e.g., 'site.name')
  value: any;               // Configuration value (any type)
  updatedBy: string;        // userId of last updater
  updatedAt: string;        // ISO 8601 timestamp
}
```

**Common Config Keys**:
- `site.name`: string
- `site.description`: string
- `features.comments.enabled`: boolean
- `features.exports.enabled`: boolean
- `email.fromAddress`: string
- `email.fromName`: string

**Access Patterns**:
- Get config by key: `Query(PK=configKey)`
- List all configs: `Scan` (admin only)

**Billing**: PAY_PER_REQUEST

---

## Local vs. Cloud Differences

### Local Development (LocalStack)

- **Endpoint**: `http://localhost:4566`
- **Region**: `us-east-1`
- **Credentials**: `test` / `test` (dummy)
- **Table Names**: Suffix `-local` (e.g., `bluefinwiki-users-local`)
- **Billing Mode**: PAY_PER_REQUEST or PROVISIONED with minimal units
- **Persistence**: Optional (via mounted volume)
- **Initialization**: Manual via `init-dynamodb.js` script
- **Seed Data**: Provided via `seed-data.js` script

**Test Users**:
- Admin: `admin@bluefinwiki.local` / `Test123!`
- Standard: `user@bluefinwiki.local` / `Test123!`

**Invite Codes**:
- `WELCOME1` for `newuser1@bluefinwiki.local`
- `WELCOME2` for `newuser2@bluefinwiki.local`

### Cloud Deployment (AWS)

- **Endpoint**: AWS DynamoDB service endpoints
- **Region**: Configurable (e.g., `us-east-1`, `eu-west-1`)
- **Credentials**: IAM roles with least privilege
- **Table Names**: Environment-specific (e.g., `bluefinwiki-users-dev`)
- **Billing Mode**: PROVISIONED for Users table, PAY_PER_REQUEST for others
- **Persistence**: Durable with automatic backups
- **Point-in-time Recovery**: Enabled for production
- **Encryption**: AWS managed keys (AES-256)
- **Streams**: Enabled for Users table (audit trail)

---

## Data Storage Strategy

### What's in DynamoDB

✅ **User Authentication & Profiles**
- User accounts, passwords, roles
- Login credentials and session data

✅ **Relational Metadata**
- Page links (backlinks tracking)
- Attachments metadata (files stored in S3)
- Comments and discussions

✅ **System Data**
- Invitations and registration codes
- Activity logs and audit trail
- User preferences and settings
- Global configuration

### What's NOT in DynamoDB

❌ **Page Content & Folders**
- Stored in S3 via Storage Plugin
- Format: JSON files with GUID-based keys
- Example: `pages/{guid}.json`, `folders/{guid}.json`

❌ **File Attachments**
- Stored in S3 buckets
- Only metadata in DynamoDB

❌ **Search Index**
- Managed by AWS CloudSearch
- Indexed from S3 page content

---

## Cost Estimation

### DynamoDB Costs (Monthly)

**Assumptions**: 5-user family, 100 pages, 50 comments, moderate activity

| Table | Reads/Month | Writes/Month | Storage (GB) | Cost |
|-------|-------------|--------------|--------------|------|
| Users | 3,000 | 150 | 0.01 | $0.01 |
| Invitations | 100 | 50 | 0.001 | $0.01 |
| Page Links | 5,000 | 500 | 0.05 | $0.05 |
| Attachments | 2,000 | 200 | 0.02 | $0.02 |
| Comments | 3,000 | 300 | 0.03 | $0.03 |
| Activity Log | 1,000 | 2,000 | 0.1 | $0.10 |
| User Prefs | 500 | 100 | 0.001 | $0.01 |
| Site Config | 100 | 10 | 0.001 | $0.01 |
| **Total** | | | | **~$0.24/mo** |

**Note**: Free tier provides 25 GB storage and 25 read/write units, covering most family usage.

---

## Security Considerations

### Encryption

- **At Rest**: All tables use AWS-managed encryption (AES-256)
- **In Transit**: TLS 1.2+ for all API calls
- **Password Storage**: bcrypt with 10 rounds (never store plaintext)

### Access Control

- **IAM Roles**: Lambda functions use least-privilege roles
- **API Gateway**: JWT validation before Lambda invocation
- **Admin Operations**: Role-based authorization checks

### Data Privacy

- **Soft Deletes**: User deletion marks as deleted, doesn't purge immediately
- **PII Protection**: Sensitive fields (email, passwordHash) never logged
- **Audit Trail**: DynamoDB Streams capture all user table changes

### Compliance

- **GDPR**: User data export and deletion mechanisms
- **Data Retention**: TTL for activity logs (90 days) and invitations (7 days)

---

## Monitoring & Alarms

### CloudWatch Metrics

- **ConsumedReadCapacityUnits**: Monitor for throttling
- **ConsumedWriteCapacityUnits**: Detect spikes
- **UserErrors**: Track validation errors
- **SystemErrors**: Alert on service issues

### Recommended Alarms

1. **High Error Rate**: SystemErrors > 10 in 5 minutes
2. **Throttling**: ThrottledRequests > 0 in 1 minute
3. **Capacity Warning**: ConsumedCapacity > 80% of provisioned
4. **Cost Alert**: Monthly spend > $5

---

## Migration & Backup

### Backup Strategy

**Production**:
- Point-in-time recovery: Enabled (Users, Page Links, Site Config)
- On-demand backups: Weekly full backups
- Retention: 35 days

**Development**:
- No backups (tables are ephemeral)
- Can be recreated via scripts

### Data Migration

**From Other Wikis**:
1. Export user data to CSV
2. Hash passwords with bcrypt
3. Bulk import via `BatchWriteItem` (max 25 items)
4. Update references (page authors, etc.)

**Between Environments**:
- Use DynamoDB Export to S3
- Transform table names for target environment
- Import via DynamoDB Import from S3

---

## Development Workflow

### Local Setup

1. **Start LocalStack** (via Aspire):
   ```powershell
   dotnet run --project aspire/BlueFinWiki.AppHost
   ```

2. **Initialize Tables**:
   ```bash
   cd aspire/scripts
   npm install
   npm run init-db
   ```

3. **Seed Test Data**:
   ```bash
   npm run seed
   ```

4. **Verify Tables**:
   ```bash
   aws dynamodb list-tables --endpoint-url http://localhost:4566
   ```

### Table Management

**View Table Schema**:
```bash
aws dynamodb describe-table \
  --table-name bluefinwiki-users-local \
  --endpoint-url http://localhost:4566
```

**Query Data**:
```bash
aws dynamodb scan \
  --table-name bluefinwiki-users-local \
  --endpoint-url http://localhost:4566
```

**Delete All Data**:
```bash
# Drop and recreate tables
npm run init-db
```

---

## Future Enhancements

### Planned (Post-MVP)

1. **Notifications Table**: In-app notification system
2. **Search History**: Track user searches for analytics
3. **Page Versions Metadata**: Enhanced version tracking beyond S3
4. **File Preview Cache**: Store generated thumbnails

### Considerations

- **Global Tables**: Multi-region replication for high availability
- **DynamoDB Accelerator (DAX)**: Caching layer for hot data
- **Fine-Grained Access Control**: Row-level security based on page permissions

---

## Troubleshooting

### Common Issues

**Tables Not Creating in LocalStack**:
- Check LocalStack is running: `curl http://localhost:4566/_localstack/health`
- Verify credentials: `AWS_ACCESS_KEY_ID=test`
- Check script output for error messages

**Seed Data Not Appearing**:
- Ensure tables exist first: `npm run init-db`
- Verify bcryptjs is installed: `npm install`
- Check CloudWatch Logs for errors

**GSI Query Failing**:
- Verify index exists: Use `describe-table`
- Check query syntax: Partition key is required
- Ensure projection includes needed attributes

---

## References

- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- [LocalStack DynamoDB](https://docs.localstack.cloud/user-guide/aws/dynamodb/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

---

**Document Version**: 1.0  
**Last Updated**: February 6, 2026  
**Maintained By**: BlueFinWiki Development Team
