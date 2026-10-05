import type { APIGatewayProxyResultV2 } from 'aws-lambda';

/**
 * API Gateway WebSocket `$default`: client pings (`{"type":"ping"}`) land
 * here and only exist to keep the connection under the idle timeout.
 */
export async function handler(): Promise<APIGatewayProxyResultV2> {
  return { statusCode: 200 };
}
