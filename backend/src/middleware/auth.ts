import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Environment variables
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || process.env.CLIENT_ID!;
const IS_LOCAL = process.env.NODE_ENV === 'development' || USER_POOL_ID?.startsWith('local_');

// Create JWT verifier instance (reused across invocations) - skip for local development
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
if (!IS_LOCAL) {
  verifier = CognitoJwtVerifier.create({
    userPoolId: USER_POOL_ID,
    tokenUse: 'id',
    clientId: CLIENT_ID,
  });
}

// Extend the APIGatewayProxyEvent to include user context
export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  requestContext: APIGatewayProxyEvent['requestContext'] & {
    authorizer?: {
      claims: {
        sub: string;
        email: string;
        'custom:role': string;
        'custom:displayName': string;
        'custom:status'?: string;
        'custom:preferences'?: string;
        [key: string]: string | undefined;
      };
    };
  };
}

export interface UserContext {
  userId: string; // Cognito sub
  email: string;
  role: 'Admin' | 'Standard';
  displayName: string;
  status?: string;
  preferences?: {
    theme?: 'light' | 'dark';
    emailNotifications?: boolean;
  };
}

/**
 * JWT validation middleware for Lambda functions
 * 
 * Usage:
 * ```typescript
 * export const handler = withAuth(async (event: AuthenticatedEvent, context: Context) => {
 *   const user = getUserContext(event);
 *   // ... your handler logic
 * });
 * ```
 */
export function withAuth(
  handler: (event: AuthenticatedEvent, context: Context) => Promise<APIGatewayProxyResult>
) {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
      // In production, API Gateway's Cognito authorizer has already validated the
      // token and placed claims in event.requestContext.authorizer.claims.
      // Use those directly instead of re-verifying.
      const existingClaims = event.requestContext.authorizer?.claims;
      if (existingClaims && !IS_LOCAL) {
        const authenticatedEvent = event as AuthenticatedEvent;
        const handlerResponse = await handler(authenticatedEvent, context);
        return withCorsHeaders(event, handlerResponse);
      }

      // For local development (no API Gateway authorizer), verify the token ourselves
      const token = extractToken(event);

      if (!token) {
        return withCorsHeaders(event, {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing authorization token' }),
        });
      }

      let payload;
      try {
        if (IS_LOCAL) {
          console.log('🔓 Local mode: Bypassing JWT verification');
          if (token === 'mock-jwt-token') {
            payload = {
              sub: 'local-dev-user-id',
              email: 'dev@example.com',
              'cognito:username': 'dev@example.com',
              'custom:role': 'Admin',
              'custom:displayName': 'Local Dev User',
            };
          } else {
            payload = decodeJWT(token);
          }
        } else {
          // Fallback: verify token if no API Gateway claims present
          if (!verifier) {
            throw new Error('Cognito verifier not initialized');
          }
          payload = await verifier.verify(token);
        }
      } catch (error) {
        console.error('JWT verification failed:', error);
        return withCorsHeaders(event, {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid or expired token' }),
        });
      }

      // Attach user context to event
      const authenticatedEvent = event as AuthenticatedEvent;
      authenticatedEvent.requestContext.authorizer = {
        claims: payload as unknown as NonNullable<AuthenticatedEvent['requestContext']['authorizer']>['claims'],
      };

      // Call the wrapped handler with authenticated event
      const handlerResponse = await handler(authenticatedEvent, context);
      return withCorsHeaders(event, handlerResponse);
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return withCorsHeaders(event, {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    }
  };
}

/**
 * Role-based authorization middleware
 * 
 * Usage:
 * ```typescript
 * export const handler = withAuth(
 *   withRole(['Admin'], async (event: AuthenticatedEvent) => {
 *     // Only admins can access this
 *   })
 * );
 * ```
 */
export function withRole(
  allowedRoles: Array<'Admin' | 'Standard'>,
  handler: (event: AuthenticatedEvent, context: Context) => Promise<APIGatewayProxyResult>
) {
  return async (event: AuthenticatedEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const user = getUserContext(event);

    if (!allowedRoles.includes(user.role)) {
      return withCorsHeaders(event, {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Forbidden',
          message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        }),
      });
    }

    const handlerResponse = await handler(event, context);
    return withCorsHeaders(event, handlerResponse);
  };
}

function withCorsHeaders(
  event: Pick<APIGatewayProxyEvent, 'headers'>,
  response: APIGatewayProxyResult
): APIGatewayProxyResult {
  const requestOrigin = event.headers?.origin || event.headers?.Origin;
  const allowOrigin = requestOrigin && requestOrigin.length > 0 ? requestOrigin : '*';

  return {
    ...response,
    headers: {
      ...response.headers,
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Vary': 'Origin',
    },
  };
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(event: APIGatewayProxyEvent): string | null {
  const authHeader = event.headers['Authorization'] || event.headers['authorization'];

  if (!authHeader) {
    return null;
  }

  // Handle "Bearer <token>" format
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    return match[1];
  }

  // Handle direct token (no "Bearer" prefix)
  return authHeader;
}

/**
 * Extract user context from authenticated event
 */
export function getUserContext(event: AuthenticatedEvent): UserContext {
  const claims = event.requestContext.authorizer?.claims;

  if (!claims) {
    throw new Error('User context not found - ensure withAuth middleware is applied');
  }

  const preferences = claims['custom:preferences']
    ? JSON.parse(claims['custom:preferences'])
    : undefined;

  return {
    userId: claims.sub,
    email: claims.email,
    role: claims['custom:role'] as 'Admin' | 'Standard',
    displayName: claims['custom:displayName'],
    status: claims['custom:status'],
    preferences,
  };
}

/**
 * Check if user is admin
 */
export function isAdmin(event: AuthenticatedEvent): boolean {
  const user = getUserContext(event);
  return user.role === 'Admin';
}

/**
 * Check if user has permission to perform action on resource
 * 
 * Rules:
 * - Admins can do anything
 * - Standard users can only modify their own resources
 */
export function hasPermission(
  event: AuthenticatedEvent,
  resourceOwnerId?: string
): boolean {
  const user = getUserContext(event);

  // Admins have permission for everything
  if (user.role === 'Admin') {
    return true;
  }

  // If no resource owner specified, standard users don't have permission
  if (!resourceOwnerId) {
    return false;
  }

  // Standard users can only access their own resources
  return user.userId === resourceOwnerId;
}

/**
 * Decode JWT without verification (for local development only)
 * This should NEVER be used in production!
 */
function decodeJWT(token: string): { sub: string; username?: string; 'cognito:username'?: string; 'cognito:groups'?: string[] } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    // Decode the payload (second part)
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    throw new Error('Invalid JWT token');
  }
}
