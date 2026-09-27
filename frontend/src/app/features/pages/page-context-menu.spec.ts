import { render, screen, fireEvent } from '@testing-library/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { PageContextMenu, type ContextMenuEvent } from './page-context-menu';
import { Auth } from '../../core/auth/auth';
import type { AuthUser } from '../../core/auth/auth.types';

function authStub(role: AuthUser['role']) {
  const user = signal<AuthUser | null>({
    userId: 'u',
    email: 'u@x',
    displayName: 'U',
    role,
    emailVerified: true,
  });
  return {
    provide: Auth,
    useValue: { user: user.asReadonly() },
  };
}

async function renderMenu(opts: { hasChildren: boolean; role?: AuthUser['role'] } = { hasChildren: true }) {
  const events: ContextMenuEvent[] = [];
  const rendered = await render(PageContextMenu, {
    inputs: { guid: 'g1', hasChildren: opts.hasChildren },
    providers: [provideAnimationsAsync(), authStub(opts.role ?? 'Admin')],
  });
  rendered.fixture.componentInstance.menuEvent.subscribe((e) => events.push(e));
  // Programmatically open the menu so its items are in the DOM.
  rendered.fixture.componentInstance.open({ x: 10, y: 10 });
  rendered.fixture.detectChanges();
  return { ...rendered, events };
}

describe('PageContextMenu', () => {
  it('emits rename when the rename item is clicked', async () => {
    const { events } = await renderMenu();
    fireEvent.click(screen.getByText(/rename/i));
    expect(events).toEqual([{ kind: 'rename', guid: 'g1' }]);
  });

  it('emits newChild when New child page is clicked', async () => {
    const { events } = await renderMenu();
    fireEvent.click(screen.getByText(/new child page/i));
    expect(events).toEqual([{ kind: 'newChild', guid: 'g1' }]);
  });

  it('emits sort with direction "asc" when Sort A-Z is clicked', async () => {
    const { events } = await renderMenu({ hasChildren: true });
    fireEvent.click(screen.getByText(/sort children a/i));
    expect(events).toEqual([{ kind: 'sort', guid: 'g1', direction: 'asc' }]);
  });

  it('hides sort items when the page has no children', async () => {
    await renderMenu({ hasChildren: false });
    expect(screen.queryByText(/sort children a/i)).toBeNull();
    expect(screen.queryByText(/sort children z/i)).toBeNull();
  });

  it('hides delete for non-admin users', async () => {
    await renderMenu({ hasChildren: true, role: 'Standard' });
    expect(screen.queryByRole('menuitem', { name: /delete/i })).toBeNull();
  });

  it('shows delete for admin users', async () => {
    await renderMenu({ hasChildren: true, role: 'Admin' });
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
  });
});
