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
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { initializeStoragePlugin, StoragePluginRegistry } from './storage/index.js';
import { S3StoragePlugin } from './storage/S3StoragePlugin.js';

// Register storage plugins
StoragePluginRegistry.register('s3', S3StoragePlugin as never);

// Import Lambda handlers
import { handler as pagesCreate } from './pages/pages-create.js';
import { handler as pagesGet } from './pages/pages-get.js';
import { handler as pagesUpdate } from './pages/pages-update.js';
import { handler as pagesDelete } from './pages/pages-delete.js';
import { handler as pagesListChildren } from './pages/pages-list-children.js';
import { handler as pagesMove } from './pages/pages-move.js';
import { handler as pagesSearch } from './pages/pages-search.js';
import { handler as pagesBacklinks } from './pages/pages-backlinks.js';
import {
  pagesAttachmentsUpload,
  pagesAttachmentsDownload,
  pagesAttachmentsList,
  pagesAttachmentsDelete,
  pagesAttachmentsPresign,
  pagesAttachmentsConfirm,
} from './pages/index.js';
import { handler as linksResolve } from './pages/links-resolve.js';
import { handler as authRegister } from './auth/auth-register.js';
import { handler as authMe } from './auth/auth-me.js';
import { handler as adminCreateInvitation } from './auth/admin-create-invitation.js';
import { handler as adminListInvitations } from './auth/admin-list-invitations.js';
import { handler as adminRevokeInvitation } from './auth/admin-revoke-invitation.js';
import { buildSearchIndexData } from './search/search-build-index.js';
import { handler as tagsList } from './tags/tags-list.js';
import { handler as tagsCreate } from './tags/tags-create.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Disable ETag for attachment downloads to prevent 304 responses
app.set('etag', false);

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Convert Express request to Lambda APIGatewayProxyEvent
 */
function toLambdaEvent(req: Request): APIGatewayProxyEvent {
  const headers: { [key: string]: string } = {};
  Object.entries(req.headers).forEach(([key, value]) => {
    if (typeof value === 'string') {
      headers[key] = value;
    } else if (Array.isArray(value)) {
      headers[key] = value[0];
    }
  });

  const event: APIGatewayProxyEvent = {
    body: req.body
      ? Buffer.isBuffer(req.body)
        ? req.body.toString('base64')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body)
      : null,
    headers,
    multiValueHeaders: {},
    httpMethod: req.method,
    isBase64Encoded: Buffer.isBuffer(req.body),
    path: req.path,
    pathParameters: req.params as { [name: string]: string } | null,
    queryStringParameters: req.query as { [name: string]: string } | null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      protocol: 'HTTP/1.1',
      httpMethod: req.method,
      path: req.path,
      stage: 'local',
      requestId: `local-${Date.now()}`,
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
      resourceId: 'local',
      resourcePath: req.path,
      authorizer: undefined,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: headers['x-cognito-authentication-provider'] || null,
        cognitoAuthenticationType: headers['x-cognito-authentication-type'] || null,
        cognitoIdentityId: headers['x-cognito-identity-id'] || null,
        cognitoIdentityPoolId: headers['x-cognito-identity-pool-id'] || null,
        principalOrgId: null,
        sourceIp: req.ip || '127.0.0.1',
        user: null,
        userAgent: req.get('user-agent') || null,
        userArn: null,
      },
    },
    resource: req.path,
  };

  return event;
}

/**
 * Mock Lambda context
 */
const lambdaContext: Context = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'local-dev',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:local:123456789012:function:local-dev',
  memoryLimitInMB: '1024',
  awsRequestId: 'local-request-id',
  logGroupName: '/aws/lambda/local-dev',
  logStreamName: 'local-stream',
  getRemainingTimeInMillis: () => 300000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

/**
 * Wrap Lambda handler for Express
 */
