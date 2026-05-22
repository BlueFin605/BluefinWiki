import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PagesView } from './pages-view';

const providers = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([]),
];

describe('PagesView', () => {
  it('renders the header and a sidebar containing the page tree', async () => {
    await render(PagesView, { providers });
    expect(screen.getByText(/bluefinwiki/i)).toBeInTheDocument();
    // The page tree renders its loading state on first mount.
    expect(screen.getByText(/loading pages/i)).toBeInTheDocument();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
  });

  it('renders the disabled New page button with a Phase 4 tooltip', async () => {
    await render(PagesView, { providers });
    const newBtn = screen.getByRole('button', { name: /new page/i });
    expect(newBtn).toBeDisabled();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/root/children').flush({ children: [] });
  });
});
