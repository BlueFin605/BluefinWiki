#!/usr/bin/env node

/**
 * Migration Script: Cognito Users → DynamoDB user_profiles
 *
 * For production environments where users were created directly in Cognito
 * (before the invitation flow existed) and don't have DynamoDB user_profiles records.
 *
 * What it does:
 *   1. Lists all users from the Cognito User Pool
 *   2. For each user, checks if a user_profiles record already exists
 *   3. If missing, creates a record from Cognito attributes
 *
 * Usage:
 *   # Dry run (default) — shows what would be created
 *   node migrate-cognito-to-profiles.js
 *
 *   # Actually write to DynamoDB
 *   node migrate-cognito-to-profiles.js --apply
 *
 * Environment variables:
 *   AWS_REGION               — defaults to us-east-1
 *   COGNITO_USER_POOL_ID     — REQUIRED for production
 *   USER_PROFILES_TABLE      — defaults to bluefinwiki-user-profiles-local
 *   AWS_ENDPOINT_URL         — set for LocalStack (http://localhost:4566)
 */

const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID;
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local';
const ENDPOINT = process.env.AWS_ENDPOINT_URL;
const DRY_RUN = !process.argv.includes('--apply');

if (!USER_POOL_ID) {
  console.error('ERROR: COGNITO_USER_POOL_ID (or USER_POOL_ID) environment variable is required.');
  process.exit(1);
}

const cognitoClient = new CognitoIdentityProviderClient({
  region: REGION,
  ...(ENDPOINT && { endpoint: ENDPOINT }),
});

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: REGION,
  ...(ENDPOINT && {
    endpoint: ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  }),
}));

function getCognitoAttr(user, name) {
  const attr = (user.Attributes || []).find(a => a.Name === name);
  return attr ? attr.Value : undefined;
}

async function listAllCognitoUsers() {
  const users = [];
  let paginationToken;

  do {
    const result = await cognitoClient.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      PaginationToken: paginationToken,
    }));
    users.push(...(result.Users || []));
    paginationToken = result.PaginationToken;
  } while (paginationToken);

  return users;
}

async function profileExists(cognitoUserId) {
  const result = await dynamoClient.send(new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { cognitoUserId },
    ProjectionExpression: 'cognitoUserId',
  }));
  return !!result.Item;
}

async function createProfile(cognitoUser) {
  const sub = getCognitoAttr(cognitoUser, 'sub');
  const email = getCognitoAttr(cognitoUser, 'email');
  const role = getCognitoAttr(cognitoUser, 'custom:role') || 'Standard';
  const displayName = getCognitoAttr(cognitoUser, 'custom:displayName')
    || getCognitoAttr(cognitoUser, 'name')
    || cognitoUser.Username
    || email
    || 'Unknown';
  const status = cognitoUser.Enabled === false ? 'suspended' : 'active';
  const now = new Date().toISOString();
  const createdAt = cognitoUser.UserCreateDate
    ? cognitoUser.UserCreateDate.toISOString()
    : now;

  const profile = {
    cognitoUserId: sub,
    email: email || `unknown-${sub}@migrated`,
    displayName,
    role,
    status,
    createdAt,
    updatedAt: now,
    migratedAt: now,
  };

  await dynamoClient.send(new PutCommand({
    TableName: USER_PROFILES_TABLE,
    Item: profile,
    ConditionExpression: 'attribute_not_exists(cognitoUserId)', // safety: don't overwrite
  }));

  return profile;
}

async function main() {
  console.log('=== Cognito → user_profiles Migration ===');
  console.log(`Mode:       ${DRY_RUN ? 'DRY RUN (pass --apply to write)' : 'APPLY'}`);
  console.log(`Region:     ${REGION}`);
  console.log(`User Pool:  ${USER_POOL_ID}`);
  console.log(`Table:      ${USER_PROFILES_TABLE}`);
  if (ENDPOINT) console.log(`Endpoint:   ${ENDPOINT}`);
  console.log('');

  const cognitoUsers = await listAllCognitoUsers();
  console.log(`Found ${cognitoUsers.length} Cognito user(s)\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const cognitoUser of cognitoUsers) {
    const sub = getCognitoAttr(cognitoUser, 'sub');
    const email = getCognitoAttr(cognitoUser, 'email') || cognitoUser.Username;
    const role = getCognitoAttr(cognitoUser, 'custom:role') || 'Standard';

    if (!sub) {
      console.log(`  SKIP  ${email} — no sub attribute`);
      skipped++;
      continue;
    }

    try {
      const exists = await profileExists(sub);
      if (exists) {
        console.log(`  EXISTS  ${email} (${sub.substring(0, 8)}...)`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  WOULD CREATE  ${email} — role: ${role}, sub: ${sub.substring(0, 8)}...`);
        created++;
      } else {
        const profile = await createProfile(cognitoUser);
        console.log(`  CREATED  ${profile.email} — role: ${profile.role}, status: ${profile.status}`);
        created++;
      }
    } catch (err) {
      console.error(`  ERROR  ${email}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  ${DRY_RUN ? 'Would create' : 'Created'}: ${created}`);
  console.log(`  Skipped (already exist): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  if (DRY_RUN && created > 0) {
    console.log('\nRun with --apply to create the missing profiles.');
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
