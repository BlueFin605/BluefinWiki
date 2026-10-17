import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { validateToolArgs, type ToolSchema } from '../validate-args.js';
import { handler } from '../mcp-handler.js';

const tool: ToolSchema = {
  name: 't',
  inputSchema: {
    properties: {
      pageGuid: { type: 'string' },
      parent: { type: ['string', 'null'] },
      flag: { type: 'boolean' },
      state: { type: 'string', enum: ['Ready', 'Done'] },
    },
    required: ['pageGuid'],
  },
};

describe('validateToolArgs', () => {
  it('accepts valid args', () => {
    expect(validateToolArgs(tool, { pageGuid: 'abc', flag: true, parent: null })).toBeUndefined();
  });
  it('names the missing argument for empty, undefined and null args', () => {
    for (const a of [{}, undefined, null]) {
      expect(validateToolArgs(tool, a)).toBe('Missing required argument: pageGuid');
    }
  });
  it('rejects blank required strings', () => {
    expect(validateToolArgs(tool, { pageGuid: '  ' })).toMatch(/pageGuid/);
  });
  it('rejects wrong types and enum values', () => {
    expect(validateToolArgs(tool, { pageGuid: 5 })).toMatch(/"pageGuid".*string.*number/);
    expect(validateToolArgs(tool, { pageGuid: 'a', flag: 'yes' })).toMatch(/"flag"/);
    expect(validateToolArgs(tool, { pageGuid: 'a', state: 'Nope' })).toMatch(/one of Ready, Done/);
  });
  it('rejects non-object args', () => {
    expect(validateToolArgs(tool, [])).toMatch(/expected an object/);
  });
  it('allows null for required nullable props', () => {
    const t: ToolSchema = { name: 'm', inputSchema: { properties: { p: { type: ['string', 'null'] } }, required: ['p'] } };
    expect(validateToolArgs(t, { p: null })).toBeUndefined();
    expect(validateToolArgs(t, {})).toMatch(/p/);
  });
});

function call(name: string, args?: unknown) {
  const event = {
    httpMethod: 'POST',
    path: '/mcp',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, ...(args === undefined ? {} : { arguments: args }) } }),
  } as unknown as APIGatewayProxyEvent;
  return handler(event).then((r) => JSON.parse(r.body).result);
}

describe('mcp handler argument validation', () => {
  it.each([
    ['get_backlinks', 'pageGuid'],
    ['get_page', 's3Key'],
    ['search_pages', 'query'],
    ['update_page', 'pageGuid'],
    ['add_comment', 'pageGuid, body'],
    ['kanban_get', 'guid'],
    ['kanban_set_state', 'guid, state'],
  ])('%s with empty args is a readable validation error', async (name, missing) => {
    const result = await call(name, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(`Missing required argument${missing.includes(',') ? 's' : ''}: ${missing}`);
  });
  it('also handles omitted arguments', async () => {
    const result = await call('get_backlinks');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Missing required argument: pageGuid');
  });
});
