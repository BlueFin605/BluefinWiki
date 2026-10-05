import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import type { WebSocketEvent } from './ws-event.js';

const db = new DynamoDBClient({});

/** API Gateway WebSocket `$disconnect`: forget the connection. */
export async function handler(event: WebSocketEvent): Promise<APIGatewayProxyResultV2> {
  await db.send(
    new DeleteItemCommand({
      TableName: process.env.REALTIME_CONNECTIONS_TABLE,
      Key: { connectionId: { S: event.requestContext.connectionId } },
    }),
  );
  return { statusCode: 200 };
}
