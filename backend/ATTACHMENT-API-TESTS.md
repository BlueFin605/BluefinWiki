# Attachment API Integration Testing Guide

## Problem Statement

The attachments feature (Task 7 - Spec #6) has implementation code but was **missing comprehensive API integration tests**. This created a testing gap where:

- ✅ Unit tests exist for utility functions (`attachments-utils.test.ts`)
- ✅ Unit tests exist for list/delete endpoints (mocked)
- ✅ Storage plugin integration tests exist for S3 operations
- ❌ **NO tests for the actual Lambda handlers via HTTP API**
- ❌ **NO end-to-end workflow tests (upload → list → download → delete)**

This means issues like "attachments don't save" or "can't read attachments" were not being caught by automated tests.

---

## New Test Suite

A comprehensive API integration test suite has been added to verify the complete attachment workflow:

**File**: `backend/src/pages/__tests__/pages-attachments-api.integration.test.ts`

### What It Tests

1. **Upload Endpoint** (`POST /pages/{pageGuid}/attachments`)
   - ✅ Successfully upload text files with multipart/form-data
   - ✅ Reject unsupported file types (e.g., .exe files)
   - ✅ Reject oversized files (>10MB for images, >50MB for documents)
   - ✅ Validate GUID format

2. **List Endpoint** (`GET /pages/{pageGuid}/attachments`)
   - ✅ List all attachments for a page
   - ✅ Return empty list for pages with no attachments
   - ✅ Include attachment metadata (filename, size, etc.)

3. **Download Endpoint** (`GET /pages/{pageGuid}/attachments/{attachmentGuid}`)
   - ✅ Download uploaded attachments with correct content-type
   - ✅ Return proper Content-Disposition headers (inline for images/PDFs)
   - ✅ Reject invalid GUIDs with 400 error

4. **Delete Endpoint** (`DELETE /pages/{pageGuid}/attachments/{attachmentGuid}`)
   - ✅ Delete attachments successfully
   - ✅ Return 404 for non-existent attachments
   - ✅ Remove both file and metadata

5. **Complete Workflow**
   - ✅ Full lifecycle: upload → list → download → delete
   - ✅ Verify attachment appears in list after upload
   - ✅ Verify attachment is removed from list after delete

---

## Running the Tests

### Prerequisites

1. **Start Aspire** (includes LocalStack for S3 emulation):
   ```powershell
   cd BlueFinWiki
   .\start-aspire.ps1
   ```

2. **Wait for LocalStack** to be ready:
   - LocalStack runs on http://localhost:4566
   - Check health: `curl http://localhost:4566/health`

### Run Integration Tests

```bash
# From backend directory
cd backend

# Run ONLY attachment API tests
npm run test:integration -- pages-attachments-api

# Run ALL integration tests
npm run test:integration

# Run with verbose output
npm run test:integration -- --reporter=verbose
```

### Debugging Failed Tests

If tests fail, check these symptoms:

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "LocalStack not running" error | Aspire not started | Run `.\start-aspire.ps1` |
| "ECONNREFUSED localhost:4566" | S3 endpoint unreachable | Check LocalStack in Aspire dashboard |
| "Bucket creation failed" | S3 permissions issue | Check AWS credentials in env |
| Timeout errors | LocalStack slow | Increase test timeout in config |
| "Page not found" | Page not created before upload | Check beforeEach() setup |

---

## Test Coverage Matrix

| Feature | Unit Tests | Integration Tests | API Tests |
|---------|----------|-------------------|-----------|
| Multipart parsing | ✅ | - | ✅ |
| File validation | ✅ | - | ✅ |
| S3 storage operations | ✅ | ✅ | ✅ |
| Upload Lambda handler | ❌ | ❌ | ✅ NEW |
| Download Lambda handler | ❌ | ❌ | ✅ NEW |
| List Lambda handler | ✅ (mocked) | ❌ | ✅ NEW |
| Delete Lambda handler | ✅ (mocked) | ❌ | ✅ NEW |
| End-to-end workflow | ❌ | ❌ | ✅ NEW |
| HTTP API flow | ❌ | ❌ | ✅ NEW |

---

## Troubleshooting "Attachments Don't Save" Issues

If you see attachments not being saved, use these tests to identify the issue:

### Step 1: Run Upload Test
```bash
npm run test:integration -- pages-attachments-api -t "should upload a text file"
```

**If this fails:**
- Check multipart parsing error message
- Verify request headers include `Content-Type: multipart/form-data`
- Check S3 bucket permissions

### Step 2: Run List Test
```bash
npm run test:integration -- pages-attachments-api -t "should list all attachments"
```

**If this fails:**
- Check if upload succeeded first
- Verify metadata file (.meta.json) was created in S3
- Check S3 path structure: `{pageGuid}/_attachments/`

### Step 3: Run Complete Workflow Test
```bash
npm run test:integration -- pages-attachments-api -t "should perform full attachment lifecycle"
```

**If this fails:**
- Check each step separately (upload, list, download, delete)
- Look at error message to identify which step failed
- Check S3 bucket contents and manifest

---

## Known Issues & Fixes

### Issue 1: "Cannot read property 'xxx' of undefined"
**Cause**: Mock auth middleware not initialized properly
**Fix**: Tests use `vi.mock('../../middleware/auth.js')` - verify this is before handler imports

### Issue 2: "Boundary not found in multipart payload"
**Cause**: Local development sends multipart incorrectly
**Fix**: Check that express.raw() middleware is configured in local-server.ts
```typescript
app.post(
  '/pages/:pageGuid/attachments',
  express.raw({ type: () => true, limit: '60mb' }),  // ← This is required
  wrapLambdaHandler(pagesAttachmentsUpload)
);
```

### Issue 3: "File too large" even for small files
**Cause**: Size validation using wrong field
**Fix**: Verify S3StoragePlugin.uploadAttachment returns correct `size` property

---

## Integration with CI/CD

These tests can be added to GitHub Actions to verify attachments work in each deploy:

```yaml
- name: Run Attachment API Tests
  run: |
    cd backend
    npm run test:integration -- pages-attachments-api
```

---

## Next Steps

1. ✅ **Run the attachment API tests** to identify any issues
2. 📝 **Review test output** to see which specific endpoints are failing
3. 🔧 **Check stack trace** to identify root cause
4. 💡 **Common fixes**:
   - Verify Aspire and LocalStack are running
   - Check S3 bucket is created and accessible
   - Verify multipart parsing in local-server.ts
   - Check storage plugin is registered globally
5. 📋 **Add these tests to your test suite** to prevent future regressions

---

## Related Test Files

- **Storage Integration Tests**: `page-attachments.integration.test.ts` (S3StoragePlugin methods)
- **Utility Unit Tests**: `attachments-utils.test.ts` (multipart parsing, validation)
- **Handler Unit Tests**: `pages-attachments-list.test.ts`, `pages-attachments-delete.test.ts` (mocked)

---

## References

- Specification: [6-page-attachments.md](../6-page-attachments.md)
- API Implementation: [Local Server Routes](../local-server.ts#L198-L205)
- Storage Plugin: [S3StoragePlugin.ts](../storage/S3StoragePlugin.ts)
- Task Status: [TASKS.md - Week 7: Page Attachments](../../TASKS.md#week-7-page-attachments)
