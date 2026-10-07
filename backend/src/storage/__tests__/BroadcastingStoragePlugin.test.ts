import { describe, it, expect, vi, afterEach } from 'vitest';
import { BroadcastingStoragePlugin } from '../BroadcastingStoragePlugin.js';
import { collectChanges, setBroadcaster } from '../../realtime/broadcaster.js';
import { runWithOrigin } from '../../realtime/request-origin.js';
import { toPageSummary } from '../../realtime/page-summary.js';
import type { StoragePlugin } from '../StoragePlugin.js';
import type { PageContent } from '../../types/index.js';

afterEach(() => setBroadcaster(null));

function inner(over: Partial<StoragePlugin> = {}): StoragePlugin {
  return new Proxy({} as StoragePlugin, {
    get: (_t, k: string) => (over as Record<string, unknown>)[k] ?? vi.fn().mockResolvedValue(undefined),
  });
}

function tagsOf(publish: ReturnType<typeof vi.fn>): string[][] {
  return publish.mock.calls.map((c) => c[0].tags);
}

describe('BroadcastingStoragePlugin', () => {
  const page = (over: Partial<PageContent> = {}): PageContent => ({
    guid: 'g',
    title: 'Card',
    content: '# secret body',
    folderId: 'f',
    tags: ['dean'],
    status: 'published',
    boardOrder: 2,
    properties: { state: { type: 'string', value: 'Ready' } },
    createdBy: 'u1',
    modifiedBy: 'u2',
    createdAt: '2026-10-01T00:00:00.000Z',
    modifiedAt: '2026-10-07T00:00:00.000Z',
    ...over,
  });

  it('publishes an upsert with the page summary (no content) after a published savePage', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    const p = new BroadcastingStoragePlugin(inner());
    await runWithOrigin('tab-9', () => p.savePage('g', 'f', page()));
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0][0];
    expect(event).toEqual({
      type: 'upsert',
      pages: [toPageSummary(page(), 'f')],
      tags: [],
      origin: 'tab-9',
    });
    expect(JSON.stringify(event)).not.toContain('secret body');
  });

  it.each(['draft', 'archived', 'deleted'] as const)('publishes coarse invalidate tags for a %s savePage', async (status) => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    const p = new BroadcastingStoragePlugin(inner());
    await p.savePage('g', 'f', page({ status }));
    const event = publish.mock.calls[0][0];
    expect(event.type).toBe('invalidate');
    expect(event.tags).toEqual(expect.arrayContaining(['page:g', 'children:f']));
    expect(JSON.stringify(event)).not.toContain('Card');
  });

  it('batches savePage upserts inside collectChanges', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    const p = new BroadcastingStoragePlugin(inner());
    await collectChanges(async () => {
      await p.savePage('a', 'f', page({ guid: 'a' }));
      await p.savePage('b', 'f', page({ guid: 'b' }));
      await p.savePage('c', 'f', page({ guid: 'c' }));
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0].pages.map((s: { guid: string }) => s.guid)).toEqual(['a', 'b', 'c']);
  });

  it('passes savePage arguments through unchanged', async () => {
    setBroadcaster({ publish: vi.fn().mockResolvedValue(undefined) });
    const savePage = vi.fn().mockResolvedValue(undefined);
    const content = { title: 't' } as never;
    await new BroadcastingStoragePlugin(inner({ savePage })).savePage('g', null, content);
    expect(savePage).toHaveBeenCalledWith('g', null, content);
  });

  it('does not publish when the write fails, and rethrows', async () => {
    const publish = vi.fn();
    setBroadcaster({ publish });
    const p = new BroadcastingStoragePlugin(inner({ deletePage: vi.fn().mockRejectedValue(new Error('nope')) }));
    await expect(p.deletePage('g')).rejects.toThrow('nope');
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not publish for reads, and passes their results through', async () => {
    const publish = vi.fn();
    setBroadcaster({ publish });
    const p = new BroadcastingStoragePlugin(inner({ loadPage: vi.fn().mockResolvedValue({ guid: 'g' }) }));
    await expect(p.loadPage('g')).resolves.toEqual({ guid: 'g' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes comments and attachments tags', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    const p = new BroadcastingStoragePlugin(inner({ saveComments: vi.fn().mockResolvedValue({ etag: 'e' }) }));
    await expect(p.saveComments('g', [], null)).resolves.toEqual({ etag: 'e' });
    await p.uploadAttachment('g', {} as never);
    expect(tagsOf(publish)).toEqual([['comments:g'], ['attachments:g']]);
  });

  it('publishes for delete, move, and the other attachment writes', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    const deletePage = vi.fn().mockResolvedValue(undefined);
    const p = new BroadcastingStoragePlugin(inner({ deletePage }));
    await p.deletePage('d', true);
    await p.movePage('m', 'np');
    await p.deleteAttachment('a', 'x.png');
    await p.saveAttachmentMetadata('b', 'x.png', {} as never);
    expect(deletePage).toHaveBeenCalledWith('d', true);
    const tags = tagsOf(publish);
    expect(tags[0]).toContain('page:d');
    expect(tags[1]).toEqual(expect.arrayContaining(['page:m', 'children:np']));
    expect(tags[2]).toEqual(['attachments:a']);
    expect(tags[3]).toEqual(['attachments:b']);
  });

  it('deleteAttachmentByKey publishes for the page guid in an attachment key, and nothing for other keys', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    setBroadcaster({ publish });
    const p = new BroadcastingStoragePlugin(inner());
    await p.deleteAttachmentByKey('parent/child-guid/_attachments/x.png');
    await p.deleteAttachmentByKey('root-guid/_attachments/y.pdf');
    await p.deleteAttachmentByKey('something/else.png');
    expect(tagsOf(publish)).toEqual([['attachments:child-guid'], ['attachments:root-guid']]);
  });

  it('does not let a failing broadcaster fail the write', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setBroadcaster({ publish: vi.fn().mockRejectedValue(new Error('boom')) });
    const p = new BroadcastingStoragePlugin(inner({ saveComments: vi.fn().mockResolvedValue({ etag: 'e' }) }));
    await expect(p.saveComments('g', [], 'old')).resolves.toEqual({ etag: 'e' });
    warn.mockRestore();
  });

  it('delegates getType and the non-writing methods', async () => {
    const publish = vi.fn();
    setBroadcaster({ publish });
    const p = new BroadcastingStoragePlugin(inner({ getType: (() => 's3') as never }));
    expect(p.getType()).toBe('s3');
    await p.listChildren(null);
    await p.headAttachment('g', 'k');
    await p.getAttachmentUploadUrl('g', 'f', 'image/png', 10);
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('getStoragePlugin', () => {
  it('returns the broadcasting decorator around the S3 plugin', async () => {
    const { getStoragePlugin, resetStoragePlugin } = await import('../StoragePluginRegistry.js');
    vi.stubEnv('PAGES_BUCKET', 'test-bucket');
    resetStoragePlugin();
    try {
      const plugin = getStoragePlugin();
      expect(plugin).toBeInstanceOf(BroadcastingStoragePlugin);
      expect(plugin.getType()).toBe('s3');
      expect(getStoragePlugin()).toBe(plugin);
    } finally {
      resetStoragePlugin();
      vi.unstubAllEnvs();
    }
  });
});
