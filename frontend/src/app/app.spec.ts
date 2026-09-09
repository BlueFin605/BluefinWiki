import { render } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('renders only the router outlet, with no global toolbar', async () => {
    const { container } = await render(App, { providers: [provideRouter([])] });

    expect(container.querySelector('router-outlet')).not.toBeNull();
    expect(container.querySelector('mat-toolbar')).toBeNull();
    expect(container.textContent ?? '').not.toContain('BlueFinWiki');
  });
});
