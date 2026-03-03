#!/usr/bin/env node

/**
 * Export Seed Data from LocalStack
 * 
 * Exports all S3 objects and DynamoDB data to JSON files for seeding new environments.
 * This allows you to capture your current test data and use it as seed data for future setups.
 * 
 * Usage:
 *   npm run export-seed [-- --output ./seed-snapshots/my-snapshot]
 * 
 * Output structure:
 *   {output-dir}/
 *     dynamodb/
 *       users.json
 *       invitations.json
 *       attachments.json
 *       comments.json
 *       page-links.json
 *       activity-log.json
 *       site-config.json
 *       user-preferences.json
 *     s3/
 *       pages/
 *         {guid}/{guid}.md
 *         {parent-guid}/{child-guid}/{child-guid}.md
 *       attachments/
 *         {guid}/{filename}
 *       exports/
 *         {export-id}.{format}
 *     metadata.json (snapshot metadata)
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const fs = require('fs').promises;
const path = require('path');

const LOCALSTACK_ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const REGION = 'us-east-1';

// Parse command line arguments
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const OUTPUT_DIR = outputIndex !== -1 && args[outputIndex + 1]
  ? args[outputIndex + 1]
  : path.join(__dirname, 'seed-snapshots', new Date().toISOString().split('T')[0]);

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

const DYNAMODB_TABLES = {
  users: 'bluefinwiki-users-local',
  invitations: 'bluefinwiki-invitations-local',
  attachments: 'bluefinwiki-attachments-local',
  comments: 'bluefinwiki-comments-local',
  pageLinks: 'bluefinwiki-page-links-local',
  activityLog: 'bluefinwiki-activity-log-local',
  siteConfig: 'bluefinwiki-site-config-local',
  userPreferences: 'bluefinwiki-user-preferences-local',
};

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * Export all objects from an S3 bucket
 */
async function exportS3Bucket(bucketName, bucketType) {
  console.log(`\nExporting S3 bucket: ${bucketName}...`);
  const bucketDir = path.join(OUTPUT_DIR, 's3', bucketType);
  await ensureDir(bucketDir);

  let continuationToken;
  let totalObjects = 0;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    });

    const listResponse = await s3Client.send(listCommand);

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      for (const object of listResponse.Contents) {
        const key = object.Key;
        
        // Get object content
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        });

        const getResponse = await s3Client.send(getCommand);
        const content = await streamToString(getResponse.Body);

        // Write to file maintaining directory structure
        const filePath = path.join(bucketDir, key);
        await ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content, 'utf8');

        totalObjects++;
        console.log(`  ✓ Exported: ${key}`);
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  console.log(`  Total objects exported from ${bucketType}: ${totalObjects}`);
  return totalObjects;
}

/**
 * Convert readable stream to string
 */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Export all items from a DynamoDB table
 */
async function exportDynamoDBTable(tableName, tableType) {
  console.log(`\nExporting DynamoDB table: ${tableName}...`);
  const items = [];
  let lastEvaluatedKey;

  do {
    const scanCommand = new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await dynamoClient.send(scanCommand);

    if (response.Items) {
      for (const item of response.Items) {
        items.push(unmarshall(item));
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Write to JSON file
  const tableDir = path.join(OUTPUT_DIR, 'dynamodb');
  await ensureDir(tableDir);
  
  const filePath = path.join(tableDir, `${tableType}.json`);
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');

  console.log(`  ✓ Exported ${items.length} items to ${tableType}.json`);
  return items.length;
}

/**
 * Generate snapshot metadata
 */
async function generateMetadata(stats) {
  const metadata = {
    exportedAt: new Date().toISOString(),
    exportedBy: 'export-seed-data.js',
    environment: 'LocalStack',
    statistics: stats,
    buckets: S3_BUCKETS,
    tables: DYNAMODB_TABLES,
  };

  const metadataPath = path.join(OUTPUT_DIR, 'metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`\n✓ Metadata saved to ${metadataPath}`);
}

/**
 * Main export function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('BlueFin Wiki - Export Seed Data');
  console.log('='.repeat(60));
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  await ensureDir(OUTPUT_DIR);

  const stats = {
    s3: {},
    dynamodb: {},
  };

  try {
    // Export S3 buckets
    console.log('\n--- Exporting S3 Buckets ---');
    for (const [bucketType, bucketName] of Object.entries(S3_BUCKETS)) {
      try {
        stats.s3[bucketType] = await exportS3Bucket(bucketName, bucketType);
      } catch (err) {
        console.error(`  ✗ Failed to export ${bucketType}: ${err.message}`);
        stats.s3[bucketType] = 0;
      }
    }

    // Export DynamoDB tables
    console.log('\n--- Exporting DynamoDB Tables ---');
    for (const [tableType, tableName] of Object.entries(DYNAMODB_TABLES)) {
      try {
        stats.dynamodb[tableType] = await exportDynamoDBTable(tableName, tableType);
      } catch (err) {
        console.error(`  ✗ Failed to export ${tableType}: ${err.message}`);
        stats.dynamodb[tableType] = 0;
      }
    }

    // Generate metadata
    await generateMetadata(stats);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Export Summary');
    console.log('='.repeat(60));
    console.log('\nS3 Objects:');
    for (const [type, count] of Object.entries(stats.s3)) {
      console.log(`  ${type.padEnd(15)}: ${count} objects`);
    }
    console.log('\nDynamoDB Items:');
    for (const [type, count] of Object.entries(stats.dynamodb)) {
      console.log(`  ${type.padEnd(15)}: ${count} items`);
    }
    console.log(`\n✓ Export complete! Data saved to: ${OUTPUT_DIR}`);
    console.log('\nTo import this data:');
    console.log(`  npm run import-seed -- --source "${OUTPUT_DIR}"\n`);

  } catch (error) {
    console.error('\n✗ Export failed:', error);
    process.exit(1);
  }
}

main();
