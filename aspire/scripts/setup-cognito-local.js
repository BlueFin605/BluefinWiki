#!/usr/bin/env node

/**
 * Setup script for cognito-local
 * 
 * This script initializes the local Cognito environment with:
 * - User pool
 * - User pool client
 * - Test users (admin and standard)
 * - DynamoDB user profiles
 */

import { CognitoIdentityProviderClient, CreateUserPoolCommand, CreateUserPoolClientCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand, ListUserPoolsCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const COGNITO_ENDPOINT = process.env.COGNITO_ENDPOINT || 'http://localhost:9229';
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:4566';
const AWS_REGION = 'us-east-1';

const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
  endpoint: COGNITO_ENDPOINT,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: AWS_REGION,
    endpoint: DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  })
);

const USER_PROFILES_TABLE = 'bluefinwiki-user-profiles-local';

async function main() {
  console.log('🚀 Setting up local Cognito environment...\n');

  try {
    // Step 1: Check if user pool already exists
    console.log('1. Checking for existing user pool...');
    let userPoolId = 'local_user_pool_id';
    
    try {
      const listPoolsCommand = new ListUserPoolsCommand({ MaxResults: 10 });
      const pools = await cognitoClient.send(listPoolsCommand);
      
      if (pools.UserPools && pools.UserPools.length > 0) {
        console.log('   ✓ User pool already exists');
        userPoolId = pools.UserPools[0].Id || userPoolId;
      } else {
        // Create user pool
        console.log('   → Creating user pool...');
        const createPoolResult = await createUserPool();
        userPoolId = createPoolResult;
        console.log(`   ✓ User pool created: ${userPoolId}`);
      }
    } catch (error) {
      console.log('   ⚠ Could not check/create user pool (cognito-local may not fully support this)');
      console.log('   → Using default user pool ID: local_user_pool_id');
    }

    // Step 2: Create user pool client
    console.log('\n2. Creating user pool client...');
    try {
      const clientId = await createUserPoolClient(userPoolId);
      console.log(`   ✓ Client created: ${clientId}`);
    } catch (error) {
      console.log('   ⚠ Could not create client (may already exist)');
    }

    // Step 3: Create test users
    console.log('\n3. Creating test users...');
    
    const testUsers = [
      {
        email: 'admin@bluefinwiki.local',
        displayName: 'Admin User',
        role: 'Admin',
        password: 'Test123!',
      },
      {
        email: 'user@bluefinwiki.local',
        displayName: 'Standard User',
        role: 'Standard',
        password: 'Test123!',
      },
    ];

    for (const user of testUsers) {
      try {
        console.log(`   → Creating user: ${user.email}...`);
        const cognitoUserId = await createTestUser(userPoolId, user);
        
        // Create user profile in DynamoDB
        await createUserProfile(cognitoUserId, user);
        
        console.log(`   ✓ User created: ${user.email} (${user.role})`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('UsernameExistsException')) {
          console.log(`   ⚠ User already exists: ${user.email}`);
        } else {
          console.error(`   ✗ Failed to create user ${user.email}:`, error);
        }
      }
    }

    console.log('\n✅ Setup complete!\n');
    console.log('Test credentials:');
    console.log('  Admin: admin@bluefinwiki.local / Test123!');
    console.log('  User:  user@bluefinwiki.local / Test123!');
    console.log('\nCognito endpoint: ' + COGNITO_ENDPOINT);
    console.log('DynamoDB endpoint: ' + DYNAMODB_ENDPOINT);
    console.log('MailHog UI: http://localhost:8025');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

async function createUserPool() {
  const command = new CreateUserPoolCommand({
    PoolName: 'bluefinwiki-local',
    Policies: {
      PasswordPolicy: {
        MinimumLength: 8,
        RequireUppercase: true,
        RequireLowercase: true,
        RequireNumbers: true,
        RequireSymbols: true,
      },
    },
    AutoVerifiedAttributes: ['email'],
    UsernameAttributes: ['email'],
    Schema: [
      {
        Name: 'email',
        AttributeDataType: 'String',
        Required: true,
        Mutable: true,
      },
      {
        Name: 'name',
        AttributeDataType: 'String',
        Required: false,
        Mutable: true,
      },
      {
        Name: 'role',
        AttributeDataType: 'String',
        Required: false,
        Mutable: true,
        DeveloperOnlyAttribute: false,
      },
    ],
  });

  const result = await cognitoClient.send(command);
  return result.UserPool?.Id || 'local_user_pool_id';
}

async function createUserPoolClient(userPoolId) {
  const command = new CreateUserPoolClientCommand({
    UserPoolId: userPoolId,
    ClientName: 'bluefinwiki-web-client',
    GenerateSecret: false,
    ExplicitAuthFlows: [
      'ALLOW_USER_SRP_AUTH',
      'ALLOW_REFRESH_TOKEN_AUTH',
      'ALLOW_USER_PASSWORD_AUTH',
    ],
    RefreshTokenValidity: 30,
    AccessTokenValidity: 60,
    IdTokenValidity: 60,
    TokenValidityUnits: {
      AccessToken: 'minutes',
      IdToken: 'minutes',
      RefreshToken: 'days',
    },
  });

  const result = await cognitoClient.send(command);
  return result.UserPoolClient?.ClientId || 'local-client-id';
}

async function createTestUser(userPoolId, user) {
  // Create user
  const createCommand = new AdminCreateUserCommand({
    UserPoolId: userPoolId,
    Username: user.email,
    UserAttributes: [
      { Name: 'email', Value: user.email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: user.displayName },
      { Name: 'custom:role', Value: user.role },
    ],
    TemporaryPassword: 'TempPassword123!',
    MessageAction: 'SUPPRESS',
  });

  const createResult = await cognitoClient.send(createCommand);
  
  // Extract Cognito sub (user ID)
  const subAttribute = createResult.User?.Attributes?.find(attr => attr.Name === 'sub');
  const cognitoUserId = subAttribute?.Value || `test-user-${Date.now()}`;

  // Set permanent password
  const setPasswordCommand = new AdminSetUserPasswordCommand({
    UserPoolId: userPoolId,
    Username: user.email,
    Password: user.password,
    Permanent: true,
  });

  await cognitoClient.send(setPasswordCommand);

  return cognitoUserId;
}

async function createUserProfile(cognitoUserId, user) {
  const now = new Date().toISOString();

  const profile = {
    cognitoUserId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: 'active',
    inviteCode: 'TESTCODE',
    createdAt: now,
    updatedAt: now,
    preferences: {
      theme: 'light',
      emailNotifications: true,
    },
  };

  const putCommand = new PutCommand({
    TableName: USER_PROFILES_TABLE,
    Item: profile,
  });

  try {
    await dynamoClient.send(putCommand);
  } catch (error) {
    console.error(`   ⚠ Could not create DynamoDB profile (table may not exist yet):`, error.message);
  }
}

main();
