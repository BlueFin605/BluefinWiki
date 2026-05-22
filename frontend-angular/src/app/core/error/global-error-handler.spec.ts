import { TestBed } from '@angular/core/testing';
import { MatSnackBar, type MatSnackBarRef } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { GlobalErrorHandler } from './global-error-handler';
import { EditorErrorState } from './editor-error-state';

describe('GlobalErrorHandler', () => {
  let snack: { open: jest.Mock };
  let actionSubject: Subject<void>;

  beforeEach(() => {
    actionSubject = new Subject<void>();
    const ref = { onAction: () => actionSubject.asObservable() } as Partial<MatSnackBarRef<unknown>>;
    snack = { open: jest.fn().mockReturnValue(ref) };
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: snack }, GlobalErrorHandler],
    });
  });

  it('logs and opens a snack-bar on handleError', () => {
    const handler = TestBed.inject(GlobalErrorHandler);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    handler.handleError(new Error('boom'));
    expect(spy).toHaveBeenCalled();
    expect(snack.open).toHaveBeenCalledWith(
      'Something went wrong — try again.',
      'Reload',
      expect.objectContaining({ duration: 6000 }),
    );
    spy.mockRestore();
  });

  it('sets EditorErrorState on handleError', () => {
    const handler = TestBed.inject(GlobalErrorHandler);
    const state = TestBed.inject(EditorErrorState);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    handler.handleError(new Error('kaboom'));
    expect(state.current()?.message).toBe('kaboom');
    spy.mockRestore();
  });
});
