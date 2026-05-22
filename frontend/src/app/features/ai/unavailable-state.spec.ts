import { render, screen } from '@testing-library/angular';
import { UnavailableState } from './unavailable-state';

describe('UnavailableState', () => {
  it('shows downloading message when availability is downloading', async () => {
    await render(UnavailableState, { inputs: { availability: 'downloading' } });
    expect(screen.getByText(/downloading on-device ai/i)).toBeInTheDocument();
  });

  it('shows downloadable message when availability is downloadable', async () => {
    await render(UnavailableState, { inputs: { availability: 'downloadable' } });
    expect(screen.getByText(/ai is ready to download/i)).toBeInTheDocument();
  });

  it('shows setup steps and detected state when availability is unavailable', async () => {
    await render(UnavailableState, { inputs: { availability: 'unavailable' } });
    expect(screen.getByText(/ai assistant unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/chrome 138/i)).toBeInTheDocument();
  });

  it('shows the unsupported state for the unsupported branch', async () => {
    await render(UnavailableState, { inputs: { availability: 'unsupported' } });
    expect(screen.getByText(/ai assistant unavailable/i)).toBeInTheDocument();
  });
});
