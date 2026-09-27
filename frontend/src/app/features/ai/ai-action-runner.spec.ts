import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { Pages } from '../pages/pages';
import { InvalidationBus, childrenTag, pageTag } from '../../core/api/invalidation';
import { AiActionRunner } from './ai-action-runner';
import type { AiAction } from './ai';

describe('AiActionRunner', () => {
  const originalAllowDestructive = environment.aiAllowDestructive;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    environment.aiAllowDestructive = originalAllowDestructive;
  });

  function action(overrides: Partial<AiAction> & { type: AiAction['type'] }): AiAction {
    return overrides;
  }

  it('create_page dispatches Pages.createPage with the mapped fields', async () => {
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'createPage').mockResolvedValue({} as never);
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(
      action({
        type: 'create_page',
        title: 'New Page',
        content: '# hi',
        parentGuid: 'parent-1',
        pageType: 'type-1',
        pageProperties: { color: { type: 'string', value: 'red' } },
      }),
    );

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith({
      title: 'New Page',
      parentGuid: 'parent-1',
      content: '# hi',
      pageType: 'type-1',
      properties: { color: { type: 'string', value: 'red' } },
    });
  });

  it('create_page forwards tags to Pages.createPage when present', async () => {
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'createPage').mockResolvedValue({} as never);
    const runner = TestBed.inject(AiActionRunner);

    await runner.run(
      action({ type: 'create_page', title: 'New Page', tags: ['foo', 'bar'] }),
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['foo', 'bar'] }),
    );
  });

  it('create_page does not include a tags key when action.tags is absent', async () => {
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'createPage').mockResolvedValue({} as never);
    const runner = TestBed.inject(AiActionRunner);

    await runner.run(action({ type: 'create_page', title: 'New Page' }));

    const calledWith = spy.mock.calls[0][0];
    expect('tags' in calledWith).toBe(false);
  });

  it('create_page defaults parentGuid to null when omitted', async () => {
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'createPage').mockResolvedValue({} as never);
    const runner = TestBed.inject(AiActionRunner);

    await runner.run(action({ type: 'create_page', title: 'Root page' }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Root page', parentGuid: null }),
    );
  });

  it('update_page dispatches Pages.updatePage with only the fields present on the action', async () => {
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'updatePage').mockResolvedValue({} as never);
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(
      action({ type: 'update_page', pageGuid: 'g1', title: 'New title', tags: ['a', 'b'] }),
    );

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith('g1', { title: 'New title', tags: ['a', 'b'] });
  });

  it('update_page fails without dispatching when pageGuid is missing', async () => {
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'updatePage').mockResolvedValue({} as never);
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(action({ type: 'update_page', title: 'x' }));

    expect(result.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('delete_page dispatches Pages.deletePage with recursive flag when aiAllowDestructive is true', async () => {
    environment.aiAllowDestructive = true;
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'deletePage').mockResolvedValue(undefined);
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(
      action({ type: 'delete_page', pageGuid: 'g1', recursive: true }),
    );

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith('g1', { recursive: true });
  });

  it('delete_page is refused without dispatching when aiAllowDestructive is false', async () => {
    environment.aiAllowDestructive = false;
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'deletePage').mockResolvedValue(undefined);
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(action({ type: 'delete_page', pageGuid: 'g1' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/disabled/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it('move_page dispatches Pages.movePage when aiAllowDestructive is true', async () => {
    environment.aiAllowDestructive = true;
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'movePage').mockResolvedValue(undefined);
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(
      action({ type: 'move_page', pageGuid: 'g1', newParentGuid: 'p2' }),
    );

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith('g1', { newParentGuid: 'p2' });
  });

  it('move_page is refused without dispatching when aiAllowDestructive is false', async () => {
    environment.aiAllowDestructive = false;
    const pages = TestBed.inject(Pages);
    const spy = jest.spyOn(pages, 'movePage').mockResolvedValue(undefined);
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(
      action({ type: 'move_page', pageGuid: 'g1', newParentGuid: null }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/disabled/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns a failure for action types with no mapped mutation (fetch_url / fetch_imdb_show)', async () => {
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(action({ type: 'fetch_url', url: 'https://example.com' }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('surfaces the server error message on failure', async () => {
    const pages = TestBed.inject(Pages);
    jest
      .spyOn(pages, 'updatePage')
      .mockRejectedValue({ error: { message: 'Title already in use' } });
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(
      action({ type: 'update_page', pageGuid: 'g1', title: 'dup' }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Title already in use');
  });

  it('falls back to a generic message when the error carries no server message', async () => {
    const pages = TestBed.inject(Pages);
    jest.spyOn(pages, 'updatePage').mockRejectedValue(new Error());
    const runner = TestBed.inject(AiActionRunner);

    const result = await runner.run(action({ type: 'update_page', pageGuid: 'g1', title: 'x' }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('applying create_page through the real Pages service bumps the precise children:<parent> tag (step 1.2 convention, not a parallel one)', async () => {
    const http = TestBed.inject(HttpTestingController);
    const bus = TestBed.inject(InvalidationBus);
    const bumpSpy = jest.spyOn(bus, 'bump');
    const runner = TestBed.inject(AiActionRunner);

    const promise = runner.run(
      action({ type: 'create_page', title: 'New', parentGuid: 'parent-1' }),
    );
    http.expectOne('/api/pages').flush({ guid: 'new-1', folderId: 'parent-1' });
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(bumpSpy.mock.calls.map((c) => c[0])).toContain(childrenTag('parent-1'));
  });

  it('applying update_page through the real Pages service bumps the precise page:<guid> tag', async () => {
    const http = TestBed.inject(HttpTestingController);
    const bus = TestBed.inject(InvalidationBus);
    const bumpSpy = jest.spyOn(bus, 'bump');
    const runner = TestBed.inject(AiActionRunner);

    const promise = runner.run(
      action({ type: 'update_page', pageGuid: 'g1', title: 'Renamed' }),
    );
    http.expectOne('/api/pages/g1').flush({ guid: 'g1', folderId: 'root' });
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(bumpSpy.mock.calls.map((c) => c[0])).toContain(pageTag('g1'));
  });
});