function wrapLambdaHandler(handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>) {
  return async (req: Request, res: Response) => {
    try {
      const event = toLambdaEvent(req);
      const result = await handler(event, lambdaContext);

      // Set response headers
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, String(value));
        });
      }

      // Ensure Content-Type is set for attachment downloads
      if (req.path.includes('/attachments/') && req.method === 'GET') {
        const contentType = res.getHeader('Content-Type');
        if (!contentType) {
          res.setHeader('Content-Type', 'application/octet-stream');
        }
      }

      // Send response
      const body = result.isBase64Encoded 
        ? Buffer.from(result.body || '', 'base64')
        : result.body;

      res.status(result.statusCode).send(body);
    } catch (error) {
      console.error('Lambda handler error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

// ============================================================================
// API Routes - Pages
// ============================================================================

app.post('/pages', wrapLambdaHandler(pagesCreate));
app.get('/pages/children', wrapLambdaHandler(pagesListChildren)); // Root-level pages
app.get('/pages/root/children', wrapLambdaHandler(pagesListChildren)); // Root-level pages alias
app.get('/pages/:guid', wrapLambdaHandler(pagesGet));
app.put('/pages/:guid', wrapLambdaHandler(pagesUpdate));
app.delete('/pages/:guid', wrapLambdaHandler(pagesDelete));
app.get('/pages/:guid/children', wrapLambdaHandler(pagesListChildren));
app.post('/pages/:guid/move', wrapLambdaHandler(pagesMove));
app.get('/pages/:guid/backlinks', wrapLambdaHandler(pagesBacklinks));
app.get('/search', wrapLambdaHandler(pagesSearch));
app.post('/pages/links/resolve', wrapLambdaHandler(linksResolve));
app.post('/pages/:pageGuid/attachments/presign', wrapLambdaHandler(pagesAttachmentsPresign));
app.post('/pages/:pageGuid/attachments/confirm', wrapLambdaHandler(pagesAttachmentsConfirm));
app.post(
  '/pages/:pageGuid/attachments',
  express.raw({ type: () => true, limit: '60mb' }),
  wrapLambdaHandler(pagesAttachmentsUpload)
);
app.get('/pages/:pageGuid/attachments', wrapLambdaHandler(pagesAttachmentsList));
app.get('/pages/:pageGuid/attachments/:filename', wrapLambdaHandler(pagesAttachmentsDownload));
app.delete('/pages/:pageGuid/attachments/:filename', wrapLambdaHandler(pagesAttachmentsDelete));

// ============================================================================
// API Routes - Authentication
// ============================================================================

app.post('/auth/register', wrapLambdaHandler(authRegister));
app.get('/auth/me', wrapLambdaHandler(authMe));

// ============================================================================
// API Routes - Admin
// ============================================================================

app.post('/admin/invitations', wrapLambdaHandler(adminCreateInvitation));
app.get('/admin/invitations', wrapLambdaHandler(adminListInvitations));
app.delete('/admin/invitations/:invitationCode', wrapLambdaHandler(adminRevokeInvitation));

// ============================================================================
// API Routes - Tags
// ============================================================================

app.get('/tags', wrapLambdaHandler(tagsList));
app.post('/tags', wrapLambdaHandler(tagsCreate));

// ============================================================================
// API Routes - Search Index
// ============================================================================

app.get('/api/search-index.json', ((_req, res) => {
  buildSearchIndexData()
    .then(searchIndex => res.json(searchIndex))
    .catch(error => {
      console.error('Failed to build search index:', error);
      res.status(500).json({
        error: 'Failed to build search index',
        message: error instanceof Error ? error.message : String(error),
      });
    });
}));

// ============================================================================
// Admin: Rebuild Page Index
// ============================================================================

app.post('/admin/rebuild-page-index', async (_req, res) => {
  try {
    const { rebuildPageIndex } = await import('./storage/rebuild-page-index.js');
    const result = await rebuildPageIndex();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: 'local-development',
  });
});

// ============================================================================
// 404 Handler
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

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
          TableName: process.env.DYNAMODB_USERS_TABLE || 'bluefinwiki-users-local',
          KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
          AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' },
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

    app.listen(PORT, () => {
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
      console.log('   POST   /pages');
  console.log('   GET    /pages/:guid');
  console.log('   PUT    /pages/:guid');
  console.log('   DELETE /pages/:guid');
  console.log('   GET    /pages/:guid/children');
  console.log('   POST   /pages/:guid/move');
  console.log('   GET    /pages/:guid/backlinks');
  console.log('   GET    /search');
  console.log('   GET    /api/search-index.json');
  console.log('   POST   /pages/links/resolve');
  console.log('   POST   /auth/register');
  console.log('   GET    /auth/me');
  console.log('   POST   /admin/invitations');
  console.log('   GET    /admin/invitations');
  console.log('   DELETE /admin/invitations/:invitationCode');
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
