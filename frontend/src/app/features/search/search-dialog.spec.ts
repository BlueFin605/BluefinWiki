import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Component } from '@angular/core';

import { SearchDialog } from './search-dialog';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

interface DialogRefStub {
  close: jest.Mock;
}

function makeDialogRef(): DialogRefStub {
  return { close: jest.fn() };
}

function baseProviders(dialogRef: DialogRefStub) {
  return [
    provideNoopAnimations(),
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([{ path: 'pages/:guid', component: NoopPage }]),
    { provide: MatDialogRef, useValue: dialogRef },
  ];
}

@Component({ standalone: true, template: '' })
class NoopPage {}

/** Renders the dialog, types a query, and flushes a fixed 3-result response. */
async function seedThreeResults(dialogRef: DialogRefStub): Promise<{
  input: HTMLElement;
  http: HttpTestingController;
}> {
  await render(SearchDialog, { providers: baseProviders(dialogRef) });
  const http = TestBed.inject(HttpTestingController);
  const input = screen.getByPlaceholderText(/search wiki/i);
  const user = userEvent.setup();
  await user.type(input, 'thing');
  await wait(260);
  await settle();

  http.expectOne((r) => r.url === '/api/search').flush({
    results: [
      { pageId: 'g1', title: 'One', snippet: '', relevanceScore: 900, matchCount: 0, path: 'p1', tags: [] },
      { pageId: 'g2', title: 'Two', snippet: '', relevanceScore: 800, matchCount: 0, path: 'p2', tags: [] },
      { pageId: 'g3', title: 'Three', snippet: '', relevanceScore: 700, matchCount: 0, path: 'p3', tags: [] },
    ],
    totalResults: 3,
    executionTimeMs: 2,
  });
  await settle();
  await screen.findByText('One');

  return { input, http };
}

