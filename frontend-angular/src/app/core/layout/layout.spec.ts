import { TestBed } from '@angular/core/testing';
import { Layout, type LayoutPreferences } from './layout';

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
