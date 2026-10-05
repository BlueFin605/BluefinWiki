import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';

/**
 * The WebSocket route event. `$connect` also carries the query string, which
 * the aws-lambda typings leave off APIGatewayProxyWebsocketEventV2.
 */
export type WebSocketEvent = APIGatewayProxyWebsocketEventV2 & {
  queryStringParameters?: Record<string, string | undefined> | null;
};
