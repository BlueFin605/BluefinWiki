# Seed Data Management System - Summary

## ✅ What Was Created

A complete seed data management system for your BlueFinWiki Aspire development environment that allows you to:

1. **Export** current S3 and DynamoDB data to reusable snapshots
2. **Import** snapshots to quickly restore test data
3. **Version** your test data alongside code changes
4. **Share** test data with team members

## 📁 Files Created/Modified

### New Scripts
- `aspire/scripts/export-seed-data.js` - Exports all S3 objects and DynamoDB items to JSON
- `aspire/scripts/import-seed-data.js` - Imports snapshots back into LocalStack
- `aspire/scripts/manage-seed-data.ps1` - PowerShell convenience wrapper
- `aspire/scripts/seed-snapshots/.gitignore` - Ignores snapshots by default

### Updated Files
- `aspire/scripts/seed-data.js` - Enhanced to create sample wiki pages in S3
- `aspire/scripts/package.json` - Added new dependencies and scripts

### Documentation
- `aspire/SEED-DATA.md` - Quick reference guide
- `aspire/scripts/SEED-DATA-GUIDE.md` - Comprehensive documentation
- `aspire/README.md` - Updated with seed data section

## 🎯 Quick Start

### Export Your Current Data
```powershell
cd aspire/scripts
.\manage-seed-data.ps1 -Action export
```

This creates a snapshot in `seed-snapshots/YYYY-MM-DD/` containing:
- All S3 objects (pages, attachments, exports)
- All DynamoDB items (users, comments, config, etc.)
- Metadata about the snapshot

### Import a Snapshot
```powershell
cd aspire/scripts
.\manage-seed-data.ps1 -Action import -Source "seed-snapshots/2026-03-29"
```

This restores all data from the snapshot to your LocalStack environment.

## 🔄 Complete Workflow Example

### 1. Initial Setup
```powershell
cd aspire/scripts
.\manage-seed-data.ps1 -Action setup
```
Creates tables, seeds baseline data (users, sample pages)

### 2. Create Your Test Data
- Use the app to create pages, upload attachments, add comments
- Build the exact test scenarios you need

### 3. Capture the State
```powershell
.\manage-seed-data.ps1 -Action export -Output "feature-x-testdata"
```
Saves everything to `seed-snapshots/feature-x-testdata/`

### 4. Reset and Restore Anytime
```powershell
# Later, restore this exact state
.\manage-seed-data.ps1 -Action import -Source "seed-snapshots/feature-x-testdata"
```

## 📦 What Gets Captured

**S3 Buckets (with full directory structure):**
- `bluefinwiki-pages-local` - Wiki pages
  - Example: `{guid}/{guid}.md`
  - Example: `{parent-guid}/{child-guid}/{child-guid}.md`
- `bluefinwiki-attachments-local` - File attachments
- `bluefinwiki-exports-local` - Exported content

**DynamoDB Tables:**
- Users and invitations
- Page links and comments
- Attachments metadata
- Activity logs
- Site configuration
- User preferences

## 💡 Use Cases

### As You Add Features
```powershell
# Before starting feature work
.\manage-seed-data.ps1 -Action export -Output "before-search-feature"

# After implementing and testing
.\manage-seed-data.ps1 -Action export -Output "with-search-testdata"
```

### Share with Team
```bash
# Export
.\manage-seed-data.ps1 -Action export -Output "team-baseline"

# Commit to git (after updating .gitignore)
git add seed-snapshots/team-baseline
git commit -m "Add baseline test data"

# Team members import
.\manage-seed-data.ps1 -Action import -Source "seed-snapshots/team-baseline"
```

### Testing Upgrades
```powershell
# Capture current working state
.\manage-seed-data.ps1 -Action export -Output "before-upgrade"

# Upgrade dependencies, make changes

# If something breaks, restore
.\manage-seed-data.ps1 -Action import -Source "seed-snapshots/before-upgrade"
```

