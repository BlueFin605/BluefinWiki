#!/usr/bin/env node

/**
 * Seed Kanban board test data into the local dev environment.
 *
 * Creates:
 *   - Page type "TV Show" (no state — it's a container)
 *   - Page type "Season" with state property (the board cards)
 *   - Parent page "TV Tracker" with boardConfig
 *   - TV Show child pages, each containing Season child pages with states
 *
 * Hierarchy:  TV Tracker → TV Show → Season
 * Board view: TV Tracker shows TV Shows on a board (state on TV Show)
 *             Each TV Show shows its Seasons on a board (state on Season)
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
// Helpers
// ---------------------------------------------------------------------------

async function getAdminUserId() {
  const result = await docClient.send(new ScanCommand({
    TableName: 'bluefinwiki-users-local',
    FilterExpression: '#r = :admin',
    ExpressionAttributeNames: { '#r': 'role' },
    ExpressionAttributeValues: { ':admin': 'Admin' },
  }));
  if (result.Items && result.Items.length > 0) return result.Items[0].userId;
  return uuidv4();
}

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

/**
 * Build a page's frontmatter + content and upload to S3.
 * Returns the GUID for chaining.
 */
async function createPage({ guid, parentGuid, parentS3Prefix, title, content, status, pageType, tags, properties, boardConfig, adminUserId, now }) {
  const propsLines = [];
  if (properties && Object.keys(properties).length > 0) {
    for (const [name, prop] of Object.entries(properties)) {
      propsLines.push(`  ${name}:`);
      propsLines.push(`    type: ${prop.type}`);
      if (prop.type === 'tags' && Array.isArray(prop.value)) {
        propsLines.push(`    value: [${prop.value.join(', ')}]`);
      } else if (prop.type === 'number') {
        propsLines.push(`    value: ${prop.value}`);
      } else {
        propsLines.push(`    value: ${typeof prop.value === 'string' && prop.value.startsWith('{') ? `'${prop.value}'` : `"${prop.value}"`}`);
      }
    }
  }

  const fmLines = [
    '---',
    `title: "${title}"`,
    `guid: "${guid}"`,
    ...(parentGuid ? [`parentGuid: "${parentGuid}"`, `folderId: "${parentGuid}"`] : []),
    `status: "${status || 'published'}"`,
    ...(pageType ? [`pageType: "${pageType}"`] : []),
    ...(boardConfig ? [`boardConfig: '${JSON.stringify(boardConfig)}'`] : []),
    `tags: [${(tags || []).join(', ')}]`,
    ...(propsLines.length > 0 ? ['properties:', ...propsLines] : []),
    `createdBy: "${adminUserId}"`,
    `modifiedBy: "${adminUserId}"`,
    `createdAt: "${now}"`,
    `modifiedAt: "${now}"`,
    '---',
  ];

  const body = fmLines.join('\n') + '\n' + (content || `# ${title}\n`);

  // S3 key: parentPrefix/guid/guid.md
  const prefix = parentS3Prefix ? `${parentS3Prefix}/${guid}` : `${guid}`;
  const s3Key = `${prefix}/${guid}.md`;

  await s3Client.send(new PutObjectCommand({
    Bucket: PAGES_BUCKET,
    Key: s3Key,
    Body: body,
    ContentType: 'text/markdown',
  }));

  return { guid, s3Prefix: prefix };
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
  // 1. Page types
  // -----------------------------------------------------------------------
  console.log('Creating page types...');

  const tvShowTypeGuid = uuidv4();
  const seasonTypeGuid = uuidv4();

  const tvShowType = {
    guid: tvShowTypeGuid,
    name: 'TV Show',
    icon: '📺',
    properties: JSON.stringify([
      { name: 'state', type: 'string', required: true, defaultValue: 'Unwatched' },
      { name: 'rating', type: 'number', required: false },
      { name: 'genre', type: 'tags', required: false, defaultValue: [] },
    ]),
    allowedChildTypes: JSON.stringify([seasonTypeGuid]),
    allowWikiPageChildren: true,
    createdBy: adminUserId,
    createdAt: now,
    updatedAt: now,
  };

  const seasonType = {
    guid: seasonTypeGuid,
    name: 'Season',
    icon: '🎬',
    properties: JSON.stringify([
      { name: 'state', type: 'string', required: true, defaultValue: 'Unwatched' },
      { name: 'season-number', type: 'number', required: false },
      { name: 'episodes', type: 'number', required: false },
    ]),
    allowedChildTypes: JSON.stringify([]),
    allowWikiPageChildren: true,
    createdBy: adminUserId,
    createdAt: now,
    updatedAt: now,
  };

  for (const pt of [tvShowType, seasonType]) {
    await docClient.send(new PutCommand({ TableName: PAGE_TYPES_TABLE, Item: pt }));
    console.log(`  ✓ Page type: ${pt.name} (${pt.icon})`);
  }

  // -----------------------------------------------------------------------
  // 2. Tag vocabularies
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
  // 3. TV Tracker root page (with boardConfig)
  // -----------------------------------------------------------------------
  console.log('\nCreating TV Tracker page...');

  const tvTrackerGuid = uuidv4();

  const tracker = await createPage({
    guid: tvTrackerGuid,
    parentGuid: null,
    parentS3Prefix: null,
    title: 'TV Tracker',
    content: `# TV Tracker

Track what the family is watching. Switch to **Board** view to see all seasons across every show, grouped by status. Click the gear icon to switch between viewing shows or seasons.

Each show has its own page with seasons underneath — open a show and switch to Board view to track season progress too.
`,
    status: 'published',
    tags: ['tv', 'tracker'],
    boardConfig: {
      columns: ['Unwatched', 'Watching', 'Completed', 'Dropped'],
      colors: { Unwatched: '#6b7280', Watching: '#3b82f6', Completed: '#22c55e', Dropped: '#ef4444' },
      targetTypeGuid: seasonTypeGuid,
      depth: 10,
      showParentTitle: true,
    },
    adminUserId,
    now,
  });
  console.log(`  ✓ TV Tracker`);

  // -----------------------------------------------------------------------
  // 4. TV Shows with Seasons
  // -----------------------------------------------------------------------
  console.log('\nCreating TV shows and seasons...');

  const shows = [
    {
      title: 'Severance',
      state: 'Watching',
      rating: 9,
      genre: ['sci-fi', 'thriller'],
      seasons: [
        { num: 1, episodes: 9, state: 'Completed' },
        { num: 2, episodes: 10, state: 'Watching' },
      ],
    },
    {
      title: 'The Bear',
      state: 'Watching',
      rating: 8,
      genre: ['drama'],
      seasons: [
        { num: 1, episodes: 8, state: 'Completed' },
        { num: 2, episodes: 10, state: 'Completed' },
        { num: 3, episodes: 10, state: 'Watching' },
      ],
    },
    {
      title: 'Shogun',
      state: 'Completed',
      rating: 10,
      genre: ['drama'],
      seasons: [
        { num: 1, episodes: 10, state: 'Completed' },
      ],
    },
    {
      title: 'Fallout',
      state: 'Completed',
      rating: 8,
      genre: ['sci-fi'],
      seasons: [
        { num: 1, episodes: 8, state: 'Completed' },
      ],
    },
    {
      title: 'The Diplomat',
      state: 'Unwatched',
      rating: null,
      genre: ['thriller', 'drama'],
      seasons: [
        { num: 1, episodes: 8, state: 'Unwatched' },
        { num: 2, episodes: 10, state: 'Unwatched' },
      ],
    },
    {
      title: 'Slow Horses',
      state: 'Unwatched',
      rating: null,
      genre: ['thriller'],
      seasons: [
        { num: 1, episodes: 6, state: 'Unwatched' },
        { num: 2, episodes: 6, state: 'Unwatched' },
        { num: 3, episodes: 6, state: 'Unwatched' },
        { num: 4, episodes: 6, state: 'Unwatched' },
      ],
    },
    {
      title: 'Andor',
      state: 'Completed',
      rating: 9,
      genre: ['sci-fi'],
      seasons: [
        { num: 1, episodes: 12, state: 'Completed' },
      ],
    },
    {
      title: 'Poker Face',
      state: 'Watching',
      rating: 7,
      genre: ['comedy', 'thriller'],
      seasons: [
        { num: 1, episodes: 10, state: 'Watching' },
      ],
    },
    {
      title: 'The Morning Show',
      state: 'Dropped',
      rating: 5,
      genre: ['drama'],
      seasons: [
        { num: 1, episodes: 10, state: 'Completed' },
        { num: 2, episodes: 10, state: 'Dropped' },
      ],
    },
    {
      title: 'Foundation',
      state: 'Dropped',
      rating: 6,
      genre: ['sci-fi', 'fantasy'],
      seasons: [
        { num: 1, episodes: 10, state: 'Completed' },
        { num: 2, episodes: 10, state: 'Dropped' },
      ],
    },
    {
      title: 'Silo',
      state: 'Unwatched',
      rating: null,
      genre: ['sci-fi'],
      seasons: [
        { num: 1, episodes: 10, state: 'Unwatched' },
        { num: 2, episodes: 10, state: 'Unwatched' },
      ],
    },
    {
      title: 'Ted Lasso',
      state: 'Completed',
      rating: 9,
      genre: ['comedy'],
      seasons: [
        { num: 1, episodes: 10, state: 'Completed' },
        { num: 2, episodes: 12, state: 'Completed' },
        { num: 3, episodes: 12, state: 'Completed' },
      ],
    },
  ];

  // Season board config (reused for each show that has seasons)
  const seasonBoardConfig = {
    columns: ['Unwatched', 'Watching', 'Completed', 'Dropped'],
    colors: { Unwatched: '#6b7280', Watching: '#3b82f6', Completed: '#22c55e', Dropped: '#ef4444' },
  };

  for (const show of shows) {
    const showGuid = uuidv4();

    const showProps = {
      state: { type: 'string', value: show.state },
      ...(show.rating !== null ? { rating: { type: 'number', value: show.rating } } : {}),
      ...(show.genre.length > 0 ? { genre: { type: 'tags', value: show.genre } } : {}),
    };

    const showPage = await createPage({
      guid: showGuid,
      parentGuid: tvTrackerGuid,
      parentS3Prefix: tracker.s3Prefix,
      title: show.title,
      content: `# ${show.title}\n\n${show.seasons.length} season${show.seasons.length !== 1 ? 's' : ''}. Switch to **Board** view to track season progress.\n`,
      status: 'published',
      pageType: tvShowTypeGuid,
      tags: ['tv'],
      properties: showProps,
      boardConfig: show.seasons.length > 0 ? seasonBoardConfig : undefined,
      adminUserId,
      now,
    });

    const seasonSummary = show.seasons.map(s => `S${s.num}:${s.state}`).join(' ');
    console.log(`  ✓ ${show.title} [${show.state}] — ${seasonSummary}`);

    // Create season child pages
    for (const season of show.seasons) {
      const seasonGuid = uuidv4();
      await createPage({
        guid: seasonGuid,
        parentGuid: showGuid,
        parentS3Prefix: showPage.s3Prefix,
        title: `Season ${season.num}`,
        content: `# ${show.title} — Season ${season.num}\n\n${season.episodes} episodes.\n`,
        status: 'published',
        pageType: seasonTypeGuid,
        tags: ['tv'],
        properties: {
          state: { type: 'string', value: season.state },
          'season-number': { type: 'number', value: season.num },
          episodes: { type: 'number', value: season.episodes },
        },
        adminUserId,
        now,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Done
  // -----------------------------------------------------------------------
  const totalSeasons = shows.reduce((sum, s) => sum + s.seasons.length, 0);
  console.log(`\n✓ Kanban seed data created successfully!`);
  console.log(`  ${shows.length} shows, ${totalSeasons} seasons`);
  console.log(`\nTo see the board:`);
  console.log(`  1. Open the wiki and navigate to "TV Tracker"`);
  console.log(`  2. Click the "Board" tab — shows grouped by status`);
  console.log(`  3. Click into a show, then "Board" tab — seasons grouped by status`);
  console.log(`  4. Drag cards between columns to change state`);
}

seedKanbanData().catch((err) => {
  console.error('\n✗ Error seeding kanban data:', err);
  process.exit(1);
});
