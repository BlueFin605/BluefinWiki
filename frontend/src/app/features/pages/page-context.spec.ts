import { TestBed } from '@angular/core/testing';

import { PageContext } from './page-context';
import { Layout } from '../../core/layout/layout';
import { provideBreakpointStub, type BreakpointStub } from '../../testing/breakpoint-stub';
import type { PageMetadata } from './drafts';
import type { PageTypeChange } from '../editor/page-properties-panel';

function makeMetadata(over: Partial<PageMetadata> = {}): PageMetadata {
  return {
    title: 'T',
    tags: [],
    status: 'published',
    createdBy: 'u',
    modifiedBy: 'u',
    createdAt: '',
    modifiedAt: '',
    guid: 'g1',
    ...over,
  };
}

function setup(isDesktop = true): { ctx: PageContext; layout: Layout; bp: BreakpointStub } {
  localStorage.clear();
  const bp = provideBreakpointStub(isDesktop);
  TestBed.configureTestingModule({ providers: [...bp.providers] });
  return { ctx: TestBed.inject(PageContext), layout: TestBed.inject(Layout), bp };
}

describe('PageContext', () => {
  it('canInsert tracks mode', () => {
    const { ctx } = setup();
    ctx.mode.set('view');
    expect(ctx.canInsert()).toBe(false);
    ctx.mode.set('edit');
    expect(ctx.canInsert()).toBe(true);
  });

  it('emitInsert pushes onto insert$', () => {
    const { ctx } = setup();
    const seen: string[] = [];
    const sub = ctx.insert$.subscribe((md) => seen.push(md));
    ctx.emitInsert('![x](x.png)');
    ctx.emitInsert('more');
    sub.unsubscribe();
    expect(seen).toEqual(['![x](x.png)', 'more']);
  });

  it('emitTitleH1Sync pushes onto titleH1Sync$', () => {
    const { ctx } = setup();
    const seen: string[] = [];
    const sub = ctx.titleH1Sync$.subscribe((t) => seen.push(t));
    ctx.emitTitleH1Sync('Renamed');
    sub.unsubscribe();
    expect(seen).toEqual(['Renamed']);
  });

  it('emitPageTypeChange pushes the payload onto pageTypeChange$', () => {
    const { ctx } = setup();
    const seen: PageTypeChange[] = [];
    const sub = ctx.pageTypeChange$.subscribe((c) => seen.push(c));
    const change: PageTypeChange = { pageType: 'pt-task', properties: {} };
    ctx.emitPageTypeChange(change);
    sub.unsubscribe();
    expect(seen).toEqual([change]);
  });

  it('toggleInspector on desktop flips Layout.inspectorVisible and leaves the sheet closed', () => {
    const { ctx, layout, bp } = setup(true);
    bp.isDesktop.set(true);
    const updateSpy = jest.spyOn(layout, 'update');
    expect(layout.inspectorVisible()).toBe(false);

    ctx.toggleInspector();

    expect(updateSpy).toHaveBeenCalledWith({ inspectorVisible: true });
    expect(layout.inspectorVisible()).toBe(true);
    expect(ctx.inspectorSheetOpen()).toBe(false);
  });

  it('toggleInspector on mobile flips inspectorSheetOpen and never touches Layout', () => {
    const { ctx, layout, bp } = setup(false);
    bp.isDesktop.set(false);
    const updateSpy = jest.spyOn(layout, 'update');
    expect(ctx.inspectorSheetOpen()).toBe(false);

    ctx.toggleInspector();
    expect(ctx.inspectorSheetOpen()).toBe(true);

    ctx.toggleInspector();
    expect(ctx.inspectorSheetOpen()).toBe(false);

    expect(updateSpy).not.toHaveBeenCalled();
    expect(layout.inspectorVisible()).toBe(false);
  });

  it('closes the mobile sheet when the breakpoint crosses to desktop (flip cleanup)', () => {
    const { ctx, bp } = setup(false);
    bp.isDesktop.set(false);
    ctx.inspectorSheetOpen.set(true);
    TestBed.tick();
    expect(ctx.inspectorSheetOpen()).toBe(true);

    bp.isDesktop.set(true);
    TestBed.tick();

    expect(ctx.inspectorSheetOpen()).toBe(false);
  });

  it('reset clears guid, metadata, the mobile sheet flag and mode (review M1)', () => {
    const { ctx } = setup();
    ctx.guid.set('g1');
    ctx.metadata.set(makeMetadata());
    ctx.inspectorSheetOpen.set(true);
    ctx.mode.set('edit');

    ctx.reset();

    expect(ctx.guid()).toBeNull();
    expect(ctx.metadata()).toBeNull();
    expect(ctx.inspectorSheetOpen()).toBe(false);
    expect(ctx.mode()).toBe('view');
    expect(ctx.canInsert()).toBe(false);
  });
});
