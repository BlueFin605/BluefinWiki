# Seed Data Management Quick Reference

This guide shows you how to export your test data from S3 and DynamoDB and use it to seed future Aspire environments.

## 🎯 Common Workflows

### First Time Setup
```powershell
cd aspire/scripts
.\manage-seed-data.ps1 -Action setup
```

### Capture Your Current Data
```powershell
cd aspire/scripts

# Export to timestamped snapshot (recommended)
.\manage-seed-data.ps1 -Action export

# Or export to named snapshot
.\manage-seed-data.ps1 -Action export -Output "my-feature-data"
```

### Restore From Snapshot
```powershell
cd aspire/scripts

# List available snapshots
.\manage-seed-data.ps1 -Action list

# Import specific snapshot
.\manage-seed-data.ps1 -Action import -Source "seed-snapshots/2026-03-03"
```

### Full Reset to Known State
```powershell
cd aspire/scripts

# Step 1: Reset (removes LocalStack data)
.\manage-seed-data.ps1 -Action reset -Source "seed-snapshots/2026-03-03"

# Step 2: Restart Aspire
cd ..
.\start-aspire.ps1

# Step 3: Initialize and restore
cd scripts
npm run init-db
.\manage-seed-data.ps1 -Action import -Source "seed-snapshots/2026-03-03"
```

## 📦 What Gets Captured

**S3 Buckets:**
- Wiki pages (with full folder hierarchy)
- File attachments
- Exported content

**DynamoDB Tables:**
- Users and invitations
- Page links and comments
- Attachments metadata
- Site configuration
- User preferences
- Activity logs

## 🎬 Example Scenario: Adding a New Feature

```powershell
# 1. Capture baseline before starting
cd aspire/scripts
.\manage-seed-data.ps1 -Action export -Output "before-comments-feature"

# 2. Implement comments feature, create test data
#    - Add some test comments through the UI
#    - Create test scenarios you want to reuse

# 3. Export the new state with test data
.\manage-seed-data.ps1 -Action export -Output "with-comments-testdata"

# 4. Later, restore this state anytime
.\manage-seed-data.ps1 -Action import -Source "seed-snapshots/with-comments-testdata"
```

## 🔧 NPM Commands (Alternative)

If you prefer npm commands directly:

```bash
cd aspire/scripts

# Export
npm run export-seed
npm run export-seed -- --output ./seed-snapshots/my-snapshot

# Import  
npm run import-seed -- --source ./seed-snapshots/2026-03-03

# Baseline setup
npm run setup
```

## 📁 Snapshot Structure

```
aspire/scripts/seed-snapshots/
  2026-03-03/
    dynamodb/          # JSON files for each table
    s3/
      pages/           # Wiki pages with folder hierarchy
      attachments/     # Uploaded files
      exports/         # Export archives
    metadata.json      # Snapshot info
```

## 💡 Tips

**Version Control:**
- By default, snapshots are gitignored
- To commit a snapshot: edit `seed-snapshots/.gitignore`
- Useful for sharing baseline test data with team

**Storage:**
- Snapshots can be large (depends on attachments)
- Delete old snapshots you don't need
- Consider backing up important snapshots outside the repo

**Best Practices:**
- Export after creating valuable test scenarios
- Name snapshots descriptively (`-Output "user-auth-flow"`)
- Document what each snapshot contains
- Create baseline snapshots before major changes

## 🆘 Troubleshooting

**Export shows 0 objects:**
- Ensure LocalStack is running (check Aspire dashboard)
- Run `npm run seed` first to create baseline data

**Import fails:**
- Make sure tables exist: `npm run init-db`
- Check source path is correct
- Verify Aspire/LocalStack is running

**Data persists after reset:**
- Completely stop Aspire
- Delete `aspire/BlueFinWiki.AppHost/localstack-data`
- Restart Aspire

## 📚 Documentation

- [SEED-DATA-GUIDE.md](scripts/SEED-DATA-GUIDE.md) - Comprehensive guide
- [scripts/README.md](scripts/README.md) - All available scripts
- [ASPIRE-LOCAL-DEV.md](ASPIRE-LOCAL-DEV.md) - Aspire development guide
