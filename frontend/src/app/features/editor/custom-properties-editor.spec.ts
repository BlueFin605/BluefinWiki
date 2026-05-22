import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { CustomPropertiesEditor } from './custom-properties-editor';
import type { PageProperty, PageTypeDefinition } from '../pages/page.types';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function pageType(props: PageTypeDefinition['properties']): PageTypeDefinition {
  return {
    guid: 'pt-1',
    name: 'Test',
    icon: 'test',
    properties: props,
    allowedChildTypes: [],
    allowWikiPageChildren: true,
    allowedParentTypes: [],
    allowAnyParent: true,
    createdBy: '',
    createdAt: '',
    updatedAt: '',
  };
}

describe('CustomPropertiesEditor', () => {
  it('renders one input per schema property', async () => {
    await render(CustomPropertiesEditor, {
      inputs: {
        pageType: pageType([
          { name: 'author', type: 'string', required: false },
          { name: 'count', type: 'number', required: false },
        ]),
        properties: {},
      },
      providers: [provideAnimationsAsync()],
    });
    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/count/i)).toBeInTheDocument();
  });

  it('renders type-appropriate inputs', async () => {
    await render(CustomPropertiesEditor, {
      inputs: {
        pageType: pageType([
          { name: 'title', type: 'string', required: false },
          { name: 'qty', type: 'number', required: false },
          { name: 'when', type: 'date', required: false },
        ]),
        properties: {},
      },
      providers: [provideAnimationsAsync()],
    });
    const titleInput = screen.getByLabelText(/title/i);
    const qtyInput = screen.getByLabelText(/qty/i);
    const whenInput = screen.getByLabelText(/when/i);
    expect(titleInput.getAttribute('type')).toBe('text');
    expect(qtyInput.getAttribute('type')).toBe('number');
    expect(whenInput.getAttribute('type')).toBe('date');
  });

  it('emits propertiesChange when a string field is edited', async () => {
    const rendered = await render(CustomPropertiesEditor, {
      inputs: {
        pageType: pageType([{ name: 'author', type: 'string', required: false }]),
        properties: {},
      },
      providers: [provideAnimationsAsync()],
    });
    const emissions: Record<string, PageProperty>[] = [];
    rendered.fixture.componentInstance.propertiesChange.subscribe((p) => emissions.push(p));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/author/i), 'Ada');
    await settle();
    rendered.fixture.detectChanges();

    expect(emissions.length).toBeGreaterThan(0);
    const last = emissions[emissions.length - 1];
    expect(last['author']).toEqual({ type: 'string', value: 'Ada' });
  });

  it('disables every input when editable=false', async () => {
    await render(CustomPropertiesEditor, {
      inputs: {
        pageType: pageType([
          { name: 'a', type: 'string', required: false },
          { name: 'b', type: 'number', required: false },
        ]),
        properties: {},
        editable: false,
      },
      providers: [provideAnimationsAsync()],
    });
    const a = screen.getByLabelText(/^a$/i);
    const b = screen.getByLabelText(/^b$/i);
    expect(a).toBeDisabled();
    expect(b).toBeDisabled();
  });
});
