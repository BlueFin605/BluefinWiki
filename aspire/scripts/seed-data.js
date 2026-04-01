#!/usr/bin/env node

/**
 * Seed development data into DynamoDB tables
 * Creates test users, invitations, and configuration data
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const LOCALSTACK_ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const REGION = 'us-east-1';

const client = new DynamoDBClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: REGION,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

// S3 Client for seeding pages
const s3Client = new S3Client({
  endpoint: LOCALSTACK_ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const PAGES_BUCKET = 'bluefinwiki-pages-local';
// Note: Attachments stored in PAGES_BUCKET at {pageGuid}/_attachments/

// Test users
const ADMIN_USER_ID = uuidv4();
const STANDARD_USER_ID = uuidv4();
const PASSWORD = 'Test123!'; // Same password for all test users

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function seedUsers() {
  console.log('Seeding users table...');
  
  const passwordHash = await hashPassword(PASSWORD);
  const now = new Date().toISOString();

  const users = [
    {
      cognitoUserId: ADMIN_USER_ID,
      email: 'admin@bluefinwiki.local',
      passwordHash,
      role: 'Admin',
      status: 'active',
      displayName: 'Admin User',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    },
    {
      cognitoUserId: STANDARD_USER_ID,
      email: 'user@bluefinwiki.local',
      passwordHash,
      role: 'Standard',
      status: 'active',
      displayName: 'Standard User',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    },
  ];

  for (const user of users) {
    const command = new PutCommand({
      TableName: 'bluefinwiki-user-profiles-local',
      Item: user,
    });
    await docClient.send(command);
    console.log(`  ✓ Created user: ${user.email} (${user.role})`);
  }
}

async function seedInvitations() {
  console.log('\nSeeding invitations table...');
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  const invitations = [
    {
      inviteCode: 'WELCOME1',
      email: 'newuser1@bluefinwiki.local',
      role: 'Standard',
      createdBy: ADMIN_USER_ID,
      createdAt: now.toISOString(),
      expiresAt: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp for TTL
      status: 'pending',
      usedAt: null,
      usedBy: null,
    },
    {
      inviteCode: 'WELCOME2',
      email: 'newuser2@bluefinwiki.local',
      role: 'Standard',
      createdBy: ADMIN_USER_ID,
      createdAt: now.toISOString(),
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
      status: 'pending',
      usedAt: null,
      usedBy: null,
    },
  ];

  for (const invitation of invitations) {
    const command = new PutCommand({
      TableName: 'bluefinwiki-invitations-local',
      Item: invitation,
    });
    await docClient.send(command);
    console.log(`  ✓ Created invitation: ${invitation.inviteCode} for ${invitation.email}`);
  }
}

async function seedSiteConfig() {
  console.log('\nSeeding site configuration...');
  
  const now = new Date().toISOString();

  const configs = [
    {
      configKey: 'site.name',
      value: 'BlueFinWiki',
      updatedBy: ADMIN_USER_ID,
      updatedAt: now,
    },
    {
      configKey: 'site.description',
      value: 'Family Wiki Platform',
      updatedBy: ADMIN_USER_ID,
      updatedAt: now,
    },
    {
      configKey: 'features.comments.enabled',
      value: true,
      updatedBy: ADMIN_USER_ID,
      updatedAt: now,
    },
    {
      configKey: 'features.exports.enabled',
      value: true,
      updatedBy: ADMIN_USER_ID,
      updatedAt: now,
    },
    {
      configKey: 'email.fromAddress',
      value: 'noreply@bluefinwiki.local',
      updatedBy: ADMIN_USER_ID,
      updatedAt: now,
    },
    {
      configKey: 'email.fromName',
      value: 'BlueFinWiki',
      updatedBy: ADMIN_USER_ID,
      updatedAt: now,
    },
  ];

  for (const config of configs) {
    const command = new PutCommand({
      TableName: 'bluefinwiki-site-config-local',
      Item: config,
    });
    await docClient.send(command);
    console.log(`  ✓ Set config: ${config.configKey}`);
  }
}

async function seedUserPreferences() {
  console.log('\nSeeding user preferences...');
  
  const preferences = [
    {
      userId: ADMIN_USER_ID,
      preferenceKey: 'theme',
      value: 'light',
    },
    {
      userId: ADMIN_USER_ID,
      preferenceKey: 'language',
      value: 'en',
    },
    {
      userId: ADMIN_USER_ID,
      preferenceKey: 'emailNotifications',
      value: true,
    },
    {
      userId: ADMIN_USER_ID,
      preferenceKey: 'dashboardLayout',
      value: ['welcome', 'recent', 'favorites', 'stats'],
    },
    {
      userId: STANDARD_USER_ID,
      preferenceKey: 'theme',
      value: 'light',
    },
    {
      userId: STANDARD_USER_ID,
      preferenceKey: 'language',
      value: 'en',
    },
    {
      userId: STANDARD_USER_ID,
      preferenceKey: 'emailNotifications',
      value: true,
    },
    {
      userId: STANDARD_USER_ID,
      preferenceKey: 'dashboardLayout',
      value: ['welcome', 'recent', 'favorites'],
    },
  ];

  for (const pref of preferences) {
    const command = new PutCommand({
      TableName: 'bluefinwiki-user-preferences-local',
      Item: pref,
    });
    await docClient.send(command);
    console.log(`  ✓ Created preference: ${pref.preferenceKey} for user ${pref.userId}`);
  }
}

/**
 * Ensure S3 bucket exists
 */
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
 * Seed sample pages to S3
 */