describe('SearchDialog', () => {
  it('renders an input and an empty state when nothing has been typed', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    expect(
      screen.getByPlaceholderText(/search wiki/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/start typing/i)).toBeInTheDocument();
  });

  it('debounces input and sends a search request after the user stops typing', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    const http = TestBed.inject(HttpTestingController);

    const input = screen.getByPlaceholderText(/search wiki/i);
    const user = userEvent.setup();
    await user.type(input, 'recipe');

    // Wait for debounce (200ms) + microtasks
    await wait(260);
    await settle();

    const req = http.expectOne(
      (r) => r.url === '/api/search' && r.params.get('q') === 'recipe',
    );
    req.flush({
      results: [
        {
          pageId: 'p1',
          title: 'Family Recipes',
          snippet: 'pasta',
          relevanceScore: 900,
          matchCount: 0,
          path: 'Cooking > Family Recipes',
          tags: ['recipe'],
        },
      ],
      totalResults: 1,
      executionTimeMs: 9,
    });
    await settle();

    expect(await screen.findByText('Family Recipes')).toBeInTheDocument();
    expect(screen.getByText(/pasta/i)).toBeInTheDocument();
  });

  it('changes the scope query when the toggle is switched', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    const http = TestBed.inject(HttpTestingController);

    const input = screen.getByPlaceholderText(/search wiki/i);
    const user = userEvent.setup();
    await user.type(input, 'cook');
    await wait(260);
    await settle();
    http
      .expectOne((r) => r.url === '/api/search' && r.params.get('scope') === 'all')
      .flush({ results: [], totalResults: 0, executionTimeMs: 1 });
    await settle();

    // Switch to "Titles" scope.
    const titlesToggle = screen.getByRole('radio', { name: /titles/i });
    await user.click(titlesToggle);
    await wait(260);
    await settle();

    const req = http.expectOne(
      (r) => r.url === '/api/search' && r.params.get('scope') === 'titles',
    );
    req.flush({ results: [], totalResults: 0, executionTimeMs: 1 });
    await settle();
    expect(req.request.params.get('q')).toBe('cook');
  });

  it('does not hit the API when the input is blank', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    const http = TestBed.inject(HttpTestingController);

    await wait(260);
    await settle();
    http.verify(); // no requests
    expect(screen.getByText(/start typing/i)).toBeInTheDocument();
  });

  it('navigates and closes when a result is clicked', async () => {
    const dialogRef = makeDialogRef();
    await render(SearchDialog, { providers: baseProviders(dialogRef) });
    const router = TestBed.inject(Router);
    const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const http = TestBed.inject(HttpTestingController);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search wiki/i), 'thing');
    await wait(260);
    await settle();

    http
      .expectOne((r) => r.url === '/api/search')
      .flush({
        results: [
          {
            pageId: 'guid-42',
            title: 'The Thing',
            snippet: '',
            relevanceScore: 800,
            matchCount: 0,
            path: 'Root > Thing',
            tags: [],
          },
        ],
        totalResults: 1,
        executionTimeMs: 2,
      });
    await settle();

    const result = await screen.findByRole('option', { name: /the thing/i });
    await user.click(result);
    await settle();

    expect(navSpy).toHaveBeenCalledWith(['/pages', 'guid-42']);
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('ArrowDown/ArrowUp move the highlighted row and update aria-selected + aria-activedescendant', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    let options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('id', 'search-result-0');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-0');
    // Visual indicator, not just the ARIA attribute — a sighted user must see
    // which row is highlighted before pressing Enter.
    expect(options[0]).toHaveClass('selected');
    expect(options[1]).not.toHaveClass('selected');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-1');
    expect(options[0]).not.toHaveClass('selected');
    expect(options[1]).toHaveClass('selected');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    await settle();
    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-0');
    expect(options[0]).toHaveClass('selected');
  });

  it('ArrowUp at the top and ArrowDown at the bottom clamp instead of wrapping', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-0');

    fireEvent.keyDown(input, { key: 'End' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-2');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-2');
  });

  it('Home/End jump to the first/last result', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);

    fireEvent.keyDown(input, { key: 'End' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-2');

    fireEvent.keyDown(input, { key: 'Home' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-0');
  });

  it('Enter navigates to the highlighted result and closes the dialog', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);
    const router = TestBed.inject(Router);
    const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();

    expect(navSpy).toHaveBeenCalledWith(['/pages', 'g2']);
    expect(dialogRef.close).toHaveBeenCalledWith('g2');
  });

  it('Ctrl/Cmd+Enter opens the highlighted result in a new tab and leaves the dialog open', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const router = TestBed.inject(Router);
    const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await settle();

    expect(openSpy).toHaveBeenCalledWith('/pages/g1', '_blank');
    expect(navSpy).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    await settle();

    expect(openSpy).toHaveBeenCalledWith('/pages/g2', '_blank');
    expect(dialogRef.close).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it('hovering a row sets it as the current selection', async () => {
    const dialogRef = makeDialogRef();
    await seedThreeResults(dialogRef);

    const options = screen.getAllByRole('option');
    fireEvent.mouseEnter(options[2]);
    await settle();

    expect(options[2]).toHaveAttribute('aria-selected', 'true');
    expect(options[2]).toHaveClass('selected');
    expect(screen.getByPlaceholderText(/search wiki/i)).toHaveAttribute(
      'aria-activedescendant',
      'search-result-2',
    );
  });

  it('scrolls the selected row into view', async () => {
    const dialogRef = makeDialogRef();
    const { input } = await seedThreeResults(dialogRef);
    const scrollSpy = jest.fn();
    for (const option of screen.getAllByRole('option')) {
      option.scrollIntoView = scrollSpy;
    }

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();

    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('resets the selection when the result list changes', async () => {
    const dialogRef = makeDialogRef();
    const { input, http } = await seedThreeResults(dialogRef);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await settle();
    expect(input).toHaveAttribute('aria-activedescendant', 'search-result-1');

    const user = userEvent.setup();
    await user.type(input, ' else');
    await wait(260);
    await settle();
    http
      .expectOne((r) => r.url === '/api/search' && r.params.get('q') === 'thing else')
      .flush({
        results: [
          { pageId: 'g9', title: 'Fresh', snippet: '', relevanceScore: 900, matchCount: 0, path: 'p9', tags: [] },
        ],
        totalResults: 1,
        executionTimeMs: 1,
      });
    await settle();
    await screen.findByText('Fresh');

    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});
