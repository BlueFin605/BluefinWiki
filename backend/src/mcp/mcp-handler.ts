/**
 * Lambda: mcp-handler
 *
 * MCP server endpoint for AI clients (Claude Desktop, Claude Code, GitHub Copilot).
 * Provides read/write access to wiki pages via Streamable HTTP protocol.
 *
 * Secured by API Gateway API key — no Cognito auth.
 * Seven tools: list_pages, get_page, search_pages, list_page_types, get_backlinks, create_page, update_page.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { listPages } from './tools/list-pages.js';
import { getPage } from './tools/get-page.js';
import { searchPages } from './tools/search-pages.js';
import { listPageTypes } from './tools/list-page-types.js';
import { getBacklinks } from './tools/get-backlinks.js';
import { updatePage, UpdatePageInput } from './tools/update-page.js';
import { createPage, CreatePageInput } from './tools/create-page.js';

const TOOLS = [
  {
    name: 'list_pages',
    description: 'Browse the wiki page hierarchy. Returns top-level pages when no prefix is given, or children of a specific page when a prefix is provided. Each result includes the page title, S3 key, and whether it has children.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prefix: {
          type: 'string',
          description: 'Parent page S3 path prefix (e.g. "abc-123" for root page children). Omit for top-level pages.',
        },
      },
    },
  },
  {
    name: 'get_page',
    description: 'Read the full content of a wiki page as raw markdown with YAML frontmatter. The frontmatter contains metadata (title, tags, status, properties, pageType). Only published pages are accessible.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        s3Key: {
          type: 'string',
          description: 'The S3 key of the page (e.g. "abc-123/abc-123.md"). Get this from list_pages or search_pages results.',
        },
      },
      required: ['s3Key'],
    },
  },
  {
    name: 'search_pages',
    description: 'Search for wiki pages by title or content. Returns matching pages with titles, S3 keys, and relevance scores. Use this to find pages when you don\'t know their location in the hierarchy.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query — matches against page titles, content, and tags',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_page_types',
    description: 'List all page type definitions with their property schemas. Page types define structured data on pages (e.g. a "TV Show" type might have rating, genre, and status properties). Use this to understand what structured properties exist before querying pages.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_backlinks',
    description: 'Find all pages that link to a given page. Returns the source page GUIDs and titles. The page GUID can be found in the YAML frontmatter of any page.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        pageGuid: {
          type: 'string',
          description: 'The GUID of the target page (from the "guid" field in page frontmatter)',
        },
      },
      required: ['pageGuid'],
    },
  },
  {
    name: 'create_page',
    description: 'Create a new wiki page. Returns the new page GUID, title, and creation timestamp. Use list_page_types to discover available page types and their property schemas before creating typed pages. Use list_pages to find the parentGuid if creating a child page.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Page title (1-200 characters)',
        },
        content: {
          type: 'string',
          description: 'Markdown content for the page body',
        },
        parentGuid: {
          type: ['string', 'null'],
          description: 'GUID of the parent page, or null/omit for a root-level page. Find parent GUIDs via list_pages or get_page.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for the page',
        },
        status: {
          type: 'string',
          enum: ['published', 'archived'],
          description: 'Page status (default: "published")',
        },
        pageType: {
          type: 'string',
          description: 'Page type GUID — use list_page_types to find available types',
        },
        properties: {
          type: 'object',
          description: 'Structured properties object. Each key is a property name (kebab-case), value is { type: "string"|"number"|"date"|"tags", value: ... }. Use list_page_types to see expected properties for a page type.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_page',
    description: 'Update an existing wiki page. Modify the title, markdown content, tags, status, page type, or structured properties. Only published pages can be updated. The page GUID is found in the YAML frontmatter returned by get_page. All fields except pageGuid are optional — only send the fields you want to change. Properties replace entirely (not merged).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        pageGuid: {
          type: 'string',
          description: 'The GUID of the page to update (from the "guid" field in page frontmatter)',
        },
        title: {
          type: 'string',
          description: 'New page title (1-200 characters)',
        },
        content: {
          type: 'string',
          description: 'New markdown content (replaces the entire body)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'New tags array (replaces all existing tags)',
        },
        status: {
          type: 'string',
          enum: ['published', 'archived'],
          description: 'Page status — "published" or "archived"',
        },
        pageType: {
          type: ['string', 'null'],
          description: 'Page type GUID to set, or null to remove the page type',
        },
        properties: {
          type: 'object',
          description: 'Structured properties object — replaces all existing properties. Each key is a property name (kebab-case), value is { type, value }.',
        },
      },
      required: ['pageGuid'],
    },
  },
];

/**
 * Create and configure an MCP server with all five tools registered.
 */
function createServer(): Server {
  const server = new Server(
    { name: 'bluefinwiki', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'list_pages': {
          const pages = await listPages((args as { prefix?: string }).prefix);
          return { content: [{ type: 'text', text: JSON.stringify(pages, null, 2) }] };
        }
        case 'get_page': {
          const content = await getPage((args as { s3Key: string }).s3Key);
          return { content: [{ type: 'text', text: content }] };
        }
        case 'search_pages': {
          const results = await searchPages((args as { query: string }).query);
          return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
        }
        case 'list_page_types': {
          const types = await listPageTypes();
          return { content: [{ type: 'text', text: JSON.stringify(types, null, 2) }] };
        }
        case 'get_backlinks': {
          const backlinks = await getBacklinks((args as { pageGuid: string }).pageGuid);
          return { content: [{ type: 'text', text: JSON.stringify(backlinks, null, 2) }] };
        }
        case 'create_page': {
          const result = await createPage(args as unknown as CreatePageInput);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'update_page': {
          const result = await updatePage(args as unknown as UpdatePageInput);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err: unknown) {
      return {
        content: [{ type: 'text', text: (err as Error).message }],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Convert an API Gateway v1 event to a Web Standard Request.
 */
function toWebRequest(event: APIGatewayProxyEvent): Request {
  const host = event.headers['Host'] || event.headers['host'] || 'localhost';
  const url = `https://${host}${event.path}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers)) {
    if (value) headers.set(key, value);
  }

  return new Request(url, {
    method: event.httpMethod,
    headers,
    body: event.body || undefined,
  });
}

/**
 * Convert a Web Standard Response to an API Gateway v1 result.
 */
async function toApiGatewayResult(response: Response): Promise<APIGatewayProxyResult> {
  const body = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    statusCode: response.status,
    headers,
    body,
  };
}

/**
 * Lambda handler — creates a fresh server + transport per invocation (stateless).
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const server = createServer();

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
      enableJsonResponse: true, // JSON responses, not SSE streams
    });

    await server.connect(transport);

    const request = toWebRequest(event);
    const response = await transport.handleRequest(request);
    const result = await toApiGatewayResult(response);

    await server.close();

    return result;
  } catch (err: unknown) {
    console.error('MCP handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'MCP server error' }),
    };
  }
};
