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

// Import Lambda handlers
import { handler as pagesCreate } from './pages/pages-create.js';
import { handler as pagesGet } from './pages/pages-get.js';
import { handler as pagesUpdate } from './pages/pages-update.js';
import { handler as pagesDelete } from './pages/pages-delete.js';
import { handler as pagesListChildren } from './pages/pages-list-children.js';
import { handler as pagesMove } from './pages/pages-move.js';
import { handler as pagesSearch } from './pages/pages-search.js';
import { handler as pagesBacklinks } from './pages/pages-backlinks.js';
import { handler as linksResolve } from './pages/links-resolve.js';
import { handler as authRegister } from './auth/auth-register.js';
import { handler as authMe } from './auth/auth-me.js';
import { handler as adminCreateInvitation } from './auth/admin-create-invitation.js';
import { handler as adminListInvitations } from './auth/admin-list-invitations.js';
import { handler as adminRevokeInvitation } from './auth/admin-revoke-invitation.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
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
    body: req.body ? JSON.stringify(req.body) : null,
    headers,
    multiValueHeaders: {},
    httpMethod: req.method,
    isBase64Encoded: false,
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
app.get('/pages/:guid', wrapLambdaHandler(pagesGet));
app.put('/pages/:guid', wrapLambdaHandler(pagesUpdate));
app.delete('/pages/:guid', wrapLambdaHandler(pagesDelete));
app.get('/pages/:guid/children', wrapLambdaHandler(pagesListChildren));
app.post('/pages/:guid/move', wrapLambdaHandler(pagesMove));
app.get('/pages/:guid/backlinks', wrapLambdaHandler(pagesBacklinks));
app.get('/search', wrapLambdaHandler(pagesSearch));
app.post('/pages/links/resolve', wrapLambdaHandler(linksResolve));

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
// Health Check
// ============================================================================

app.get('/health', (req, res) => {
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

app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  BlueFinWiki Local Development Server                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌍 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
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
