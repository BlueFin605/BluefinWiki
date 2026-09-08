import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { ForbiddenComponent } from './forbidden';

describe('ForbiddenComponent', () => {
  it('shows the 403 copy and a link to /pages', async () => {
    await render(ForbiddenComponent, { providers: [provideRouter([])] });
    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /pages/i });
    expect(link).toHaveAttribute('href', '/pages');
  });
});
