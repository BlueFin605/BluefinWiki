import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
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
});
