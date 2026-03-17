/**
 * Unit Tests for Search Index Builder Lambda
 * Task 8.2: Build search-index.json from page data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CLIENT_SEARCH_INDEX_VERSION } from '../SearchTypes.js';

// Mock the S3 client
vi.mock('@aws-sdk/client-s3', () => {
  const putObjectMock = vi.fn().mockResolvedValue({});
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: putObjectMock,
    })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'PutObjectCommand' })),
    __putObjectMock: putObjectMock,
  };
});

// Mock the storage plugin
const mockStoragePlugin = {
  buildPageTree: vi.fn(),
  loadPage: vi.fn(),
  getAncestors: vi.fn(),
};

vi.mock('../../storage/index.js', () => ({
  getStoragePlugin: () => mockStoragePlugin,
}));

// Set env before importing the module
process.env.PAGES_BUCKET = 'test-bucket';
process.env.AWS_REGION = 'us-east-1';

// Import after mocking
const { buildSearchIndex } = await import('../search-build-index.js');
const { __putObjectMock: putObjectMock } = await import('@aws-sdk/client-s3') as unknown as { __putObjectMock: ReturnType<typeof vi.fn> };

describe('buildSearchIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAGES_BUCKET = 'test-bucket';
  });

  it('should build an empty index when no pages exist', async () => {
    mockStoragePlugin.buildPageTree.mockResolvedValue([]);

    const index = await buildSearchIndex();

    expect(index.version).toBe(CLIENT_SEARCH_INDEX_VERSION);
    expect(index.totalPages).toBe(0);
    expect(index.entries).toHaveLength(0);
    expect(index.builtAt).toBeTruthy();
  });

  it('should index published pages', async () => {
    mockStoragePlugin.buildPageTree.mockResolvedValue([
      {
        guid: 'page-1',
        title: 'Published Page',
        parentGuid: null,
        status: 'published',
        modifiedAt: '2026-03-17T12:00:00Z',
        modifiedBy: 'user-123',
        hasChildren: false,
      },
    ]);

    mockStoragePlugin.loadPage.mockResolvedValue({
      guid: 'page-1',
      title: 'Published Page',
      content: '# Published Page\n\nThis is published content.',
      tags: ['test'],
      status: 'published',
      modifiedAt: '2026-03-17T12:00:00Z',
      modifiedBy: 'user-123',
      createdBy: 'user-123',
      createdAt: '2026-03-17T12:00:00Z',
      folderId: null,
    });

    mockStoragePlugin.getAncestors.mockResolvedValue([]);

    const index = await buildSearchIndex();

    expect(index.totalPages).toBe(1);
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0].id).toBe('page-1');
    expect(index.entries[0].title).toBe('Published Page');
    expect(index.entries[0].tags).toEqual(['test']);
    // Content should be stripped of markdown
    expect(index.entries[0].content).not.toContain('#');
    expect(index.entries[0].content).toContain('published content');
  });

  it('should exclude draft and archived pages', async () => {
    mockStoragePlugin.buildPageTree.mockResolvedValue([
      {
        guid: 'page-1',
        title: 'Published',
        parentGuid: null,
        status: 'published',
        modifiedAt: '2026-03-17T12:00:00Z',
        modifiedBy: 'user-123',
        hasChildren: false,
      },
      {
        guid: 'page-2',
        title: 'Draft',
        parentGuid: null,
        status: 'draft',
        modifiedAt: '2026-03-17T12:00:00Z',
        modifiedBy: 'user-123',
        hasChildren: false,
      },
      {
        guid: 'page-3',
        title: 'Archived',
        parentGuid: null,
        status: 'archived',
        modifiedAt: '2026-03-17T12:00:00Z',
        modifiedBy: 'user-123',
        hasChildren: false,
      },
    ]);

    mockStoragePlugin.loadPage.mockResolvedValue({
      guid: 'page-1',
      title: 'Published',
      content: 'Content',
      tags: [],
      status: 'published',
      modifiedAt: '2026-03-17T12:00:00Z',
      modifiedBy: 'user-123',
      createdBy: 'user-123',
      createdAt: '2026-03-17T12:00:00Z',
      folderId: null,
    });

    mockStoragePlugin.getAncestors.mockResolvedValue([]);

    const index = await buildSearchIndex();

    expect(index.totalPages).toBe(1);
    expect(index.entries[0].title).toBe('Published');
  });

  it('should build hierarchical paths from ancestors', async () => {
    mockStoragePlugin.buildPageTree.mockResolvedValue([
      {
        guid: 'parent',
        title: 'Parent',
        parentGuid: null,
        status: 'published',
        modifiedAt: '2026-03-17T12:00:00Z',
        modifiedBy: 'user-123',
        hasChildren: true,
        children: [
          {
            guid: 'child',
            title: 'Child',
            parentGuid: 'parent',
            status: 'published',
            modifiedAt: '2026-03-17T12:00:00Z',
            modifiedBy: 'user-123',
            hasChildren: false,
          },
        ],
      },
    ]);

    mockStoragePlugin.loadPage.mockImplementation(async (guid: string) => ({
      guid,
      title: guid === 'parent' ? 'Parent' : 'Child',
      content: 'Content',
      tags: [],
      status: 'published',
      modifiedAt: '2026-03-17T12:00:00Z',
      modifiedBy: 'user-123',
      createdBy: 'user-123',
      createdAt: '2026-03-17T12:00:00Z',
      folderId: guid === 'parent' ? null : 'parent',
    }));

    mockStoragePlugin.getAncestors.mockImplementation(async (guid: string) => {
      if (guid === 'child') {
        return [{ guid: 'parent', title: 'Parent', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: true }];
      }
      return [];
    });

    const index = await buildSearchIndex();

    expect(index.totalPages).toBe(2);
    const childEntry = index.entries.find(e => e.id === 'child');
    expect(childEntry?.path).toBe('Parent > Child');
  });

  it('should upload index to S3', async () => {
    mockStoragePlugin.buildPageTree.mockResolvedValue([]);

    await buildSearchIndex();

    expect(putObjectMock).toHaveBeenCalled();
    const callArg = putObjectMock.mock.calls[0][0];
    expect(callArg.Bucket).toBe('test-bucket');
    expect(callArg.Key).toBe('search-index.json');
    expect(callArg.ContentType).toBe('application/json');

    // Verify the body is valid JSON
    const body = JSON.parse(callArg.Body);
    expect(body.version).toBe(CLIENT_SEARCH_INDEX_VERSION);
  });

  it('should handle individual page load failures gracefully', async () => {
    mockStoragePlugin.buildPageTree.mockResolvedValue([
      {
        guid: 'good-page',
        title: 'Good',
        parentGuid: null,
        status: 'published',
        modifiedAt: '2026-03-17T12:00:00Z',
        modifiedBy: 'user-123',
        hasChildren: false,
      },
      {
        guid: 'bad-page',
        title: 'Bad',
        parentGuid: null,
        status: 'published',
        modifiedAt: '2026-03-17T12:00:00Z',
        modifiedBy: 'user-123',
        hasChildren: false,
      },
    ]);

    mockStoragePlugin.loadPage.mockImplementation(async (guid: string) => {
      if (guid === 'bad-page') throw new Error('Page corrupted');
      return {
        guid,
        title: 'Good',
        content: 'Content',
        tags: [],
        status: 'published',
        modifiedAt: '2026-03-17T12:00:00Z',
        modifiedBy: 'user-123',
        createdBy: 'user-123',
        createdAt: '2026-03-17T12:00:00Z',
        folderId: null,
      };
    });

    mockStoragePlugin.getAncestors.mockResolvedValue([]);

    const index = await buildSearchIndex();

    // Should still have the good page
    expect(index.totalPages).toBe(1);
    expect(index.entries[0].id).toBe('good-page');
  });

  it('should strip markdown from content in index entries', async () => {
    mockStoragePlugin.buildPageTree.mockResolvedValue([
      {
        guid: 'page-1',
        title: 'Test',
        parentGuid: null,
        status: 'published',
        modifiedAt: '2026-03-17T12:00:00Z',
        modifiedBy: 'user-123',
        hasChildren: false,
      },
    ]);

    mockStoragePlugin.loadPage.mockResolvedValue({
      guid: 'page-1',
      title: 'Test',
      content: '# Title\n\n**Bold** text with [link](url) and `code`\n\n```\nblock\n```',
      tags: [],
      status: 'published',
      modifiedAt: '2026-03-17T12:00:00Z',
      modifiedBy: 'user-123',
      createdBy: 'user-123',
      createdAt: '2026-03-17T12:00:00Z',
      folderId: null,
    });

    mockStoragePlugin.getAncestors.mockResolvedValue([]);

    const index = await buildSearchIndex();

    const content = index.entries[0].content;
    expect(content).not.toContain('#');
    expect(content).not.toContain('**');
    expect(content).not.toContain('```');
    expect(content).not.toContain('[link]');
    expect(content).toContain('Bold');
    expect(content).toContain('text');
    expect(content).toContain('link');
    expect(content).toContain('code');
  });

  it('should throw when no bucket is configured', async () => {
    delete process.env.PAGES_BUCKET;
    delete process.env.S3_PAGES_BUCKET;
    delete process.env.SEARCH_INDEX_BUCKET;

    await expect(buildSearchIndex()).rejects.toThrow('No S3 bucket configured');

    // Restore
    process.env.PAGES_BUCKET = 'test-bucket';
  });
});
