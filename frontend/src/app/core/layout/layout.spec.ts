import { TestBed } from '@angular/core/testing';
import { Layout, readStored, type LayoutPreferences } from './layout';

describe('Layout service', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Layout] });
  });

  it('returns defaults on first load', () => {
    const layout = TestBed.inject(Layout);
    const prefs = layout.preferences();
    expect(prefs).toEqual({
      treeWidth: 320,
      inspectorWidth: 320,
      inspectorVisible: false,
      editorSplitPosition: 50,
    });
  });

  it('merges stored partial values over defaults', () => {
    localStorage.setItem(
      'bluefinwiki-layout',
      JSON.stringify({ treeWidth: 250 }),
    );
    const layout = TestBed.inject(Layout);
    expect(layout.preferences().treeWidth).toBe(250);
    expect(layout.preferences().inspectorWidth).toBe(320);
  });

  it('survives malformed stored JSON without throwing', () => {
    localStorage.setItem('bluefinwiki-layout', '{not json');
    const layout = TestBed.inject(Layout);
    expect(layout.preferences().treeWidth).toBe(320);
  });

  it('update() patches the signal and writes to localStorage', async () => {
    const layout = TestBed.inject(Layout);
    layout.update({ treeWidth: 400 });
    TestBed.tick();
    await Promise.resolve();
    expect(layout.preferences().treeWidth).toBe(400);
    const stored = JSON.parse(localStorage.getItem('bluefinwiki-layout') ?? '{}') as Partial<LayoutPreferences>;
    expect(stored.treeWidth).toBe(400);
  });

  it('update() preserves un-touched fields', async () => {
    const layout = TestBed.inject(Layout);
    layout.update({ inspectorVisible: true });
    TestBed.tick();
    await Promise.resolve();
    expect(layout.preferences().inspectorVisible).toBe(true);
    expect(layout.preferences().treeWidth).toBe(320);
  });
});

describe('Layout service — clamps (F5 step 1.3)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Layout] });
  });

  it('clamps treeWidth up to the 200 minimum', () => {
    const layout = TestBed.inject(Layout);
    layout.update({ treeWidth: 50 });
    expect(layout.preferences().treeWidth).toBe(200);
  });

  it('clamps treeWidth down to the 600 maximum', () => {
    const layout = TestBed.inject(Layout);
    layout.update({ treeWidth: 999 });
    expect(layout.preferences().treeWidth).toBe(600);
  });

  it('keeps an in-range treeWidth untouched', () => {
    const layout = TestBed.inject(Layout);
    layout.update({ treeWidth: 350 });
    expect(layout.preferences().treeWidth).toBe(350);
  });

  it('clamps inspectorWidth to the 250-600 range', () => {
    const layout = TestBed.inject(Layout);
    layout.update({ inspectorWidth: 100 });
    expect(layout.preferences().inspectorWidth).toBe(250);
    layout.update({ inspectorWidth: 5000 });
    expect(layout.preferences().inspectorWidth).toBe(600);
  });

  it('clamps editorSplitPosition to the 20-80 range', () => {
    const layout = TestBed.inject(Layout);
    layout.update({ editorSplitPosition: 5 });
    expect(layout.preferences().editorSplitPosition).toBe(20);
    layout.update({ editorSplitPosition: 95 });
    expect(layout.preferences().editorSplitPosition).toBe(80);
  });

  it('passes the non-numeric inspectorVisible key through untouched', () => {
    const layout = TestBed.inject(Layout);
    layout.update({ inspectorVisible: true });
    expect(layout.preferences().inspectorVisible).toBe(true);
  });

  it('drops a NaN numeric value, leaving the prior value intact and nothing null persisted', async () => {
    const layout = TestBed.inject(Layout);
    layout.update({ treeWidth: NaN });
    TestBed.tick();
    await Promise.resolve();

    expect(layout.preferences().treeWidth).toBe(320);
    const stored = JSON.parse(localStorage.getItem('bluefinwiki-layout') ?? '{}') as Partial<LayoutPreferences>;
    expect(stored.treeWidth).toBe(320);
    expect(stored.treeWidth).not.toBeNull();
  });
});

describe('Layout service — persistence round-trip (F5 step 1.3)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Layout] });
  });

  it('round-trips inspectorVisible through readStored()', async () => {
    const layout = TestBed.inject(Layout);
    layout.update({ inspectorVisible: true });
    TestBed.tick();
    await Promise.resolve();
    expect(readStored().inspectorVisible).toBe(true);
  });

  it('a clamped value set via update survives a fresh Layout construction (reload proxy)', async () => {
    const layout = TestBed.inject(Layout);
    layout.update({ treeWidth: 5000 });
    TestBed.tick();
    await Promise.resolve();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Layout] });
    const reloaded = TestBed.inject(Layout);
    expect(reloaded.treeWidth()).toBe(600);
  });
});
