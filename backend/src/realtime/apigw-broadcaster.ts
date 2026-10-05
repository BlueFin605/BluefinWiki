import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import type { Broadcaster, RealtimeEvent } from './broadcaster.js';

/**
 * Deployed broadcaster: fans an event out to every connection recorded by
 * `ws-connect`. Gone connections are pruned; other per-connection failures
 * are logged and the row kept. Scan failures reject, and publishChange
 * swallows them (and trips its circuit breaker).
 */
export class ApiGwBroadcaster implements Broadcaster {
  private readonly api: ApiGatewayManagementApiClient;
  private readonly db = new DynamoDBClient({});

  constructor(endpoint: string, private readonly table: string) {
    this.api = new ApiGatewayManagementApiClient({ endpoint });
  }

  async publish(event: RealtimeEvent): Promise<void> {
    const { Items = [] } = await this.db.send(
      new ScanCommand({ TableName: this.table, ProjectionExpression: 'connectionId' }),
    );
    const data = Buffer.from(JSON.stringify(event));
    await Promise.all(
      Items.map(async (item) => {
        const connectionId = item.connectionId?.S;
        if (!connectionId) return;
        try {
          await this.api.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }));
        } catch (err) {
          if (err instanceof GoneException || (err as { name?: string }).name === 'GoneException') {
            await this.db
              .send(new DeleteItemCommand({ TableName: this.table, Key: { connectionId: { S: connectionId } } }))
              .catch(() => {});
          } else {
            console.warn('realtime post failed', connectionId, err);
          }
        }
      }),
    );
  }
}
