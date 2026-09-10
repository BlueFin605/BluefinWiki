import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { PageTree } from './page-tree';
import { PageTreeItem } from './page-tree-item';

const providers = [provideHttpClient(), provideHttpClientTesting()];

describe('PageTree', () => {
  it('shows a loading indicator on first render', async () => {
    await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    http.verify();
  });

  it('shows the empty state when there are no pages', async () => {
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
    expect(screen.getByText(/no pages yet/i)).toBeInTheDocument();
    http.verify();
  });

  it('renders root pages returned by the resource', async () => {
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({
      children: [
        { guid: 'a', title: 'Alpha', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
        { guid: 'b', title: 'Beta', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
      ],
    });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    http.verify();
  });

  it('bubbles pageSelect from a child item', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance.pageSelect.subscribe((g: string) => events.push(g));
    http.expectOne('/api/pages/root/children').flush({
      children: [
        { guid: 'a', title: 'Alpha', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
      ],
    });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
    await user.click(screen.getByText('Alpha'));
    expect(events).toEqual(['a']);
    http.verify();
  });

  it('bubbles dropRequested (step 2.1 positional drop) from a child item', async () => {
    const events: unknown[] = [];
    const { fixture } = await render(PageTree, { providers, inputs: { activeGuid: null, pageTypesMap: {} } });
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance.dropRequested.subscribe((e: unknown) => events.push(e));
    http.expectOne('/api/pages/root/children').flush({
      children: [
        { guid: 'a', title: 'Alpha', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: false },
      ],
    });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();

    const item = fixture.debugElement
      .query(By.directive(PageTreeItem)).componentInstance as PageTreeItem;
    const payload = {
      movingGuid: 'm', movingParentGuid: null, targetGuid: 'a', targetParentGuid: null, zone: 'before' as const,
    };
    item.dropRequested.emit(payload);

    expect(events).toEqual([payload]);
    http.verify();
  });
});
