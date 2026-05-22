import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CreatePageFromLinkModal } from './create-page-from-link-modal';

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
        { provide: MAT_DIALOG_DATA, useValue: { target: 'Missing Page', parentGuid: 'p1' } },
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
        { provide: MAT_DIALOG_DATA, useValue: { target: 'Missing Page', parentGuid: 'p1' } },
        { provide: MatDialogRef, useValue: { close: jest.fn() } },
      ],
    });
    expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
  });

  it('POSTs /api/pages with parentGuid from data and closes with the new guid', async () => {
    const calls: (string | null)[] = [];
    const dialogRef = { close: (v: string | null): void => { calls.push(v); } };
    await render(CreatePageFromLinkModal, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { target: 'New Topic', parentGuid: 'parent-1' } },
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
    expect(calls).toEqual(['g-new']);
  });
});
