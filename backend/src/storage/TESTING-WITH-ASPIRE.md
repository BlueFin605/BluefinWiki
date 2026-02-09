# Testing Storage Plugin with Aspire

This guide explains how to test the storage plugin using Microsoft Aspire for local development, including running integration tests against LocalStack.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Starting Aspire Environment](#starting-aspire-environment)
- [Running Unit Tests](#running-unit-tests)
- [Running Integration Tests](#running-integration-tests)
- [Monitoring with Aspire Dashboard](#monitoring-with-aspire-dashboard)
- [Troubleshooting](#troubleshooting)
- [Advanced Testing Scenarios](#advanced-testing-scenarios)

## Overview

BlueFinWiki uses Microsoft Aspire to orchestrate local development services, including LocalStack for S3 emulation. This allows you to test the storage plugin against a real S3-compatible backend without needing AWS credentials or incurring cloud costs.

### What is Aspire?

Microsoft Aspire is a local orchestration platform that:
- Manages multiple services (frontend, backend, LocalStack, databases)
- Provides a unified dashboard for monitoring and debugging
- Handles service discovery and dependency management
- Simplifies environment configuration

### Why LocalStack?

LocalStack is a fully functional local AWS cloud stack that emulates AWS services including:
- S3 (object storage)
- DynamoDB (database)
- SES (email)
- Cognito (authentication)

## Prerequisites

Ensure you have the following installed:

1. **.NET SDK 8.0+** (for Aspire)
   ```powershell
   dotnet --version  # Should be 8.0 or higher
   ```

2. **Node.js 20+** (for backend tests)
   ```powershell
   node --version
   ```

3. **Docker Desktop** (for LocalStack container)
   ```powershell
   docker --version
   ```

4. **Aspire Workload** (if not already installed)
   ```powershell
   dotnet workload install aspire
   ```

## Starting Aspire Environment

### Step 1: Start Aspire

From the project root, start the Aspire AppHost:

```powershell
# Navigate to Aspire directory
cd aspire

# Run the AppHost
dotnet run --project BlueFinWiki.AppHost
```

Aspire will:
1. Start LocalStack container on port 4566
2. Initialize S3 buckets
3. Start backend services (if configured)
4. Open the Aspire Dashboard in your browser

### Step 2: Verify LocalStack is Running

Open the Aspire Dashboard at: **http://localhost:15888** (or the URL shown in console)

Check the **Resources** tab:
- LocalStack container should show status: **Running**
- Backend services should show status: **Running** (if started)

### Step 3: Verify S3 Bucket Creation

LocalStack automatically creates the required S3 buckets on startup. You can verify using AWS CLI:

```powershell
# Configure AWS CLI for LocalStack
$env:AWS_ACCESS_KEY_ID="test"
$env:AWS_SECRET_ACCESS_KEY="test"
$env:AWS_DEFAULT_REGION="us-east-1"

# List buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# Expected output:
# bluefinwiki-dev-pages
```

## Running Unit Tests

Unit tests use mocked S3 clients and don't require LocalStack.

### Run All Unit Tests

```powershell
# Navigate to backend directory
cd backend

# Install dependencies (if not already done)
npm install

# Run unit tests (excludes integration tests)
npm test
```

### Run Tests in Watch Mode

```powershell
npm run test:watch
```

This will re-run tests automatically when you save files.

### Run Specific Test File

```powershell
npx vitest run src/storage/__tests__/S3StoragePlugin.test.ts
```

### View Test Coverage

```powershell
npx vitest run --coverage
```

## Running Integration Tests

Integration tests require LocalStack to be running via Aspire.

### Step 1: Ensure Aspire is Running

Make sure you completed the [Starting Aspire Environment](#starting-aspire-environment) section above.

### Step 2: Set Environment Variables

Integration tests need to know the LocalStack endpoint:

```powershell
# Set LocalStack endpoint (default if using Aspire)
$env:LOCALSTACK_ENDPOINT="http://localhost:4566"
```

### Step 3: Run Integration Tests

```powershell
# Run only integration tests
npm run test:integration
```

### Step 4: Run All Tests (Unit + Integration)

```powershell
npm run test:all
```

### What Integration Tests Cover

The integration tests verify:

1. **End-to-end page lifecycle**: Create, read, update, delete
2. **Versioning behavior**: Multiple versions created on updates
3. **Page hierarchy**: Parent-child relationships
4. **Page movement**: Moving pages between parents
5. **Recursive deletion**: Deleting pages with children
6. **Error scenarios**: Handling non-existent pages, circular references

## Monitoring with Aspire Dashboard

### Accessing the Dashboard

Once Aspire is running, open: **http://localhost:15888**

### Dashboard Features

#### 1. **Resources Tab**

View all running services:
- LocalStack container
- Backend Lambda emulators (if running)
- Frontend dev server (if running)

**What to Check:**
- Status: Should be **Running** (green)
- Logs: View real-time logs for each service
- Environment: See environment variables passed to services

#### 2. **Traces Tab**

View distributed traces across services:
- HTTP requests
- S3 operations
- Lambda invocations

**Example Trace:**
```
Test Execution
  └─ S3StoragePlugin.savePage
      ├─ PutObjectCommand (S3)
      └─ ListObjectsV2Command (S3)
```

**Benefits:**
- See the flow of operations during tests
- Identify performance bottlenecks
- Debug failures with detailed timing info

#### 3. **Logs Tab**

Unified log viewer for all services:
- Filter by service (LocalStack, backend, etc.)
- Search for specific log messages
- View errors and warnings

**Useful for:**
- Debugging test failures
- Verifying S3 operations are being called
- Checking for errors in LocalStack

#### 4. **Metrics Tab**

View performance metrics:
- Request rates
- Error rates
- Operation durations

### Using Dashboard During Tests

1. **Open Dashboard** before running tests
2. **Navigate to Logs** tab
3. **Filter to LocalStack** service
4. **Run tests** in another terminal
5. **Watch real-time logs** to see S3 operations

**Example Logs During Test:**
```
[LocalStack] INFO: PutObject bluefinwiki-dev-pages/test-guid-123.md
[LocalStack] INFO: GetObject bluefinwiki-dev-pages/test-guid-123.md
[LocalStack] INFO: DeleteObject bluefinwiki-dev-pages/test-guid-123.md
```

## Troubleshooting

### LocalStack Not Starting

**Problem:** LocalStack container shows "Error" status in Aspire Dashboard

**Solutions:**

1. **Check Docker is running:**
   ```powershell
   docker ps
   ```

2. **Check Docker logs:**
   ```powershell
   docker logs $(docker ps -q --filter ancestor=localstack/localstack)
   ```

3. **Restart Aspire:**
   ```powershell
   # Stop Aspire (Ctrl+C)
   # Start again
   dotnet run --project BlueFinWiki.AppHost
   ```

### Integration Tests Failing

**Problem:** Integration tests fail with connection errors

**Solutions:**

1. **Verify LocalStack endpoint:**
   ```powershell
   # Test connectivity
   curl http://localhost:4566/_localstack/health
   ```

2. **Check environment variable:**
   ```powershell
   echo $env:LOCALSTACK_ENDPOINT
   # Should output: http://localhost:4566
   ```

3. **Restart LocalStack via Aspire:**
   - Stop Aspire (Ctrl+C)
   - Clean Docker containers: `docker rm -f $(docker ps -aq)`
   - Restart Aspire

### Tests Timeout

**Problem:** Tests hang or timeout

**Solutions:**

1. **Increase test timeout in vitest config:**
   ```typescript
   // vitest.config.ts
   export default defineConfig({
     test: {
       testTimeout: 30000, // 30 seconds
     },
   });
   ```

2. **Check S3 operations in Dashboard:**
   - Look for stuck operations in Traces tab
   - Check LocalStack logs for errors

### Bucket Not Found Errors

**Problem:** Tests fail with "The specified bucket does not exist"

**Solutions:**

1. **Verify bucket creation in LocalStack:**
   ```powershell
   aws --endpoint-url=http://localhost:4566 s3 ls
   ```

2. **Manually create bucket (if needed):**
   ```powershell
   aws --endpoint-url=http://localhost:4566 s3 mb s3://bluefinwiki-dev-pages
   ```

3. **Check Aspire initialization scripts:**
   - Review `aspire/scripts/init-dynamodb.js` (may also init S3)
   - Ensure scripts ran successfully in Aspire logs

## Advanced Testing Scenarios

### Testing with Multiple Pages

Create test helpers for generating test data:

```typescript
// test-helpers.ts
export function createTestPage(guid: string, parentGuid: string | null): PageContent {
  return {
    guid,
    title: `Test Page ${guid}`,
    content: `# Test Content\n\nThis is test page ${guid}`,
    folderId: parentGuid || '',
    tags: ['test'],
    status: 'published',
    createdBy: 'test-user',
    modifiedBy: 'test-user',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };
}

// In your test:
const pages = [
  createTestPage('guid-1', null),
  createTestPage('guid-2', 'guid-1'),
  createTestPage('guid-3', 'guid-1'),
];

for (const page of pages) {
  await plugin.savePage(page.guid, page.folderId || null, page);
}
```

### Testing Large Hierarchies

Test performance with deep or wide hierarchies:

```typescript
it('should handle deep hierarchy (10 levels)', async () => {
  let parentGuid: string | null = null;

  // Create 10-level deep hierarchy
  for (let i = 0; i < 10; i++) {
    const guid = `level-${i}`;
    await plugin.savePage(guid, parentGuid, createTestPage(guid, parentGuid));
    parentGuid = guid;
  }

  // Verify all levels exist
  const rootChildren = await plugin.listChildren(null);
  expect(rootChildren.length).toBe(1);
});

it('should handle wide hierarchy (100 children)', async () => {
  const parentGuid = 'wide-parent';
  await plugin.savePage(parentGuid, null, createTestPage(parentGuid, null));

  // Create 100 children
  for (let i = 0; i < 100; i++) {
    const childGuid = `child-${i}`;
    await plugin.savePage(childGuid, parentGuid, createTestPage(childGuid, parentGuid));
  }

  // List children
  const children = await plugin.listChildren(parentGuid);
  expect(children.length).toBe(100);
});
```

### Testing Concurrent Operations

Test race conditions and concurrent updates:

```typescript
it('should handle concurrent saves to same page', async () => {
  const guid = 'concurrent-test';

  // Create page first
  await plugin.savePage(guid, null, createTestPage(guid, null));

  // Perform concurrent updates
  await Promise.all([
    plugin.savePage(guid, null, { ...createTestPage(guid, null), title: 'Update 1' }),
    plugin.savePage(guid, null, { ...createTestPage(guid, null), title: 'Update 2' }),
    plugin.savePage(guid, null, { ...createTestPage(guid, null), title: 'Update 3' }),
  ]);

  // Verify page exists and versions were created
  const versions = await plugin.listVersions(guid);
  expect(versions.length).toBeGreaterThanOrEqual(4); // Initial + 3 updates
});
```

### Cleaning Up After Tests

Use beforeEach/afterEach hooks to ensure clean state:

```typescript
describe('S3StoragePlugin Integration', () => {
  beforeEach(async () => {
    // Delete all objects in test bucket
    const objects = await s3Client.send(
      new ListObjectsV2Command({ Bucket: TEST_BUCKET })
    );

    if (objects.Contents && objects.Contents.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: TEST_BUCKET,
          Delete: {
            Objects: objects.Contents.map(obj => ({ Key: obj.Key! })),
          },
        })
      );
    }
  });

  // Tests...
});
```

## Best Practices

1. **Run unit tests first**: They're faster and catch most issues
2. **Use Aspire Dashboard**: Monitor tests in real-time for debugging
3. **Clean state between tests**: Ensure tests don't affect each other
4. **Test error paths**: Don't just test happy paths
5. **Use descriptive test names**: Make failures easy to understand
6. **Group related tests**: Use describe blocks for organization
7. **Mock external dependencies in unit tests**: Only use real S3 in integration tests
8. **Keep integration tests fast**: Avoid unnecessary delays or large datasets

## CI/CD Considerations

### Running Tests in CI

For GitHub Actions or other CI systems:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      localstack:
        image: localstack/localstack:latest
        ports:
          - 4566:4566
        env:
          SERVICES: s3,dynamodb
          DEBUG: 1

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        working-directory: ./backend
        run: npm install
      
      - name: Run unit tests
        working-directory: ./backend
        run: npm test
      
      - name: Run integration tests
        working-directory: ./backend
        run: npm run test:integration
        env:
          LOCALSTACK_ENDPOINT: http://localhost:4566
```

## Additional Resources

- [Aspire Local Development Guide](../../../aspire/ASPIRE-LOCAL-DEV.md)
- [S3 Storage Architecture](./S3-STORAGE-ARCHITECTURE.md)
- [Plugin Developer Guide](./PLUGIN-DEVELOPER-GUIDE.md)
- [Vitest Documentation](https://vitest.dev/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