async function seedPages() {
  console.log('\nSeeding sample pages to S3...');
  
  await ensureBucket(PAGES_BUCKET);
  
  const now = new Date().toISOString();
  
  // Sample pages data
  const pages = [
    {
      guid: uuidv4(),
      parentGuid: null,
      title: 'Welcome to BlueFinWiki',
      content: `# Welcome to BlueFinWiki

Welcome to your family wiki! This is a collaborative space where you can:

- **Document** family history and stories
- **Share** recipes and traditions
- **Organize** important information
- **Collaborate** with family members

## Getting Started

1. Explore the navigation to discover existing pages
2. Create new pages to add your content
3. Use folders to organize related pages
4. Invite family members to collaborate

## Features

- **Rich Text Editor**: Write using Markdown
- **Folder Management**: Organize pages hierarchically
- **Search**: Find content quickly
- **Version History**: Track changes over time
- **Comments**: Discuss and collaborate

Start creating your family's knowledge base today!`,
      tags: ['welcome', 'getting-started'],
      status: 'published',
    },
    {
      guid: uuidv4(),
      parentGuid: null,
      title: 'Family Recipes',
      content: `# Family Recipes

A collection of our treasured family recipes passed down through generations.

## Recipe Categories

- Appetizers
- Main Dishes
- Desserts
- Holiday Specials

*Add your favorite recipes as child pages under this folder.*`,
      tags: ['recipes', 'food'],
      status: 'published',
    },
    {
      guid: uuidv4(),
      parentGuid: null,
      title: 'Family Tree',
      content: `# Family Tree

Document our family genealogy and relationships.

## Branches

Use child pages to document:
- Different family branches
- Individual biographies
- Historical photos
- Family stories

*This is a living document - everyone can contribute!*`,
      tags: ['genealogy', 'family-history'],
      status: 'published',
    },
  ];

  // Create a child page for one of the parents
  const recipesPage = pages[1];
  const childPage = {
    guid: uuidv4(),
    parentGuid: recipesPage.guid,
    title: 'Grandma\'s Chocolate Chip Cookies',
    content: `# Grandma's Chocolate Chip Cookies

The best chocolate chip cookies you'll ever taste!

## Ingredients

- 2 1/4 cups all-purpose flour
- 1 tsp baking soda
- 1 tsp salt
- 1 cup butter, softened
- 3/4 cup granulated sugar
- 3/4 cup packed brown sugar
- 2 large eggs
- 2 tsp vanilla extract
- 2 cups chocolate chips

## Instructions

1. Preheat oven to 375°F (190°C)
2. Mix flour, baking soda, and salt in a bowl
3. Beat butter and sugars until creamy
4. Add eggs and vanilla
5. Gradually blend in flour mixture
6. Stir in chocolate chips
7. Drop rounded tablespoons onto ungreased cookie sheets
8. Bake 9-11 minutes or until golden brown

## Notes

*This recipe has been in our family for three generations. Grandma always said the secret was using real butter!*`,
    tags: ['dessert', 'cookies', 'grandma'],
    status: 'published',
  };

  pages.push(childPage);

  // Upload each page to S3
  for (const page of pages) {
    const frontmatter = `---
title: "${page.title}"
guid: "${page.guid}"
${page.parentGuid ? `parentGuid: "${page.parentGuid}"` : ''}
${page.parentGuid ? `folderId: "${page.parentGuid}"` : ''}
status: "${page.status}"
tags: ${JSON.stringify(page.tags)}
createdBy: "${ADMIN_USER_ID}"
modifiedBy: "${ADMIN_USER_ID}"
createdAt: "${now}"
modifiedAt: "${now}"
---
`;

    const fullContent = frontmatter + page.content;
    
    // Build S3 key based on page hierarchy
    let s3Key;
    if (page.parentGuid) {
      s3Key = `${page.parentGuid}/${page.guid}/${page.guid}.md`;
    } else {
      s3Key = `${page.guid}/${page.guid}.md`;
    }

    const putCommand = new PutObjectCommand({
      Bucket: PAGES_BUCKET,
      Key: s3Key,
      Body: fullContent,
      ContentType: 'text/markdown',
    });

    await s3Client.send(putCommand);
    console.log(`  ✓ Created page: ${page.title} (${s3Key})`);
  }

  console.log(`  Total pages created: ${pages.length}`);
}

async function seedData() {
  console.log('Starting seed process...\n');
  console.log('Default password for all test users:', PASSWORD);
  console.log('Endpoint:', LOCALSTACK_ENDPOINT);
  console.log('');

  try {
    await seedUsers();
    await seedInvitations();
    await seedSiteConfig();
    await seedUserPreferences();
    await seedPages();

    console.log('\n✓ All seed data created successfully!\n');
    console.log('Test credentials:');
    console.log('  Admin:    admin@bluefinwiki.local / Test123!');
    console.log('  Standard: user@bluefinwiki.local / Test123!');
    console.log('\nInvite codes:');
    console.log('  WELCOME1 - newuser1@bluefinwiki.local');
    console.log('  WELCOME2 - newuser2@bluefinwiki.local');
    console.log('\nSample pages created in S3 - check your wiki!');
  } catch (error) {
    console.error('\n✗ Error seeding data:', error);
    process.exit(1);
  }
}

// Run seeding
seedData();
