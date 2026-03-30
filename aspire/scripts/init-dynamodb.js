#!/usr/bin/env node

/**
 * Initialize DynamoDB tables in LocalStack for local development
 * This script creates all required tables with the same schema as production
 */

const { DynamoDBClient, CreateTableCommand, ListTablesCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

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

const tableDefinitions = [
  {
    name: 'bluefinwiki-users-local',
    schema: {
      TableName: 'bluefinwiki-users-local',
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' }, // Partition key
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'email-index',
          KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
        },
      ],
      BillingMode: 'PROVISIONED',
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: 'NEW_AND_OLD_IMAGES',
      },
    },
  },
  {
    name: 'bluefinwiki-invitations-local',
    schema: {
      TableName: 'bluefinwiki-invitations-local',
      KeySchema: [
        { AttributeName: 'inviteCode', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'inviteCode', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  },
  {
    name: 'bluefinwiki-page-links-local',
    schema: {
      TableName: 'bluefinwiki-page-links-local',
      KeySchema: [
        { AttributeName: 'sourceGuid', KeyType: 'HASH' },
        { AttributeName: 'targetGuid', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'sourceGuid', AttributeType: 'S' },
        { AttributeName: 'targetGuid', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'targetGuid-index',
          KeySchema: [{ AttributeName: 'targetGuid', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  },
  {
    name: 'bluefinwiki-attachments-local',
    schema: {
      TableName: 'bluefinwiki-attachments-local',
      KeySchema: [
        { AttributeName: 'guid', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'guid', AttributeType: 'S' },
        { AttributeName: 'pageGuid', AttributeType: 'S' },
        { AttributeName: 'uploadedAt', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'pageGuid-index',
          KeySchema: [
            { AttributeName: 'pageGuid', KeyType: 'HASH' },
            { AttributeName: 'uploadedAt', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  },
  {
    name: 'bluefinwiki-comments-local',
    schema: {
      TableName: 'bluefinwiki-comments-local',
      KeySchema: [
        { AttributeName: 'guid', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'guid', AttributeType: 'S' },
        { AttributeName: 'pageGuid', AttributeType: 'S' },
        { AttributeName: 'createdAt', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'pageGuid-createdAt-index',
          KeySchema: [
            { AttributeName: 'pageGuid', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  },
  {
    name: 'bluefinwiki-activity-log-local',
    schema: {
      TableName: 'bluefinwiki-activity-log-local',
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  },
  {
    name: 'bluefinwiki-user-preferences-local',
    schema: {
      TableName: 'bluefinwiki-user-preferences-local',
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'preferenceKey', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'preferenceKey', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  },
  {
    name: 'bluefinwiki-page-index-local',
    schema: {
      TableName: 'bluefinwiki-page-index-local',
      KeySchema: [
        { AttributeName: 'guid', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'guid', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  },
  {
    name: 'bluefinwiki-tags-local',
    schema: {
      TableName: 'bluefinwiki-tags-local',
      KeySchema: [
        { AttributeName: 'scope', KeyType: 'HASH' },
        { AttributeName: 'tag', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'scope', AttributeType: 'S' },
        { AttributeName: 'tag', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  },
  {
    name: 'bluefinwiki-site-config-local',
    schema: {
      TableName: 'bluefinwiki-site-config-local',
      KeySchema: [
        { AttributeName: 'configKey', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'configKey', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    },
  },
];

async function tableExists(tableName) {
  try {
    const command = new DescribeTableCommand({ TableName: tableName });
    await client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function createTable(definition) {
  try {
    const exists = await tableExists(definition.name);
    
    if (exists) {
      console.log(`✓ Table ${definition.name} already exists`);
      return;
    }

    console.log(`Creating table ${definition.name}...`);
    const command = new CreateTableCommand(definition.schema);
    await client.send(command);
    console.log(`✓ Created table ${definition.name}`);
  } catch (error) {
    console.error(`✗ Error creating table ${definition.name}:`, error.message);
    throw error;
  }
}

async function initializeTables() {
  console.log('Initializing DynamoDB tables in LocalStack...');
  console.log(`Endpoint: ${LOCALSTACK_ENDPOINT}\n`);

  try {
    // Check if LocalStack is accessible
    const listCommand = new ListTablesCommand({});
    await client.send(listCommand);
    console.log('✓ Connected to LocalStack\n');
  } catch (error) {
    console.error('✗ Failed to connect to LocalStack:', error.message);
    console.error('Make sure LocalStack is running at', LOCALSTACK_ENDPOINT);
    process.exit(1);
  }

  // Create all tables
  for (const definition of tableDefinitions) {
    await createTable(definition);
  }

  console.log('\n✓ All DynamoDB tables initialized successfully!');
  console.log('\nTables created:');
  tableDefinitions.forEach((def) => {
    console.log(`  - ${def.name}`);
  });
}

// Run initialization
initializeTables().catch((error) => {
  console.error('Failed to initialize tables:', error);
  process.exit(1);
});
