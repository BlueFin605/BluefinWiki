import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { WikiLink } from './wiki-link';

/** Router providers with a wildcard route so RouterLink navigation succeeds in jsdom. */
const testRouterProviders = [provideRouter([{ path: '**', redirectTo: '' }])];

describe('WikiLink', () => {
  it('renders a live link with display text', async () => {
    await render(WikiLink, {
      inputs: { href: '/wiki/getting-started', target: 'Getting Started', broken: false, displayText: 'Getting Started' },
      providers: testRouterProviders,
    });
    const link = screen.getByRole('link', { name: 'Getting Started' });
    expect(link).toHaveAttribute('href', '/wiki/getting-started');
    expect(link).not.toHaveClass('wiki-link-broken');
  });

  it('renders a pending link with normal styling but no navigable href/routerLink', async () => {
    await render(WikiLink, {
      inputs: { href: '', target: 'Flaky Page', broken: false, pending: true, displayText: 'Flaky Page' },
      providers: testRouterProviders,
    });
    const link = screen.getByText('Flaky Page').closest('a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link).toHaveClass('wiki-link');
    expect(link).not.toHaveClass('wiki-link-broken');
    // Never a navigable href to a bare title.
    expect(link.getAttribute('href')).toBeNull();
  });

  it('swallows a click on a pending link (no navigation, no brokenClick)', async () => {
    const user = userEvent.setup();
    let fired = false;
    const { fixture } = await render(WikiLink, {
      inputs: { href: '', target: 'Flaky Page', broken: false, pending: true, displayText: 'Flaky Page' },
      providers: testRouterProviders,
    });
    fixture.componentInstance.brokenClick.subscribe(() => { fired = true; });
    await user.click(screen.getByText('Flaky Page'));
    expect(fired).toBe(false);
  });

  it('renders a broken link with the broken class and a ? marker', async () => {
    await render(WikiLink, {
      inputs: { href: '/wiki/missing', target: 'Missing', broken: true, displayText: 'Missing' },
    });
    const link = screen.getByRole('link', { name: /Missing/ });
    expect(link).toHaveClass('wiki-link-broken');
    expect(link.textContent).toContain('?');
  });

  it('emits brokenClick (and not navigate) when a broken link is clicked', async () => {
    const user = userEvent.setup();
    const events: { target: string; displayText: string }[] = [];
    const { fixture } = await render(WikiLink, {
      inputs: { href: '/wiki/missing', target: 'Missing', broken: true, displayText: 'Missing' },
    });
    fixture.componentInstance.brokenClick.subscribe((e) => events.push(e));
    await user.click(screen.getByRole('link'));
    expect(events).toEqual([{ target: 'Missing', displayText: 'Missing' }]);
  });

  it('carries both target and display text on brokenClick so the create modal can prefill', async () => {
    const user = userEvent.setup();
    const events: { target: string; displayText: string }[] = [];
    const { fixture } = await render(WikiLink, {
      inputs: {
        href: '/pages/x',
        target: 'backend-guide',
        broken: true,
        displayText: 'Backend Guide',
      },
    });
    fixture.componentInstance.brokenClick.subscribe((e) => events.push(e));
    await user.click(screen.getByRole('link'));
    expect(events).toEqual([{ target: 'backend-guide', displayText: 'Backend Guide' }]);
  });

  it('locks the exact broken-link tooltip copy', async () => {
    await render(WikiLink, {
      inputs: { href: '/pages/x', target: 'Backend Guide', broken: true, displayText: 'Backend Guide' },
    });
    const link = screen.getByRole('link', { name: /Backend Guide/ });
    expect(link.getAttribute('title')).toBe('Page not found: Backend Guide. Click to create.');
  });

  it('does not emit brokenClick on a live link click', async () => {
    const user = userEvent.setup();
    let fired = false;
    const { fixture } = await render(WikiLink, {
      inputs: { href: '/wiki/home', target: 'Home', broken: false, displayText: 'Home' },
      providers: testRouterProviders,
    });
    fixture.componentInstance.brokenClick.subscribe(() => { fired = true; });
    await user.click(screen.getByRole('link'));
    expect(fired).toBe(false);
  });
});