## 🛠️ Available Commands

### PowerShell (Recommended)
```powershell
cd aspire/scripts

# Export current data
.\manage-seed-data.ps1 -Action export
.\manage-seed-data.ps1 -Action export -Output "my-snapshot"

# Import snapshot
.\manage-seed-data.ps1 -Action import -Source "seed-snapshots/2026-03-29"

# Setup fresh environment
.\manage-seed-data.ps1 -Action setup

# List available snapshots
.\manage-seed-data.ps1 -Action list

# Reset environment
.\manage-seed-data.ps1 -Action reset -Source "seed-snapshots/2026-03-29"
```

### NPM (Direct)
```bash
cd aspire/scripts

# Export
npm run export-seed
npm run export-seed -- --output ./seed-snapshots/my-snapshot

# Import
npm run import-seed -- --source ./seed-snapshots/2026-03-29

# Setup
npm run setup
```

## 📊 Example Output

### Export
```
==================================================================
BlueFin Wiki - Export Seed Data
==================================================================
Output directory: ./seed-snapshots/2026-03-29

--- Exporting S3 Buckets ---
Exporting S3 bucket: bluefinwiki-pages-local...
  ✓ Exported: abc-123/abc-123.md
  ✓ Exported: def-456/def-456.md
  ✓ Exported: abc-123/ghi-789/ghi-789.md
  Total objects exported from pages: 3

--- Exporting DynamoDB Tables ---
Exporting DynamoDB table: bluefinwiki-users-local...
  ✓ Exported 2 items to users.json

Export Summary:
S3 Objects:
  pages          : 3 objects
  attachments    : 0 objects
  exports        : 0 objects

DynamoDB Items:
  users          : 2 items
  invitations    : 2 items
  siteConfig     : 6 items
  ...

✓ Export complete! Data saved to: ./seed-snapshots/2026-03-29
```

## 📚 Documentation

- **[SEED-DATA.md](../aspire/SEED-DATA.md)** - Quick reference
- **[scripts/SEED-DATA-GUIDE.md](../aspire/scripts/SEED-DATA-GUIDE.md)** - Comprehensive guide
- **[scripts/README.md](../aspire/scripts/README.md)** - All scripts reference

## 🔐 Git Integration

By default, all snapshots are gitignored. To version control specific snapshots:

1. Edit `aspire/scripts/seed-snapshots/.gitignore`
2. Add exceptions for specific snapshots:
   ```gitignore
   # Ignore all snapshots
   *
   
   # But include baseline
   !baseline-v1/
   ```

3. Commit the snapshot:
   ```bash
   git add seed-snapshots/baseline-v1
   git commit -m "Add baseline test data snapshot"
   ```

## ✨ Enhanced Baseline Seeding

The `seed-data.js` script now creates:
- 2 test users (admin and standard)
- 2 invitation codes
- Site configuration
- User preferences
- **NEW:** Sample wiki pages in S3:
  - Welcome to BlueFinWiki
  - Family Recipes (with child page: Grandma's Cookies)
  - Family Tree

This gives you a realistic starting point to work from!

## 🎉 Benefits

1. **Repeatable** - Same test data every time
2. **Fast** - No manual setup after reset
3. **Realistic** - Use actual production-like data
4. **Versionable** - Track test data alongside code
5. **Shareable** - Team members get same environment
6. **Flexible** - Update snapshots as features evolve

## 🚀 Next Steps

1. Run the initial setup:
   ```powershell
   cd aspire/scripts
   .\manage-seed-data.ps1 -Action setup
   ```

2. Create some test data through your app

3. Export your first snapshot:
   ```powershell
   .\manage-seed-data.ps1 -Action export -Output "my-first-snapshot"
   ```

4. Try importing it:
   ```powershell
   .\manage-seed-data.ps1 -Action import -Source "seed-snapshots/my-first-snapshot"
   ```

Enjoy having reproducible test data! 🎊
