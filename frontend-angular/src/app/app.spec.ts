import { render, screen } from '@testing-library/angular';
import { App } from './app';

describe('App', () => {
  it('renders the toolbar title', async () => {
    await render(App);
    expect(screen.getByText('BlueFinWiki')).toBeInTheDocument();
  });
});
