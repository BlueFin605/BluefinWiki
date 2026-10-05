import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, UpdateItemCommand, PutItemCommand, GetItemCommand, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

const dynamoMock = mockClient(DynamoDBClient);

import { allocateNumber, putMapping, getMapping } from '../ticket-keys-store.js';

describe('ticket-keys-store', () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TICKET_KEYS_TABLE = 'test-ticket-keys';
  });

  it('atomically increments the prefix counter and returns the new value', async () => {
    dynamoMock.on(UpdateItemCommand).resolves({ Attributes: { next: { N: '13' } } });
    expect(await allocateNumber('BGT')).toBe(13);
    const input = dynamoMock.commandCalls(UpdateItemCommand)[0].args[0].input;
    expect(input.TableName).toBe('test-ticket-keys');
    expect(input.Key).toEqual({ id: { S: 'seq#BGT' } });
    expect(input.UpdateExpression).toBe('ADD #next :one');
    expect(input.ExpressionAttributeNames).toEqual({ '#next': 'next' });
    expect(input.ExpressionAttributeValues).toEqual({ ':one': { N: '1' } });
    expect(input.ReturnValues).toBe('UPDATED_NEW');
  });

  it('writes key#KEY with a not-exists condition', async () => {
    dynamoMock.on(PutItemCommand).resolves({});
    expect(await putMapping('BGT-1', 'g1')).toBe('created');
    const input = dynamoMock.commandCalls(PutItemCommand)[0].args[0].input;
    expect(input.Item!.id).toEqual({ S: 'key#BGT-1' });
    expect(input.Item!.guid).toEqual({ S: 'g1' });
    expect(input.Item!.createdAt.S).toMatch(/^\d{4}-/);
    expect(input.ConditionExpression).toBe('attribute_not_exists(id)');
  });

  it('treats an existing mapping to the same guid as success', async () => {
    dynamoMock.on(PutItemCommand).rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    dynamoMock.on(GetItemCommand).resolves({ Item: { id: { S: 'key#BGT-1' }, guid: { S: 'g1' } } });
    expect(await putMapping('BGT-1', 'g1')).toBe('exists');
  });

  it('throws when the key already maps to another guid', async () => {
    dynamoMock.on(PutItemCommand).rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    dynamoMock.on(GetItemCommand).resolves({ Item: { id: { S: 'key#BGT-1' }, guid: { S: 'other' } } });
    await expect(putMapping('BGT-1', 'g1')).rejects.toThrow('BGT-1 already maps to other');
  });

  it('returns the mapped guid or null', async () => {
    dynamoMock.on(GetItemCommand).resolvesOnce({ Item: { guid: { S: 'g1' } } }).resolvesOnce({});
    expect(await getMapping('BGT-1')).toBe('g1');
    expect(await getMapping('BGT-2')).toBeNull();
  });
});
