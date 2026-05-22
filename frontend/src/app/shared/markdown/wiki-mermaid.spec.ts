import { render, screen } from '@testing-library/angular';
import { WikiMermaid } from './wiki-mermaid';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn().mockResolvedValue({ svg: '<svg data-testid="rendered-svg"></svg>' }),
  },
}));

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('WikiMermaid', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the placeholder while mermaid is rendering', async () => {
    await render(WikiMermaid, { inputs: { chart: 'flowchart TD; A-->B' } });
    expect(screen.getByText(/Rendering diagram/i)).toBeInTheDocument();
  });

  it('replaces the placeholder with the rendered SVG', async () => {
    await render(WikiMermaid, { inputs: { chart: 'flowchart TD; A-->B' } });
    await flush();
    expect(await screen.findByTestId('rendered-svg')).toBeInTheDocument();
  });

  it('invokes mermaid.render with the chart input', async () => {
    const mermaid = (await import('mermaid')).default as { render: jest.Mock };
    await render(WikiMermaid, { inputs: { chart: 'graph LR; A-->B' } });
    await flush();
    expect(mermaid.render).toHaveBeenCalledWith(
      expect.stringMatching(/^mermaid-/),
      'graph LR; A-->B',
    );
  });

  it('shows an error block when mermaid.render rejects', async () => {
    const mermaid = (await import('mermaid')).default as { render: jest.Mock };
    mermaid.render.mockRejectedValueOnce(new Error('Parse error on line 3'));
    await render(WikiMermaid, { inputs: { chart: 'not a diagram' } });
    await flush();
    expect(await screen.findByText(/Mermaid error: Parse error on line 3/i)).toBeInTheDocument();
  });
});
