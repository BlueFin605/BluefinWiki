import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CreatePageFromLinkModal, type CreatePageFromLinkResult } from './create-page-from-link-modal';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('CreatePageFromLinkModal', () => {
  it('prefills the title input from data.target', async () => {
    await render(CreatePageFromLinkModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { target: 'Missing Page', parentGuid: 'p1', originalTarget: 'Missing Page' },
        },
        { provide: MatDialogRef, useValue: { close: jest.fn() } },
      ],
    });
    const input = screen.getByLabelText(/title/i);
    expect((input as HTMLInputElement).value).toBe('Missing Page');
  });

  it('shows the warning copy referencing the missing target', async () => {
    await render(CreatePageFromLinkModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { target: 'Missing Page', parentGuid: 'p1', originalTarget: 'Missing Page' },
        },
        { provide: MatDialogRef, useValue: { close: jest.fn() } },
      ],
    });
    expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
  });

  it('defaults to the current page as parent, with the "will be created under" hint', async () => {
    await render(CreatePageFromLinkModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { target: 'New Topic', parentGuid: 'parent-1', originalTarget: 'New Topic' },
        },
        { provide: MatDialogRef, useValue: { close: jest.fn() } },
      ],
    });
    expect(screen.queryByRole('checkbox', { name: /create as root page/i })).not.toBeChecked();
    expect(screen.getByText(/will be created under the current page/i)).toBeInTheDocument();
  });

  it('the "Create as root page" checkbox hides the parent hint and selector', async () => {
    await render(CreatePageFromLinkModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { target: 'New Topic', parentGuid: 'parent-1', originalTarget: 'New Topic' },
        },
        { provide: MatDialogRef, useValue: { close: jest.fn() } },
      ],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /create as root page/i }));

    expect(screen.queryByText(/will be created under the current page/i)).not.toBeInTheDocument();
  });

  it('POSTs /api/pages with parentGuid from data and closes with { newGuid, linkText, originalTarget }', async () => {
    const calls: (CreatePageFromLinkResult | null)[] = [];
    const dialogRef = { close: (v: CreatePageFromLinkResult | null): void => { calls.push(v); } };
    await render(CreatePageFromLinkModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { target: 'New Topic', parentGuid: 'parent-1', originalTarget: 'Old Target' },
        },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /create/i }));

    const req = http.expectOne('/api/pages');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as { title: string; parentGuid: string | null };
    expect(body.title).toBe('New Topic');
    expect(body.parentGuid).toBe('parent-1');
    req.flush({
      guid: 'g-new',
      title: 'New Topic',
      content: '',
      folderId: 'f',
      tags: [],
      status: 'draft',
      createdBy: '',
      modifiedBy: '',
      createdAt: '',
      modifiedAt: '',
    });
    await settle();
    expect(calls).toEqual([{ newGuid: 'g-new', linkText: 'New Topic', originalTarget: 'Old Target' }]);
  });

  it('creating as root sends parentGuid: null', async () => {
    const calls: (CreatePageFromLinkResult | null)[] = [];
    const dialogRef = { close: (v: CreatePageFromLinkResult | null): void => { calls.push(v); } };
    await render(CreatePageFromLinkModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { target: 'New Topic', parentGuid: 'parent-1', originalTarget: 'New Topic' },
        },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /create as root page/i }));
    await user.click(screen.getByRole('button', { name: /create/i }));

    const req = http.expectOne('/api/pages');
    const body = req.request.body as { title: string; parentGuid: string | null };
    expect(body.parentGuid).toBeNull();
    req.flush({
      guid: 'g-root',
      title: 'New Topic',
      content: '',
      folderId: null,
      tags: [],
      status: 'draft',
      createdBy: '',
      modifiedBy: '',
      createdAt: '',
      modifiedAt: '',
    });
    await settle();
    expect(calls).toEqual([{ newGuid: 'g-root', linkText: 'New Topic', originalTarget: 'New Topic' }]);
  });

  it('disables Create when there is no current page and root is unchecked', async () => {
    await render(CreatePageFromLinkModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { target: 'New Topic', parentGuid: null, originalTarget: 'New Topic' },
        },
        { provide: MatDialogRef, useValue: { close: jest.fn() } },
      ],
    });
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });
});
