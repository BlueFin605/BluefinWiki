import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('renders the toolbar title', async () => {
    await render(App, { providers: [provideRouter([])] });
    expect(screen.getByText('BlueFinWiki')).toBeInTheDocument();
  });
});
