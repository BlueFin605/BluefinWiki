#!/usr/bin/env node

/**
 * Seed Kanban board test data into the local dev environment.
 *
 * Creates:
 *   - Page type "TV Show" with state property
 *   - Page type "Episode" with state + season properties
 *   - Parent page "TV Tracker" with board-config
 *   - Child show pages in various states
 *
 * Run after the base seed: npm run seed-kanban
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const LOCALSTACK_ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const REGION = 'us-east-1';

const client = new DynamoDBClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: REGION,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
const docClient = DynamoDBDocumentClient.from(client);

const s3Client = new S3Client({
  endpoint: LOCALSTACK_ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

const PAGES_BUCKET = 'bluefinwiki-pages-local';
const PAGE_TYPES_TABLE = 'bluefinwiki-page-types-local';
const TAGS_TABLE = 'bluefinwiki-tags-local';

// ---------------------------------------------------------------------------
// Resolve the admin user ID from the existing seed data
// ---------------------------------------------------------------------------
async function getAdminUserId() {
  const result = await docClient.send(new ScanCommand({
    TableName: 'bluefinwiki-users-local',
    FilterExpression: '#r = :admin',
    ExpressionAttributeNames: { '#r': 'role' },
    ExpressionAttributeValues: { ':admin': 'Admin' },
  }));
  if (result.Items && result.Items.length > 0) return result.Items[0].userId;
  // Fallback — just use a placeholder UUID
  return uuidv4();
}

// ---------------------------------------------------------------------------
// Ensure S3 bucket exists
// ---------------------------------------------------------------------------
async function ensureBucket(bucketName) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (err) {
    if (err.name === 'NotFound') {
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`  ✓ Created bucket: ${bucketName}`);
    } else {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seedKanbanData() {
  console.log('Seeding Kanban board test data...\n');

  const adminUserId = await getAdminUserId();
  const now = new Date().toISOString();

  await ensureBucket(PAGES_BUCKET);

  // -----------------------------------------------------------------------
  // 1. Create page types
  // -----------------------------------------------------------------------
  console.log('Creating page types...');

  const tvShowTypeGuid = uuidv4();
  const episodeTypeGuid = uuidv4();

  const tvShowType = {
    guid: tvShowTypeGuid,
    name: 'TV Show',
    icon: '📺',
    properties: JSON.stringify([
      { name: 'state', type: 'string', required: true, defaultValue: 'Unwatched' },
      { name: 'rating', type: 'number', required: false },
      { name: 'genre', type: 'tags', required: false, defaultValue: [] },
    ]),
    allowedChildTypes: JSON.stringify([episodeTypeGuid]),
    allowWikiPageChildren: true,
    createdBy: adminUserId,
    createdAt: now,
    updatedAt: now,
  };

  const episodeType = {
    guid: episodeTypeGuid,
    name: 'Episode',
    icon: '🎬',
    properties: JSON.stringify([
      { name: 'state', type: 'string', required: true, defaultValue: 'Unwatched' },
      { name: 'season', type: 'number', required: false },
      { name: 'episode-number', type: 'number', required: false },
    ]),
    allowedChildTypes: JSON.stringify([]),
    allowWikiPageChildren: false,
    createdBy: adminUserId,
    createdAt: now,
    updatedAt: now,
  };

  for (const pt of [tvShowType, episodeType]) {
    await docClient.send(new PutCommand({ TableName: PAGE_TYPES_TABLE, Item: pt }));
    console.log(`  ✓ Page type: ${pt.name} (${pt.icon})`);
  }

  // -----------------------------------------------------------------------
  // 2. Seed tags vocabulary for the genre property
  // -----------------------------------------------------------------------
  console.log('\nSeeding tag vocabularies...');

  const genres = ['sci-fi', 'drama', 'comedy', 'thriller', 'fantasy', 'documentary'];
  for (const tag of genres) {
    await docClient.send(new PutCommand({
      TableName: TAGS_TABLE,
      Item: { scope: 'genre', tag },
    }));
  }
  console.log(`  ✓ Genre tags: ${genres.join(', ')}`);

  // -----------------------------------------------------------------------
  // 3. Create parent page: "TV Tracker"
  // -----------------------------------------------------------------------
  console.log('\nCreating TV Tracker parent page...');

  const tvTrackerGuid = uuidv4();
  const boardConfig = JSON.stringify({
    columns: ['Unwatched', 'Watching', 'Completed', 'Dropped'],
    colors: {
      Unwatched: '#6b7280',
      Watching: '#3b82f6',
      Completed: '#22c55e',
      Dropped: '#ef4444',
    },
  });

  const tvTrackerFrontmatter = [
    '---',
    `title: "TV Tracker"`,
    `guid: "${tvTrackerGuid}"`,
    `status: "published"`,
    `tags: [tv, tracker]`,
    `properties:`,
    `  board-config:`,
    `    type: string`,
    `    value: '${boardConfig}'`,
    `createdBy: "${adminUserId}"`,
    `modifiedBy: "${adminUserId}"`,
    `createdAt: "${now}"`,
    `modifiedAt: "${now}"`,
    '---',
  ].join('\n');

  const tvTrackerContent = `${tvTrackerFrontmatter}
# TV Tracker

Track what the family is watching. Switch to **Board** view to see shows grouped by status.

## How to use

- Add a new child page for each show
- Set its type to "TV Show"
- Drag cards between columns to update their state
`;

  await s3Client.send(new PutObjectCommand({
    Bucket: PAGES_BUCKET,
    Key: `${tvTrackerGuid}/${tvTrackerGuid}.md`,
    Body: tvTrackerContent,
    ContentType: 'text/markdown',
  }));
  console.log(`  ✓ TV Tracker page created`);

  // -----------------------------------------------------------------------
  // 4. Create child show pages with various states
  // -----------------------------------------------------------------------
  console.log('\nCreating TV show pages...');

  const shows = [
    { title: 'Severance',        state: 'Watching',   rating: 9, genre: ['sci-fi', 'thriller'] },
    { title: 'The Bear',         state: 'Watching',   rating: 8, genre: ['drama'] },
    { title: 'Shogun',           state: 'Completed',  rating: 10, genre: ['drama'] },
    { title: 'Fallout',          state: 'Completed',  rating: 8, genre: ['sci-fi'] },
    { title: 'The Diplomat',     state: 'Unwatched',  rating: null, genre: ['thriller', 'drama'] },
    { title: 'Slow Horses',      state: 'Unwatched',  rating: null, genre: ['thriller'] },
    { title: 'Andor',            state: 'Completed',  rating: 9, genre: ['sci-fi'] },
    { title: 'Poker Face',       state: 'Watching',   rating: 7, genre: ['comedy', 'thriller'] },
    { title: 'The Morning Show', state: 'Dropped',    rating: 5, genre: ['drama'] },
    { title: 'Foundation',       state: 'Dropped',    rating: 6, genre: ['sci-fi', 'fantasy'] },
    { title: 'Silo',             state: 'Unwatched',  rating: null, genre: ['sci-fi'] },
    { title: 'Ted Lasso',        state: 'Completed',  rating: 9, genre: ['comedy'] },
  ];

  for (const show of shows) {
    const showGuid = uuidv4();

    // Build properties YAML block
    const propsLines = [
      `  state:`,
      `    type: string`,
      `    value: "${show.state}"`,
    ];
    if (show.rating !== null) {
      propsLines.push(`  rating:`, `    type: number`, `    value: ${show.rating}`);
    }
    if (show.genre.length > 0) {
      propsLines.push(`  genre:`, `    type: tags`, `    value: [${show.genre.join(', ')}]`);
    }

    const frontmatter = [
      '---',
      `title: "${show.title}"`,
      `guid: "${showGuid}"`,
      `parentGuid: "${tvTrackerGuid}"`,
      `folderId: "${tvTrackerGuid}"`,
      `status: "published"`,
      `pageType: "${tvShowTypeGuid}"`,
      `tags: [tv]`,
      `properties:`,
      ...propsLines,
      `createdBy: "${adminUserId}"`,
      `modifiedBy: "${adminUserId}"`,
      `createdAt: "${now}"`,
      `modifiedAt: "${now}"`,
      '---',
    ].join('\n');

    const content = `${frontmatter}\n# ${show.title}\n\nState: ${show.state}\n`;
    const s3Key = `${tvTrackerGuid}/${showGuid}/${showGuid}.md`;

    await s3Client.send(new PutObjectCommand({
      Bucket: PAGES_BUCKET,
      Key: s3Key,
      Body: content,
      ContentType: 'text/markdown',
    }));

    console.log(`  ✓ ${show.title} [${show.state}]`);
  }

  // -----------------------------------------------------------------------
  // Done
  // -----------------------------------------------------------------------
  console.log(`\n✓ Kanban seed data created successfully!`);
  console.log(`\nTo see the board:`);
  console.log(`  1. Open the wiki and navigate to "TV Tracker"`);
  console.log(`  2. Click the "Board" tab above the editor`);
  console.log(`  3. Drag cards between columns to change state`);
}

seedKanbanData().catch((err) => {
  console.error('\n✗ Error seeding kanban data:', err);
  process.exit(1);
});
