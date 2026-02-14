/**
 * Tests for pages-search Lambda function
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../pages-search.js';
import { S3StoragePlugin } from '../../storage/S3StoragePlugin.js';

// Mock the storage plugin
vi.mock('../../storage/index.js', () => ({
  getStoragePlugin: vi.fn(),
}));

const { getStoragePlugin } = await import('../../storage/index.js');

describe('pages-search', () => {
  let mockPlugin: S3StoragePlugin;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock plugin with test data
    mockPlugin = {
      buildPageTree: vi.fn(),
      getAncestors: vi.fn(),
      loadPage: vi.fn(),
    } as any;

    (getStoragePlugin as any).mockReturnValue(mockPlugin);
  });

  it('should return 400 if query parameter is missing', async () => {
    const event: APIGatewayProxyEvent = {
      queryStringParameters: null,
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('Missing required query parameter');
  });

  it('should return 400 if query parameter is empty', async () => {
    const event: APIGatewayProxyEvent = {
      queryStringParameters: { q: '' },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('Missing required query parameter');
  });

  it('should return empty results when no pages match', async () => {
    (mockPlugin.buildPageTree as any).mockResolvedValue([
      {
        guid: 'page-1',
        title: 'Completely Different Title',
        folderId: null,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        children: [],
      },
    ]);

    (mockPlugin.getAncestors as any).mockResolvedValue([]);
    (mockPlugin.loadPage as any).mockResolvedValue({
      guid: 'page-1',
      title: 'Completely Different Title',
      content: '',
      folderId: null,
    });

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { q: 'xyz' },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toEqual([]);
  });

  it('should return matching pages with exact match', async () => {
    (mockPlugin.buildPageTree as any).mockResolvedValue([
      {
        guid: 'page-1',
        title: 'Test Page',
        folderId: null,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        children: [],
      },
    ]);

    (mockPlugin.getAncestors as any).mockResolvedValue([]);
    (mockPlugin.loadPage as any).mockResolvedValue({
      guid: 'page-1',
      title: 'Test Page',
      content: '',
      folderId: null,
    });

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { q: 'Test Page' },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].guid).toBe('page-1');
    expect(body.results[0].title).toBe('Test Page');
    expect(body.results[0].path).toBe('Test Page');
  });

  it('should return matching pages with fuzzy search', async () => {
    (mockPlugin.buildPageTree as any).mockResolvedValue([
      {
        guid: 'page-1',
        title: 'Getting Started',
        folderId: null,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        children: [],
      },
    ]);

    (mockPlugin.getAncestors as any).mockResolvedValue([]);
    (mockPlugin.loadPage as any).mockResolvedValue({
      guid: 'page-1',
      title: 'Getting Started',
      content: '',
      folderId: null,
    });

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { q: 'gttstd' }, // Fuzzy match for "Getting Started"
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toBe('Getting Started');
  });

  it('should build hierarchical path for nested pages', async () => {
    (mockPlugin.buildPageTree as any).mockResolvedValue([
      {
        guid: 'parent-1',
        title: 'Parent',
        folderId: null,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        children: [
          {
            guid: 'child-1',
            title: 'Child Page',
            folderId: 'parent-1',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            children: [],
          },
        ],
      },
    ]);

    (mockPlugin.getAncestors as any).mockResolvedValue([
      { guid: 'parent-1', title: 'Parent', folderId: null },
    ]);
    
    (mockPlugin.loadPage as any).mockResolvedValue({
      guid: 'child-1',
      title: 'Child Page',
      content: '',
      folderId: 'parent-1',
    });

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { q: 'Child' },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toBe('Child Page');
    expect(body.results[0].path).toBe('Parent > Child Page');
  });

  it('should limit results to specified limit', async () => {
    const pages = Array.from({ length: 20 }, (_, i) => ({
      guid: `page-${i}`,
      title: `Test Page ${i}`,
      folderId: null,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      children: [],
    }));

    (mockPlugin.buildPageTree as any).mockResolvedValue(pages);
    (mockPlugin.getAncestors as any).mockResolvedValue([]);
    
    pages.forEach((page) => {
      (mockPlugin.loadPage as any).mockResolvedValueOnce({
        guid: page.guid,
        title: page.title,
        content: '',
        folderId: null,
      });
    });

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { q: 'Test', limit: '5' },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(5);
  });

  it('should enforce max limit of 50', async () => {
    const pages = Array.from({ length: 60 }, (_, i) => ({
      guid: `page-${i}`,
      title: `Test Page ${i}`,
      folderId: null,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      children: [],
    }));

    (mockPlugin.buildPageTree as any).mockResolvedValue(pages);
    (mockPlugin.getAncestors as any).mockResolvedValue([]);
    
    pages.forEach((page) => {
      (mockPlugin.loadPage as any).mockResolvedValueOnce({
        guid: page.guid,
        title: page.title,
        content: '',
        folderId: null,
      });
    });

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { q: 'Test', limit: '100' },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results.length).toBeLessThanOrEqual(50);
  });

  it('should sort results by relevance (exact match first)', async () => {
    (mockPlugin.buildPageTree as any).mockResolvedValue([
      {
        guid: 'page-1',
        title: 'Testing Guide',
        folderId: null,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        children: [],
      },
      {
        guid: 'page-2',
        title: 'Test',
        folderId: null,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        children: [],
      },
      {
        guid: 'page-3',
        title: 'Advanced Test Topics',
        folderId: null,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        children: [],
      },
    ]);

    (mockPlugin.getAncestors as any).mockResolvedValue([]);
    
    (mockPlugin.loadPage as any)
      .mockResolvedValueOnce({ guid: 'page-1', title: 'Testing Guide', content: '', folderId: null })
      .mockResolvedValueOnce({ guid: 'page-2', title: 'Test', content: '', folderId: null })
      .mockResolvedValueOnce({ guid: 'page-3', title: 'Advanced Test Topics', content: '', folderId: null });

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { q: 'Test' },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(3);
    
    // Exact match should be first
    expect(body.results[0].title).toBe('Test');
    
    // Starts with should be second
    expect(body.results[1].title).toBe('Testing Guide');
  });

  it('should return 500 on storage plugin error', async () => {
    (mockPlugin.buildPageTree as any).mockRejectedValue(new Error('Storage error'));

    const event: APIGatewayProxyEvent = {
      queryStringParameters: { q: 'test' },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toContain('Failed to search pages');
  });
});
