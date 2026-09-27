import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { AdminBackHeader } from './admin-back-header';

function providers() {
  return [
    provideNoopAnimations(),
    provideRouter([{ path: 'pages', children: [] }]),
  ];
}

describe('AdminBackHeader', () => {
  it('renders the title', async () => {
    await render(AdminBackHeader, {
      inputs: { title: 'Settings' },
      providers: providers(),
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeInTheDocument();
  });

  it('navigates to /pages when the back button is clicked', async () => {
    await render(AdminBackHeader, {
      inputs: { title: 'Settings' },
      providers: providers(),
    });
    await userEvent.click(screen.getByRole('button', { name: /back to pages/i }));
    expect(TestBed.inject(Router).url).toBe('/pages');
  });
});
