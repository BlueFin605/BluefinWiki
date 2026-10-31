/**
 * Local dev only: turns Express requests into API Gateway proxy events and Lambda results
 * back into Express responses. bundle.mjs fails the build if this reaches a Lambda.
 */
import type { Request, Response } from 'express';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import type { LambdaHandler } from './router/types.js';

export function toLambdaEvent(req: Request): APIGatewayProxyEvent {
  const headers: { [key: string]: string } = {};
  Object.entries(req.headers).forEach(([key, value]) => {
    if (typeof value === 'string') headers[key] = value;
    else if (Array.isArray(value)) headers[key] = value[0];
  });
  return {
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
    pathParameters: null, // the router fills these from the route table
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
}

export const lambdaContext: Context = {
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

export function expressAdapter(handler: LambdaHandler) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await handler(toLambdaEvent(req), lambdaContext);
      for (const [key, value] of Object.entries(result.headers ?? {})) res.setHeader(key, String(value));
      // Ensure Content-Type is set for attachment downloads
      if (req.path.includes('/attachments/') && req.method === 'GET' && !res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const body = result.isBase64Encoded ? Buffer.from(result.body || '', 'base64') : result.body;
      res.status(result.statusCode).send(body);
    } catch (error) {
      console.error('Lambda handler error:', error);
      res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  };
}
