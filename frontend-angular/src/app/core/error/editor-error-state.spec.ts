import { TestBed } from '@angular/core/testing';
import { EditorErrorState } from './editor-error-state';

describe('EditorErrorState', () => {
  let state: EditorErrorState;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EditorErrorState] });
    state = TestBed.inject(EditorErrorState);
  });

  it('starts with a null error', () => {
    expect(state.current()).toBeNull();
  });

  it('setError exposes the message via current()', () => {
    state.setError('boom');
    expect(state.current()?.message).toBe('boom');
  });

  it('clear resets back to null', () => {
    state.setError('boom');
    state.clear();
    expect(state.current()).toBeNull();
  });

  it('exposes a version that bumps on each setError', () => {
    const initial = state.version();
    state.setError('a');
    expect(state.version()).toBeGreaterThan(initial);
    const after = state.version();
    state.setError('b');
    expect(state.version()).toBeGreaterThan(after);
  });
});
