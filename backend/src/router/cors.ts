import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/** Same headers as withCorsHeaders in middleware/auth.ts, for responses the router makes itself. */
export function withRouterCors(
  event: Pick<APIGatewayProxyEvent, 'headers'>,
  response: APIGatewayProxyResult,
): APIGatewayProxyResult {
  const origin = event.headers?.origin || event.headers?.Origin;
  return {
    ...response,
    headers: {
      ...response.headers,
      'Access-Control-Allow-Origin': origin && origin.length > 0 ? origin : '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Access-Token,X-Client-Id',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      Vary: 'Origin',
    },
  };
}
