import { render, screen } from '@testing-library/angular';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ContextMeter } from './context-meter';

describe('ContextMeter', () => {
  it('shows the "ready" hint when quota is zero', async () => {
    await render(ContextMeter, {
      providers: [provideNoopAnimations()],
      inputs: { usage: 0, quota: 0 },
    });
    expect(screen.getByText(/context: ready/i)).toBeInTheDocument();
  });

  it('renders the percent label when usage and quota are positive', async () => {
    await render(ContextMeter, {
      providers: [provideNoopAnimations()],
      inputs: { usage: 250, quota: 1000 },
    });
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText(/context window/i)).toBeInTheDocument();
  });

  it('clamps over-quota usage to 100%', async () => {
    await render(ContextMeter, {
      providers: [provideNoopAnimations()],
      inputs: { usage: 5000, quota: 1000 },
    });
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
