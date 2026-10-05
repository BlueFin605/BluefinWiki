import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { verifyIdToken } from '../middleware/auth.js';
import type { WebSocketEvent } from './ws-event.js';

const db = new DynamoDBClient({});
const CONNECTION_TTL_SECONDS = 24 * 60 * 60;

/**
 * API Gateway WebSocket `$connect`: browsers can't set headers on a
 * WebSocket, so the Cognito ID token arrives as `?token=`. A valid token
 * records `{ connectionId, userId, expiresAt }` (DynamoDB TTL cleans up
 * rows whose `$disconnect` never fired); anything else is refused with 401.
 */
export async function handler(event: WebSocketEvent): Promise<APIGatewayProxyResultV2> {
  const token = event.queryStringParameters?.token;
  if (!token) return { statusCode: 401 };

  let userId: string;
  try {
    userId = (await verifyIdToken(token)).sub;
  } catch (err) {
    console.warn('realtime connect rejected', err instanceof Error ? err.message : err);
    return { statusCode: 401 };
  }

  const expiresAt = Math.floor(Date.now() / 1000) + CONNECTION_TTL_SECONDS;
  await db.send(
    new PutItemCommand({
      TableName: process.env.REALTIME_CONNECTIONS_TABLE,
      Item: {
        connectionId: { S: event.requestContext.connectionId },
        userId: { S: userId },
        expiresAt: { N: String(expiresAt) },
      },
    }),
  );
  return { statusCode: 200 };
}
