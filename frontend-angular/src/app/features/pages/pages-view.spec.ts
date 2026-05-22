import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Auth } from '../../core/auth/auth';
import { PagesView } from './pages-view';

function baseProviders() {
  return [
    provideNoopAnimations(),
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([]),
  ];
}

function authProviders(role: 'Admin' | 'Standard') {
  return [
    {
      provide: Auth,
      useValue: {
        user: () => ({
          userId: 'u',
          email: 'a@b',
          displayName: 'A',
          role,
          emailVerified: true,
        }),
        signOut: jest.fn(),
      },
    },
  ];
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('PagesView', () => {
  it('renders the header and a sidebar containing the page tree', async () => {
    await render(PagesView, { providers: [...baseProviders(), ...authProviders('Admin')] });
    expect(screen.getByText(/bluefinwiki/i)).toBeInTheDocument();
    // The page tree renders its loading state on first mount.
    expect(screen.getByText(/loading pages/i)).toBeInTheDocument();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
  });

  it('renders an enabled New page button (Phase 4 opens NewPageModal)', async () => {
    await render(PagesView, { providers: [...baseProviders(), ...authProviders('Admin')] });
    const newBtn = screen.getByRole('button', { name: /new page/i });
    expect(newBtn).not.toBeDisabled();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
  });

  it('opens a user menu showing Settings for admins', async () => {
    const { fixture } = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Admin')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /user menu/i }));
    await settle();
    fixture.detectChanges();

    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('hides the Settings menu item for standard users', async () => {
    const { fixture } = await render(PagesView, {
      providers: [...baseProviders(), ...authProviders('Standard')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /user menu/i }));
    await settle();
    fixture.detectChanges();

    expect(screen.queryByRole('menuitem', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument();
  });
});
