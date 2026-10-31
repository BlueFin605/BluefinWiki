#!/usr/bin/env node
/**
 * Local Development Server for Lambda Functions
 * 
 * This Express server wraps Lambda handlers to enable local development
 * with Aspire orchestration. It simulates API Gateway by:
 * - Converting Express requests to Lambda APIGatewayProxyEvent format
 * - Calling the Lambda handlers
 * - Converting Lambda responses back to Express responses
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'node:http';
import { attachRealtime, originMiddleware } from './realtime/local-ws.js';
import { initializeStoragePlugin, StoragePluginRegistry } from './storage/index.js';
import { S3StoragePlugin } from './storage/S3StoragePlugin.js';

// Register storage plugins
StoragePluginRegistry.register('s3', S3StoragePlugin as never);

import { ROUTES } from './router/routes.js';
import { createRouter } from './router/dispatch.js';
import { expressAdapter } from './local-adapter.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(originMiddleware);

// Disable ETag for attachment downloads to prevent 304 responses
app.set('etag', false);

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});


// ============================================================================
// Multipart uploads arrive as raw bytes; the handler parses the base64 body.
// ============================================================================

app.post('/pages/:guid/attachments', express.raw({ type: () => true, limit: '60mb' }));

// ============================================================================
// Health Check (local only)
// ============================================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: 'local-development',
  });
});

// ============================================================================
// API: every route goes through the shared route table (src/router/routes.ts),
// exactly as in production. Locally it also serves the routes that have their
// own Lambda in production (MCP, fetch-url, the 5-minute jobs). The router
// answers unknown routes with 404 / 405.
// ============================================================================

app.use(expressAdapter(createRouter(ROUTES)));

// ============================================================================
// Error Handler
// ============================================================================

app.use((err: Error, _req: Request, res: Response) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ============================================================================
// Start Server
// ============================================================================

// Initialize storage plugin before starting server
async function startServer() {
  try {
    const bucketName = process.env.S3_PAGES_BUCKET || 'bluefinwiki-pages-local';
    
    // Initialize S3 storage plugin
    await initializeStoragePlugin({
      type: 's3',
      bucketName,
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
    });
    console.log('✅ Storage plugin initialized');
    
    // Create S3 bucket if it doesn't exist (for LocalStack)
    try {
      const { S3Client, HeadBucketCommand, CreateBucketCommand, PutBucketCorsCommand } = await import('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
        },
      });
      
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log(`✅ S3 bucket '${bucketName}' already exists`);
      } catch (error) {
        // Bucket doesn't exist, create it
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`✅ Created S3 bucket '${bucketName}'`);
      }

      // Configure CORS on the bucket for presigned URL uploads
      await s3Client.send(new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
              AllowedOrigins: ['*'],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }));
      console.log(`✅ S3 bucket CORS configured for presigned uploads`);
    } catch (error) {
      console.warn('⚠️  Could not verify/create S3 bucket:', error);
    }

    // Create DynamoDB tables if they don't exist (for LocalStack)
    try {
      const {
        DynamoDBClient,
        ListTablesCommand,
        CreateTableCommand,
      } = await import('@aws-sdk/client-dynamodb');
      type CreateTableInput = ConstructorParameters<typeof CreateTableCommand>[0];
      const dynamoClient = new DynamoDBClient({
        region: process.env.AWS_REGION || 'us-east-1',
        endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
        },
      });

      const tableDefinitions: CreateTableInput[] = [
        {
          TableName: process.env.USER_PROFILES_TABLE || 'bluefinwiki-user-profiles-local',
          KeySchema: [{ AttributeName: 'cognitoUserId', KeyType: 'HASH' }],
          AttributeDefinitions: [
            { AttributeName: 'cognitoUserId', AttributeType: 'S' },
            { AttributeName: 'email', AttributeType: 'S' },
          ],
          GlobalSecondaryIndexes: [{
            IndexName: 'email-index',
            KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
          }],
          BillingMode: 'PAY_PER_REQUEST',
        },
        {
          TableName: process.env.DYNAMODB_INVITATIONS_TABLE || 'bluefinwiki-invitations-local',
          KeySchema: [{ AttributeName: 'inviteCode', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'inviteCode', AttributeType: 'S' }],
          BillingMode: 'PAY_PER_REQUEST',
        },
        {
          TableName: process.env.DYNAMODB_PAGE_LINKS_TABLE || 'bluefinwiki-page-links-local',
          KeySchema: [
            { AttributeName: 'sourceGuid', KeyType: 'HASH' },
            { AttributeName: 'targetGuid', KeyType: 'RANGE' },
          ],
          AttributeDefinitions: [
            { AttributeName: 'sourceGuid', AttributeType: 'S' },
            { AttributeName: 'targetGuid', AttributeType: 'S' },
          ],
          GlobalSecondaryIndexes: [{
            IndexName: 'targetGuid-index',
            KeySchema: [{ AttributeName: 'targetGuid', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
          }],
          BillingMode: 'PAY_PER_REQUEST',
        },
        {
          TableName: 'bluefinwiki-attachments-local',
          KeySchema: [{ AttributeName: 'guid', KeyType: 'HASH' }],
          AttributeDefinitions: [
            { AttributeName: 'guid', AttributeType: 'S' },
            { AttributeName: 'pageGuid', AttributeType: 'S' },
            { AttributeName: 'uploadedAt', AttributeType: 'S' },
          ],
          GlobalSecondaryIndexes: [{
            IndexName: 'pageGuid-index',
            KeySchema: [
              { AttributeName: 'pageGuid', KeyType: 'HASH' },
              { AttributeName: 'uploadedAt', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          }],
          BillingMode: 'PAY_PER_REQUEST',
        },
        {
          TableName: process.env.DYNAMODB_COMMENTS_TABLE || 'bluefinwiki-comments-local',
          KeySchema: [{ AttributeName: 'guid', KeyType: 'HASH' }],
          AttributeDefinitions: [
            { AttributeName: 'guid', AttributeType: 'S' },
            { AttributeName: 'pageGuid', AttributeType: 'S' },
            { AttributeName: 'createdAt', AttributeType: 'S' },
          ],
          GlobalSecondaryIndexes: [{
            IndexName: 'pageGuid-createdAt-index',
            KeySchema: [
              { AttributeName: 'pageGuid', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          }],
          BillingMode: 'PAY_PER_REQUEST',
        },
        {
          TableName: process.env.DYNAMODB_ACTIVITY_LOG_TABLE || 'bluefinwiki-activity-log-local',
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
        {
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
        {
          TableName: process.env.DYNAMODB_PAGE_INDEX_TABLE || 'bluefinwiki-page-index-local',
          KeySchema: [{ AttributeName: 'guid', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'guid', AttributeType: 'S' }],
          BillingMode: 'PAY_PER_REQUEST',
        },
        {
          TableName: process.env.DYNAMODB_TICKET_KEYS_TABLE || 'bluefinwiki-ticket-keys-local',
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
          BillingMode: 'PAY_PER_REQUEST',
        },
        {
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
        {
          TableName: process.env.DYNAMODB_SITE_CONFIG_TABLE || 'bluefinwiki-site-config-local',
          KeySchema: [{ AttributeName: 'configKey', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'configKey', AttributeType: 'S' }],
          BillingMode: 'PAY_PER_REQUEST',
        },
        {
          TableName: process.env.DYNAMODB_PAGE_TYPES_TABLE || 'bluefinwiki-page-types-local',
          KeySchema: [{ AttributeName: 'guid', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'guid', AttributeType: 'S' }],
          BillingMode: 'PAY_PER_REQUEST',
        },
      ];

      const { TableNames } = await dynamoClient.send(new ListTablesCommand({}));
      const existingTables = new Set(TableNames || []);

      for (const tableDef of tableDefinitions) {
        const name = tableDef.TableName!;
        if (!existingTables.has(name)) {
          await dynamoClient.send(new CreateTableCommand(tableDef));
          console.log(`✅ Created DynamoDB table '${name}'`);
        } else {
          console.log(`✅ DynamoDB table '${name}' already exists`);
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not verify/create DynamoDB tables:', error);
    }

    const server = http.createServer(app);
    attachRealtime(server);
    server.listen(PORT, () => {
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║  BlueFinWiki Local Development Server                       ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🌍 CORS enabled for: all origins (development mode)`);
      console.log(`☁️  AWS Endpoint: ${process.env.AWS_ENDPOINT_URL || 'http://localhost:4566'}`);
      console.log(`🔐 Cognito Endpoint: ${process.env.COGNITO_ENDPOINT || 'http://localhost:9229'}`);
      console.log('');
      console.log('📋 Available Routes:');
      console.log('   GET    /health');
      console.log('   WS     /ws');
      for (const route of ROUTES) console.log(`   ${route.method.padEnd(6)} ${route.pattern}`);
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('════════════════════════════════════════════════════════════════');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
