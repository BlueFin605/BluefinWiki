# Seed Snapshot Path Length Fix

## Problem

The seed data export was creating deeply nested directory structures that exceeded Windows' MAX_PATH limit (260 characters). This caused:
- Git errors when trying to commit snapshots
- File system errors when accessing or deleting snapshot directories
- Issues with build tools and backup software

Example problematic path:
```
c:\Users\mitch\Development\Projects\SpecKit\projects\BlueFinWiki\aspire\scripts\
seed-snapshots\2026-03-03\s3\pages\a271ab77-ef53-48be-87c8-1d1d9aeebe08\
77f9e930-3b8a-4035-9884-cba4fdc0fe49\a84dbeae-b381-482f-ad5f-18f0aa6bf3f6\
95232e2a-2c0d-414a-be5f-0406035832ce\95232e2a-2c0d-414a-be5f-0406035832ce.md
```
Length: 306+ characters (exceeds 260 limit)

## Solution

### Hash-Based Filename Mapping

S3 objects are now stored with hash-based filenames instead of preserving the nested directory structure:

**Before:**
```
seed-snapshots/2026-03-30/s3/pages/
  a271ab77-ef53-48be-87c8-1d1d9aeebe08/
    77f9e930-3b8a-4035-9884-cba4fdc0fe49/
      a84dbeae-b381-482f-ad5f-18f0aa6bf3f6/
        95232e2a-2c0d-414a-be5f-0406035832ce/
          95232e2a-2c0d-414a-be5f-0406035832ce.md
```

**After:**
```
seed-snapshots/2026-03-30/s3/pages/
  a932d51ae54cf3ec.md        # Hash-based filename
  ba3cfc54e4297861.md
  50f2c1c5023737e4.md
  _key-mapping.json           # Mapping file
```

### Key Mapping File

Each S3 bucket directory contains a `_key-mapping.json` file that maps the hash-based filename back to the original S3 key:

```json
{
  "a932d51ae54cf3ec.md": "a271ab77-ef53-48be-87c8-1d1d9aeebe08/77f9e930-3b8a-4035-9884-cba4fdc0fe49/a84dbeae-b381-482f-ad5f-18f0aa6bf3f6/95232e2a-2c0d-414a-be5f-0406035832ce/95232e2a-2c0d-414a-be5f-0406035832ce.md",
  "ba3cfc54e4297861.md": "a271ab77-ef53-48be-87c8-1d1d9aeebe08/77f9e930-3b8a-4035-9884-cba4fdc0fe49/77f9e930-3b8a-4035-9884-cba4fdc0fe49.md"
}
```

### Hash Algorithm

- Uses SHA-256 hash of the full S3 key
- Takes first 16 characters of the hex digest
- Preserves the original file extension
- Example: `a271ab77-ef53.../95232e2a-2c0d.../file.md` → `a932d51ae54cf3ec.md`

## Implementation Details

### Export Script Changes (`export-seed-data.js`)

```javascript
// Generate hash-based filename
const hash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
const extension = path.extname(key) || '';
const flattenedKey = `${hash}${extension}`;

// Store in flat directory
const filePath = path.join(bucketDir, flattenedKey);

// Save mapping for import
keyMapping[flattenedKey] = key;
```

### Import Script Changes (`import-seed-data.js`)

```javascript
// Read key mapping file
const mappingPath = path.join(bucketDir, '_key-mapping.json');
const keyMapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

// Restore original S3 key
const s3Key = keyMapping[file] || file; // Fallback to filename for legacy format
```

### Backward Compatibility

The import script supports both formats:
- **New format**: Uses `_key-mapping.json` to restore original S3 keys
- **Legacy format**: Falls back to using the file path as the S3 key (for old snapshots)

## Results

### Path Length Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Max Path Length | 306 chars | 134 chars | 56% reduction |
| Directory Depth | 7 levels | 1 level | 86% reduction |
| Filename Length | Variable (36-74 chars) | Fixed (16-20 chars) | Consistent |
| Git Compatible | ❌ No | ✅ Yes | Fixed |

### Benefits

1. **Windows Compatible**: All paths are well under the 260 character limit
2. **Git Friendly**: Can commit and clone snapshots without errors
3. **Cross-Platform**: Works on Windows, Mac, and Linux
4. **Faster Operations**: Fewer directory traversals for file operations
5. **Backup Safe**: Compatible with Windows backup tools and cloud sync

## Migration

### Existing Snapshots

Old snapshots will continue to work through the legacy fallback mechanism. However, to take advantage of the path length fix:

1. Delete old snapshots that exceed path limits:
   ```powershell
   # Use robocopy to delete long paths
   $tempEmpty = Join-Path $env:TEMP "empty-$(Get-Random)"
   New-Item -ItemType Directory -Path $tempEmpty -Force
   robocopy $tempEmpty ".\seed-snapshots\old-snapshot" /MIR /R:0 /W:0
   Remove-Item $tempEmpty -Force
   Remove-Item ".\seed-snapshots\old-snapshot" -Recurse -Force
   ```

2. Re-export data with the new format:
   ```bash
   npm run export-seed
   ```

### No Code Changes Required

The import/export workflow remains the same. The hash-based naming is transparent to users.

## Testing

Verified functionality:
- ✅ Export with hash-based filenames
- ✅ Import with key mapping restoration
- ✅ Backward compatibility with old snapshots
- ✅ Path length under 260 characters
- ✅ Git operations successful
- ✅ Cross-platform compatibility

## Files Modified

- `aspire/scripts/export-seed-data.js` - Added hash-based naming and key mapping
- `aspire/scripts/import-seed-data.js` - Added key mapping support with legacy fallback
- `aspire/scripts/SEED-DATA-GUIDE.md` - Updated documentation with new structure
- `aspire/scripts/PATH-LENGTH-FIX.md` - This document
