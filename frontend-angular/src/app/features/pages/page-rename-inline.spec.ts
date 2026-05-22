import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PageRenameInline } from './page-rename-inline';

const providers = [provideHttpClient(), provideHttpClientTesting()];

describe('PageRenameInline', () => {
  it('seeds the input with the current title', async () => {
    await render(PageRenameInline, {
      providers,
      inputs: { guid: 'g1', initialTitle: 'Hello' },
    });
    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('Hello');
  });

  it('rejects empty title', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageRenameInline, {
      providers,
      inputs: { guid: 'g1', initialTitle: 'Hello' },
    });
    fixture.componentInstance.completed.subscribe((g: string) => events.push(g));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(events).toEqual([]);
    expect(screen.getByText(/at least 3/i)).toBeInTheDocument();
  });

  it('cancels on Escape and emits cancelled', async () => {
    const user = userEvent.setup();
    const events: number[] = [];
    const { fixture } = await render(PageRenameInline, {
      providers,
      inputs: { guid: 'g1', initialTitle: 'Hello' },
    });
    fixture.componentInstance.cancelled.subscribe(() => events.push(1));
    // Focus the input first then press Escape
    const input = screen.getByRole('textbox');
    input.focus();
    await user.keyboard('{Escape}');
    expect(events).toEqual([1]);
  });

  it('submits on Enter and emits completed on success', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageRenameInline, {
      providers,
      inputs: { guid: 'g1', initialTitle: 'Old Name' },
    });
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance.completed.subscribe((g: string) => events.push(g));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Brand New Title');
    await user.keyboard('{Enter}');
    const req = http.expectOne('/api/pages/g1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ title: 'Brand New Title' });
    req.flush({ guid: 'g1', title: 'Brand New Title' });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(events).toEqual(['g1']);
  });

  it('no-ops if title is unchanged', async () => {
    const user = userEvent.setup();
    const events: string[] = [];
    const { fixture } = await render(PageRenameInline, {
      providers,
      inputs: { guid: 'g1', initialTitle: 'Same' },
    });
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance.completed.subscribe((g: string) => events.push(g));
    await user.click(screen.getByRole('button', { name: /save/i }));
    http.expectNone(() => true);
    expect(events).toEqual(['g1']);
  });
});
