# Test Updates Required for Attachment Filename Migration

This document outlines the test changes needed after migrating from GUID-based to filename-based attachment identification.

## Overview

All tests that mock or verify attachment-related operations need to be updated to use `filename` instead of `attachmentGuid` or `attachmentId`.

## Frontend Tests

### File: `frontend/src/hooks/__tests__/useAttachments.test.ts`

**Pattern to Find**: `attachmentGuid`  
**Replace With**: `filename`

**Specific Changes**:

1. Mock response data:
```typescript
// Before
const mockResponse = {
  data: {
    attachmentGuid: 'attachment-123',
    filename: 'test.pdf',
    // ...
  },
};

// After
const mockResponse = {
  data: {
    filename: 'test.pdf',
    contentType: 'application/pdf',
    // ...
  },
};
```

2. Assertion updates:
```typescript
// Before
expect(uploadResult.successful[0].attachmentGuid).toBe('attachment-1');

// After
expect(uploadResult.successful[0].filename).toBe('test-file-1.pdf');
```

3. API call verification:
```typescript
// Before
await result.current.deleteAttachment(attachmentGuid);
expect(apiClient.delete).toHaveBeenCalledWith(
  `/pages/${testPageGuid}/attachments/${attachmentGuid}`
);

// After
await result.current.deleteAttachment('test.pdf');
expect(apiClient.delete).toHaveBeenCalledWith(
  `/pages/${testPageGuid}/attachments/${encodeURIComponent('test.pdf')}`
);
```

4. Progress tracking:
```typescript
// Before
expect(progress[0].attachmentGuid).toBe('attachment-456');

// After
expect(progress[0].filename).toBe('test-file.pdf');
```

## Backend Tests

### File: `backend/src/pages/__tests__/page-attachments.integration.test.ts`

**Updates Needed**:

1. Change test descriptions:
```typescript
// Before
it('should generate GUID for uploaded attachment', async () => {

// After  
it('should use sanitized filename for uploaded attachment', async () => {
```

2. Update assertions:
```typescript
// Before
expect(response.body.attachmentGuid).toMatch(/^[0-9a-f-]{36}$/);

// After
expect(response.body.filename).toBe('test_file.pdf'); // sanitized
```

3. Update download/delete tests:
```typescript
// Before
const deleteResponse = await request(app)
  .delete(`/pages/${pageGuid}/attachments/${uploadResponse.body.attachmentGuid}`)

// After
const deleteResponse = await request(app)
  .delete(`/pages/${pageGuid}/attachments/${encodeURIComponent(uploadResponse.body.filename)}`)
```

### File: `backend/src/pages/__tests__/pages-attachments-storage.integration.test.ts`

**Updates Needed**:

1. S3 key verification:
```typescript
// Before
expect(s3Objects).toContainEqual(
  expect.objectContaining({
    Key: expect.stringMatching(new RegExp(`${pageGuid}/_attachments/[0-9a-f-]{36}\\.pdf$`))
  })
);

// After
expect(s3Objects).toContainEqual(
  expect.objectContaining({
    Key: `${pageGuid}/_attachments/test_file.pdf`
  })
);
```

2. Metadata verification:
```typescript
// Before
const metadataKey = `${pageGuid}/_attachments/${uploadedGuid}.meta.json`;

// After
const metadataKey = `${pageGuid}/_attachments/${sanitizedFilename}.meta.json`;
```

### File: `backend/src/storage/__tests__/S3StoragePlugin.test.ts`

**Updates Needed**:

1. uploadAttachment tests:
```typescript
// Before
const result = await plugin.uploadAttachment(pageGuid, {
  originalFilename: 'test.pdf',
  // ...
});
expect(result.attachmentGuid).toMatch(/^[0-9a-f-]{36}$/);

// After
const result = await plugin.uploadAttachment(pageGuid, {
  originalFilename: 'test file!@#.pdf',
  // ...
});
expect(result.filename).toBe('test_file.pdf'); // sanitized
```

2. Remove GUID validation tests:
```typescript
// Remove or modify
it('should reject invalid attachment GUID', async () => {
  await expect(
    plugin.deleteAttachment(pageGuid, 'invalid-guid')
  ).rejects.toThrow('Invalid GUID format');
});

// Instead add filename validation
it('should sanitize unsafe filenames', async () => {
  const result = await plugin.uploadAttachment(pageGuid, {
    originalFilename: '../../../etc/passwd',
    // ...
  });
  expect(result.filename).not.toContain('..');
  expect(result.filename).not.toContain('/');
});
```

### File: `backend/src/pages/__tests__/attachments-utils.test.ts`

**Updates Needed**:

Likely minimal - this file tests utility functions for parsing multipart data, not attachment identifiers. Review to ensure no GUID-related validation logic exists.

## Common Patterns to Update

### 1. Mock Data
```typescript
// Before
const mockAttachment = {
  attachmentId: 'guid-123',
  originalFilename: 'report.pdf',
  // ...
};

// After
const mockAttachment = {
  filename: 'report.pdf',
  contentType: 'application/pdf',
  // ...
};
```

### 2. Path Parameters
```typescript
// Before
event.pathParameters = {
  pageGuid: 'page-123',
  attachmentGuid: 'attach-456'
};

// After
event.pathParameters = {
  pageGuid: 'page-123',
  filename: 'test-file.pdf'
};
```

### 3. URL Encoding
```typescript
// Important: When testing URLs with filenames, ensure proper encoding
const filename = 'test file with spaces.pdf';
const expectedUrl = `/pages/${pageGuid}/attachments/${encodeURIComponent(filename)}`;
```

### 4. Validation Tests
```typescript
// Before: GUID validation
expect(attachmentGuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

// After: Filename sanitization verification
expect(filename).not.toContain('/');
expect(filename).not.toContain('\\');
expect(filename).not.toContain('..');
expect(filename.length).toBeLessThanOrEqual(255);
```

## Test Execution Strategy

1. **Run tests before changes** to establish baseline failures
2. **Update in small batches**:
   - Start with type/interface tests
   - Then hook tests
   - Then integration tests
3. **Use search-and-replace carefully**:
   - Search: `attachmentGuid` → Replace: `filename`
   - Search: `attachmentId` → Replace: `filename`
   - Review each change manually
4. **Run tests after each batch** to catch regressions early

## Verification Checklist

After updating tests, verify:

- [ ] All mock data uses `filename` instead of GUID fields
- [ ] All API path assertions use URL-encoded filenames
- [ ] All assertions check for sanitized filenames
- [ ] GUID validation tests removed/replaced
- [ ] Filename sanitization tests added
- [ ] All tests pass locally
- [ ] Integration tests verify correct S3 storage paths
- [ ] No references to `attachmentGuid` or `attachmentId` remain

## Running Tests

```bash
# Backend unit tests
cd backend
npm test

# Backend integration tests
npm run test:integration

# Frontend tests
cd frontend
npm test

# Run all tests
npm run test:all
```

## Notes

- Some tests may need fixture data updated in separate files
- Check for any test utilities that generate mock attachment data
- Update snapshot tests for API responses
- Consider adding new tests for filename collision scenarios
