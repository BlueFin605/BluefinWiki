import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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

interface RenderOpts {
  schema?: PageTypeDefinition['properties'];
  properties?: Record<string, PageProperty>;
  editable?: boolean;
  /** Render an untyped page: `pageType` bound to `null` (empty schema). */
  untyped?: boolean;
  /** Tag-vocabulary scopes expected to be fetched, each flushed with `[]`. */
  tagScopes?: string[];
}

async function renderEditor(opts: RenderOpts = {}) {
  const result = await render(CustomPropertiesEditor, {
    inputs: {
      pageType: opts.untyped ? null : pageType(opts.schema ?? []),
      properties: opts.properties ?? {},
      editable: opts.editable ?? true,
    },
    providers: [
      provideAnimationsAsync(),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  for (const scope of opts.tagScopes ?? []) {
    http.expectOne(`/api/tags?scope=${scope}`).flush({ tags: [], scope });
  }
  await settle();
  result.fixture.detectChanges();

  const emissions: Record<string, PageProperty>[] = [];
  result.fixture.componentInstance.propertiesChange.subscribe((p) => emissions.push(p));
  const last = () => emissions[emissions.length - 1];
  return { ...result, http, emissions, last };
}

describe('CustomPropertiesEditor', () => {
  // ---- existing behaviour (schema field rendering / editing) --------------

  it('renders one input per schema property', async () => {
    await renderEditor({
      schema: [
        { name: 'author', type: 'string', required: false },
        { name: 'count', type: 'number', required: false },
      ],
    });
    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/count/i)).toBeInTheDocument();
  });

  it('renders type-appropriate inputs', async () => {
    await renderEditor({
      schema: [
        { name: 'title', type: 'string', required: false },
        { name: 'qty', type: 'number', required: false },
        { name: 'when', type: 'date', required: false },
      ],
    });
    expect(screen.getByLabelText(/title/i).getAttribute('type')).toBe('text');
    expect(screen.getByLabelText(/qty/i).getAttribute('type')).toBe('number');
    expect(screen.getByLabelText(/when/i).getAttribute('type')).toBe('date');
  });

  it('emits propertiesChange when a string field is edited', async () => {
    const { fixture, last } = await renderEditor({
      schema: [{ name: 'author', type: 'string', required: false }],
    });

    await userEvent.type(screen.getByLabelText(/author/i), 'Ada');
    await settle();
    fixture.detectChanges();

    expect(last()['author']).toEqual({ type: 'string', value: 'Ada' });
  });

  it('disables every input when editable=false', async () => {
    await renderEditor({
      schema: [
        { name: 'a', type: 'string', required: false },
        { name: 'b', type: 'number', required: false },
      ],
      editable: false,
    });
    expect(screen.getByLabelText(/^a$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^b$/i)).toBeDisabled();
  });

  // ---- step 4.7: collapsible section -------------------------------------

  it('collapses and expands the section', async () => {
    await renderEditor({ schema: [{ name: 'author', type: 'string', required: false }] });

    const toggle = screen.getByRole('button', { name: /custom properties/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();

    await userEvent.click(toggle);
    await settle();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText(/author/i)).toBeNull();

    await userEvent.click(toggle);
    await settle();
    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
  });

  // ---- step 4.7: schema fields are fixed (no remove) -------------------

  it('shows no remove button for a schema-defined property', async () => {
    await renderEditor({ schema: [{ name: 'author', type: 'string', required: false }] });
    expect(screen.queryByRole('button', { name: /remove author/i })).toBeNull();
  });

  // ---- step 4.7: add an ad-hoc property --------------------------------

  it('adds an ad-hoc "release-year" of type Number: numeric input + emitted properties', async () => {
    const { fixture, last, emissions } = await renderEditor({
      schema: [{ name: 'author', type: 'string', required: false }],
    });

    await userEvent.type(screen.getByPlaceholderText(/new property name/i), 'release-year');
    // mat-select for the type
    await userEvent.click(screen.getByRole('combobox', { name: /new property type/i }));
    await settle();
    await userEvent.click(screen.getByRole('option', { name: 'Number' }));
    await settle();
    await userEvent.click(screen.getByRole('button', { name: /^add property$/i }));
    await settle();
    fixture.detectChanges();

    expect(emissions.length).toBe(1);
    expect(last()['release-year']).toEqual({ type: 'number', value: '' });

    // Re-render with the new prop merged in (host would echo it back).
    fixture.componentRef.setInput('properties', last());
    fixture.detectChanges();
    await settle();
    // Exact match: the ad-hoc row's remove button also carries "release-year".
    expect(screen.getByLabelText('release-year').getAttribute('type')).toBe('number');
  });

  // ---- step 4.7: remove an ad-hoc property ----------------------------

  it('removes an ad-hoc property and drops it from the emitted set', async () => {
    const { last } = await renderEditor({
      schema: [{ name: 'author', type: 'string', required: false }],
      properties: { 'release-year': { type: 'number', value: 1998 } },
    });

    const removeBtn = screen.getByRole('button', { name: /remove release-year/i });
    await userEvent.click(removeBtn);
    await settle();

    expect(last()).toEqual({});
    expect('release-year' in last()).toBe(false);
  });

  // ---- step 4.7: name validation -------------------------------------

  it('rejects a blank name with a visible message and no emission', async () => {
    const { emissions } = await renderEditor({
      schema: [{ name: 'author', type: 'string', required: false }],
    });
    await userEvent.click(screen.getByRole('button', { name: /^add property$/i }));
    await settle();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(emissions.length).toBe(0);
  });

  it('rejects a non-kebab name with a visible message', async () => {
    const { emissions } = await renderEditor({
      schema: [{ name: 'author', type: 'string', required: false }],
    });
    await userEvent.type(screen.getByPlaceholderText(/new property name/i), 'Release Year');
    await userEvent.click(screen.getByRole('button', { name: /^add property$/i }));
    await settle();
    expect(screen.getByRole('alert').textContent).toMatch(/kebab/i);
    expect(emissions.length).toBe(0);
  });

  it('clears the validation error as soon as the user corrects the name', async () => {
    const { emissions } = await renderEditor({
      schema: [{ name: 'author', type: 'string', required: false }],
    });
    await userEvent.click(screen.getByRole('button', { name: /^add property$/i }));
    await settle();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/new property name/i), 'r');
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(emissions.length).toBe(0);
  });

  it('rejects a name that duplicates an existing property key', async () => {
    const { emissions } = await renderEditor({
      schema: [{ name: 'author', type: 'string', required: false }],
    });
    await userEvent.type(screen.getByPlaceholderText(/new property name/i), 'author');
    await userEvent.click(screen.getByRole('button', { name: /^add property$/i }));
    await settle();
    expect(screen.getByRole('alert').textContent).toMatch(/exists/i);
    expect(emissions.length).toBe(0);
  });

  // ---- step 4.7: tags property uses the chip input --------------------

  it('renders a Tags property with the vocab chip input, not comma text', async () => {
    await renderEditor({
      schema: [{ name: 'genre', type: 'tags', required: false }],
      tagScopes: ['genre'],
    });

    // The reusable wiki-tag-input chip control is present...
    expect(screen.getByPlaceholderText('Add tag')).toBeInTheDocument();
    // ...and the old plain comma-separated text input is gone.
    expect(screen.queryByPlaceholderText(/comma/i)).toBeNull();
  });

  it('edits a tags property through the chip input into the emitted set', async () => {
    const { last, emissions } = await renderEditor({
      schema: [{ name: 'genre', type: 'tags', required: false }],
      tagScopes: ['genre'],
    });

    const chipInput = screen.getByPlaceholderText('Add tag');
    chipInput.focus();
    await userEvent.type(chipInput, 'jazz');
    chipInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }),
    );
    await settle();

    expect(emissions.length).toBeGreaterThan(0);
    expect(last()['genre']).toEqual({ type: 'tags', value: ['jazz'] });
  });

  it('fetches one tag vocabulary per tags-type property, scoped by the property name', async () => {
    const { http } = await renderEditor({
      schema: [
        { name: 'genre', type: 'tags', required: false },
        { name: 'mood', type: 'tags', required: false },
      ],
      tagScopes: ['genre', 'mood'],
    });
    // Both scoped vocab endpoints were requested and already drained by the helper.
    http.verify();
  });

  it('does not refetch tag vocabularies when an unrelated field is edited', async () => {
    const { fixture, http } = await renderEditor({
      schema: [
        { name: 'author', type: 'string', required: false },
        { name: 'genre', type: 'tags', required: false },
      ],
      tagScopes: ['genre'],
    });
    // Mirror the inspector: every emission is echoed straight back into the
    // `properties` input with no debounce, so `rows()` recomputes per keystroke.
    fixture.componentInstance.propertiesChange.subscribe((p) =>
      fixture.componentRef.setInput('properties', p),
    );

    await userEvent.type(screen.getByLabelText(/author/i), 'abc');
    await settle();
    fixture.detectChanges();
    await settle();

    // No further GET /api/tags?scope=... beyond the one drained on mount.
    expect(http.match((r) => r.url === '/api/tags').length).toBe(0);
  });

  // ---- C1: untyped pages reach the Custom Properties editor ------------

  it('renders the Custom Properties section for an untyped page (pageType=null)', async () => {
    await renderEditor({ untyped: true });
    expect(
      screen.getByRole('button', { name: /custom properties/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    // The add-ad-hoc form is available with no schema at all.
    expect(screen.getByPlaceholderText(/new property name/i)).toBeInTheDocument();
  });

  it('adds then removes an ad-hoc property on an untyped page', async () => {
    const { fixture, last, emissions } = await renderEditor({ untyped: true });

    await userEvent.type(screen.getByPlaceholderText(/new property name/i), 'release-year');
    await userEvent.click(screen.getByRole('button', { name: /^add property$/i }));
    await settle();
    fixture.detectChanges();

    expect(emissions.length).toBe(1);
    expect(last()['release-year']).toEqual({ type: 'string', value: '' });

    // Host echoes the new prop back into the input.
    fixture.componentRef.setInput('properties', last());
    fixture.detectChanges();
    await settle();

    // The ad-hoc row renders and carries a remove button (nothing is schema-fixed).
    const removeBtn = screen.getByRole('button', { name: /remove release-year/i });
    await userEvent.click(removeBtn);
    await settle();

    expect(last()).toEqual({});
    expect('release-year' in last()).toBe(false);
  });

  it('keeps the label of a schema tags property distinct from an ad-hoc one', async () => {
    await renderEditor({
      schema: [{ name: 'genre', type: 'tags', required: false }],
      properties: { platform: { type: 'string', value: 'pc' } },
      tagScopes: ['genre'],
    });
    // ad-hoc string prop still removable
    expect(screen.getByRole('button', { name: /remove platform/i })).toBeInTheDocument();
    // schema tags prop not removable
    expect(screen.queryByRole('button', { name: /remove genre/i })).toBeNull();
    // the tags row is labelled with the property name
    expect(within(document.body).getByText('genre')).toBeInTheDocument();
  });
});
