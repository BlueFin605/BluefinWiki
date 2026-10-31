import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export type LambdaHandler = (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * One API route. 'router' routes run inside the api-router Lambda; 'own-function'
 * routes keep their own Lambda in UnifiedStack.cs (API Gateway sends them there
 * directly) and are listed so local dev and the CDK parity test see them.
 */
export interface RouteDef {
  method: HttpMethod;
  /** API Gateway style, e.g. '/pages/{guid}/attachments/{attachmentGuid}'. */
  pattern: string;
  deployment: 'router' | 'own-function';
  load: () => Promise<LambdaHandler>;
  /** Extra pathParameters copied from a matched param, e.g. { invitationCode: 'code' }. */
  paramAliases?: Record<string, string>;
}

export type MatchResult =
  | { kind: 'match'; route: RouteDef; params: Record<string, string> }
  | { kind: 'not-found' }
  | { kind: 'method-not-allowed'; allowed: HttpMethod[] };
