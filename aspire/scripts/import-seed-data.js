#!/usr/bin/env node

/**
 * Import Seed Data into LocalStack
 * 
 * Imports S3 objects and DynamoDB data from exported seed data snapshots.
 * This allows you to quickly restore your environment to a known state.
 * 
 * Usage:
 *   npm run import-seed -- --source ./seed-snapshots/2026-03-30
 * 
 * Input structure (same as export):
 *   {source-dir}/
 *     dynamodb/*.json
 *     s3/pages/**
 *     s3/attachments/**
 *     s3/exports/**
 *     metadata.json
 */

const { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');

const LOCALSTACK_ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const REGION = 'us-east-1';

// Parse command line arguments
const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
if (sourceIndex === -1 || !args[sourceIndex + 1]) {
  console.error('Error: --source directory is required');
  console.log('Usage: npm run import-seed -- --source ./seed-snapshots/2026-03-30');
  process.exit(1);
}
const SOURCE_DIR = args[sourceIndex + 1];

// S3 Configuration
const s3Client = new S3Client({
  endpoint: LOCALSTACK_ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const S3_BUCKETS = {
  pages: 'bluefinwiki-pages-local',
  attachments: 'bluefinwiki-attachments-local',
  exports: 'bluefinwiki-exports-local',
};

// DynamoDB Configuration
const dynamoClient = new DynamoDBClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: REGION,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DYNAMODB_TABLES = {
  users: 'bluefinwiki-user-profiles-local',
  invitations: 'bluefinwiki-invitations-local',
  attachments: 'bluefinwiki-attachments-local',
  comments: 'bluefinwiki-comments-local',
  pageLinks: 'bluefinwiki-page-links-local',
  activityLog: 'bluefinwiki-activity-log-local',
  siteConfig: 'bluefinwiki-site-config-local',
  userPreferences: 'bluefinwiki-user-preferences-local',
  pageIndex: 'bluefinwiki-page-index-local',
  tags: 'bluefinwiki-tags-local',
};

/**
 * Ensure S3 bucket exists
 */
async function ensureBucket(bucketName) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`  ✓ Bucket exists: ${bucketName}`);
  } catch (err) {
    if (err.name === 'NotFound') {
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`  ✓ Created bucket: ${bucketName}`);
    } else {
      throw err;
    }
  }
}

/**
 * Import files to S3 bucket
 */
async function importS3Bucket(bucketName, bucketType) {
  console.log(`\nImporting S3 bucket: ${bucketName}... from ${SOURCE_DIR}/s3/${bucketType}/`);
  
  await ensureBucket(bucketName);

  const bucketDir = path.join(SOURCE_DIR, 's3', bucketType);
  console.log(`  Checking for data in: ${bucketDir}...`);

  try {
    await fs.access(bucketDir);
  } catch {
    console.log(`  ⓘ No data directory found for ${bucketType}, skipping`);
    return 0;
  }

  // Check if key mapping file exists (new flattened format)
  const mappingPath = path.join(bucketDir, '_key-mapping.json');
  let keyMapping = null;
  
  try {
    const mappingContent = await fs.readFile(mappingPath, 'utf8');
    keyMapping = JSON.parse(mappingContent);
    console.log(`  ✓ Using flattened key mapping`);
  } catch {
    // No mapping file, use old nested directory format
    console.log(`  ⓘ Using legacy directory structure format`);
  }

  // Find all files recursively using glob
  const files = glob.sync('**/*', {
    cwd: bucketDir,
    nodir: true,
    absolute: false,
  });

  let totalUploaded = 0;

  console.log(`  Found ${files.length} files to import in ${bucketDir}...`);

  for (const file of files) {
    // Skip the mapping file itself
    if (file === '_key-mapping.json') {
      continue;
    }

    const filePath = path.join(bucketDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    
    // Use key mapping if available, otherwise use the relative path
    let s3Key;
    if (keyMapping && keyMapping[file]) {
      s3Key = keyMapping[file];
    } else {
      // Fallback to legacy format (nested directories)
      s3Key = file.replace(/\\/g, '/');
    }

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: content,
      ContentType: getContentType(s3Key),
    });

    await s3Client.send(putCommand);
    totalUploaded++;
    console.log(`  ✓ Uploaded: ${s3Key}`);
  }

  console.log(`  Total files imported to ${bucketType}: ${totalUploaded}`);
  return totalUploaded;
}

/**
 * Get content type based on file extension
 */
function getContentType(key) {
  const ext = path.extname(key).toLowerCase();
  const contentTypes = {
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.zip': 'application/zip',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Import items to DynamoDB table
 */
async function importDynamoDBTable(tableName, tableType) {
  console.log(`\nImporting DynamoDB table: ${tableName}...`);
  
  const filePath = path.join(SOURCE_DIR, 'dynamodb', `${tableType}.json`);
  
  try {
    await fs.access(filePath);
  } catch {
    console.log(`  ⓘ No data file found for ${tableType}, skipping`);
    return 0;
  }

  const data = await fs.readFile(filePath, 'utf8');
  const items = JSON.parse(data);

  for (const item of items) {
    const putCommand = new PutCommand({
      TableName: tableName,
      Item: item,
    });

    await docClient.send(putCommand);
  }

  console.log(`  ✓ Imported ${items.length} items to ${tableType}`);
  return items.length;
}

/**
 * Main import function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('BlueFin Wiki - Import Seed Data');
  console.log('='.repeat(60));
  console.log(`Source directory: ${SOURCE_DIR}\n`);

  // Verify source directory exists
  try {
    await fs.access(SOURCE_DIR);
  } catch {
    console.error(`✗ Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  // Load metadata if available
  try {
    const metadataPath = path.join(SOURCE_DIR, 'metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    console.log('Snapshot Information:');
    console.log(`  Exported: ${metadata.exportedAt}`);
    console.log(`  Environment: ${metadata.environment}\n`);
  } catch {
    console.log('ⓘ No metadata file found, proceeding with import\n');
  }

  const stats = {
    s3: {},
    dynamodb: {},
  };

  try {
    // Import S3 buckets
    console.log('\n--- Importing S3 Buckets ---');
    for (const [bucketType, bucketName] of Object.entries(S3_BUCKETS)) {
      try {
        stats.s3[bucketType] = await importS3Bucket(bucketName, bucketType);
      } catch (err) {
        console.error(`  ✗ Failed to import ${bucketType}: ${err.message}`);
        stats.s3[bucketType] = 0;
      }
    }

    // Import DynamoDB tables
    console.log('\n--- Importing DynamoDB Tables ---');
    for (const [tableType, tableName] of Object.entries(DYNAMODB_TABLES)) {
      try {
        stats.dynamodb[tableType] = await importDynamoDBTable(tableName, tableType);
      } catch (err) {
        console.error(`  ✗ Failed to import ${tableType}: ${err.message}`);
        stats.dynamodb[tableType] = 0;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Import Summary');
    console.log('='.repeat(60));
    console.log('\nS3 Objects:');
    for (const [type, count] of Object.entries(stats.s3)) {
      console.log(`  ${type.padEnd(15)}: ${count} objects`);
    }
    console.log('\nDynamoDB Items:');
    for (const [type, count] of Object.entries(stats.dynamodb)) {
      console.log(`  ${type.padEnd(15)}: ${count} items`);
    }
    console.log('\n✓ Import complete!\n');

  } catch (error) {
    console.error('\n✗ Import failed:', error);
    process.exit(1);
  }
}

main();
