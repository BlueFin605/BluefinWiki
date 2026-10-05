import { TestBed } from '@angular/core/testing';

import { Realtime } from './realtime';
import { clientId } from './client-id';
import { InvalidationBus } from '../api/invalidation';
import { Auth } from '../auth/auth';
import { PageContext } from '../../features/pages/page-context';
import { provideBreakpointStub } from '../../testing/breakpoint-stub';
import { environment } from '../../../environments/environment';

class FakeWs {
  static instances: FakeWs[] = [];
  readyState = 0;
  onopen?: (() => void) | null;
  onmessage?: ((e: { data: string }) => void) | null;
  onclose?: (() => void) | null;
  onerror?: (() => void) | null;
  sent: string[] = [];
  constructor(public url: string) {
    FakeWs.instances.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  msg(o: unknown) {
    this.onmessage?.({ data: JSON.stringify(o) });
  }
}

type Env = { realtimeUrl: string; disableAuth: boolean };
const env = environment as unknown as Env;

const CATCH_UP = ['children:any', 'ancestors:any', 'page-types:list'];

describe('Realtime', () => {
  const originalUrl = environment.realtimeUrl;
  const originalDisableAuth = environment.disableAuth;
  const originalWs = globalThis.WebSocket;
  let hidden = false;
  let auth: { getIdToken: jest.Mock; refreshIdToken: jest.Mock };

  function setup(): { rt: Realtime; bus: InvalidationBus; ctx: PageContext; bump: jest.SpyInstance } {
    auth = {
      getIdToken: jest.fn(() => 'id-tok'),
      refreshIdToken: jest.fn(() => Promise.resolve<string | null>('fresh-tok')),
    };
    const bp = provideBreakpointStub(true);
    TestBed.configureTestingModule({
      providers: [...bp.providers, { provide: Auth, useValue: auth }],
    });
    const bus = TestBed.inject(InvalidationBus);
    return {
      rt: TestBed.inject(Realtime),
      bus,
      ctx: TestBed.inject(PageContext),
      bump: jest.spyOn(bus, 'bumpMany'),
    };
  }

  /** Let the async token lookup inside connect() settle. */
  const flush = () => jest.advanceTimersByTimeAsync(0);
  const last = () => FakeWs.instances[FakeWs.instances.length - 1];

  beforeEach(() => {
    jest.useFakeTimers();
    FakeWs.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWs;
    env.realtimeUrl = 'ws://x/ws';
    env.disableAuth = true;
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  });

  afterEach(() => {
    TestBed.inject(Realtime).stop();
    TestBed.resetTestingModule();
    jest.clearAllTimers();
    jest.useRealTimers();
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = originalWs;
    env.realtimeUrl = originalUrl;
    env.disableAuth = originalDisableAuth;
    delete (document as unknown as { hidden?: boolean }).hidden;
  });

  it('opens the socket with the token and bumps the tags of an invalidate message', async () => {
    const { rt, bump } = setup();
    rt.start();
    await flush();

    expect(FakeWs.instances).toHaveLength(1);
    expect(last().url).toBe('ws://x/ws?token=mock-jwt-token');
    last().open();
    last().msg({ type: 'invalidate', tags: ['children:any'], origin: 'other' });

    expect(bump).toHaveBeenCalledWith(['children:any']);
  });

  it('uses a refreshed Cognito id token when auth is enabled, URL-encoded', async () => {
    env.disableAuth = false;
    const { rt } = setup();
    auth.refreshIdToken.mockResolvedValue('a+b/c');
    rt.start();
    await flush();

    expect(last().url).toBe('ws://x/ws?token=a%2Bb%2Fc');
  });

  it('with no token, skips connecting and retries on the backoff', async () => {
    env.disableAuth = false;
    const { rt } = setup();
    auth.refreshIdToken.mockResolvedValue(null);
    rt.start();
    await flush();
    expect(FakeWs.instances).toHaveLength(0);

    auth.refreshIdToken.mockResolvedValue('t');
    await jest.advanceTimersByTimeAsync(1000);
    expect(FakeWs.instances).toHaveLength(1);
  });

  it('applies a message with no origin field (e.g. an MCP write)', async () => {
    const { rt, bump } = setup();
    rt.start();
    await flush();
    last().open();
    last().msg({ type: 'invalidate', tags: ['page:g', 'children:any'] });

    expect(bump).toHaveBeenCalledWith(['page:g', 'children:any']);
  });

  it("ignores this tab's own echoes", async () => {
    const { rt, bump } = setup();
    rt.start();
    await flush();
    last().open();
    last().msg({ type: 'invalidate', tags: ['children:any'], origin: clientId() });

    expect(bump).not.toHaveBeenCalled();
  });

  it('ignores malformed and non-invalidate messages', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { rt, bump } = setup();
    rt.start();
    await flush();
    last().open();
    last().onmessage?.({ data: 'not json' });
    last().msg({ type: 'pong' });
    last().msg({ type: 'invalidate', tags: 'page:g' });
    last().msg({ type: 'invalidate', tags: [], origin: 'other' });

    expect(bump).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('holds back page:<guid> for a dirty page being edited and flags remoteChange', async () => {
    const { rt, ctx, bump } = setup();
    ctx.guid.set('g');
    ctx.mode.set('edit');
    ctx.dirty.set(true);
    rt.start();
    await flush();
    last().open();
    last().msg({ type: 'invalidate', tags: ['page:g', 'children:any'], origin: 'other' });

    expect(bump).toHaveBeenCalledWith(['children:any']);
    expect(ctx.remoteChange()).toBe(true);
  });

  it('does not hold back when the edited page is clean', async () => {
    const { rt, ctx, bump } = setup();
    ctx.guid.set('g');
    ctx.mode.set('edit');
    ctx.dirty.set(false);
    rt.start();
    await flush();
    last().open();
    last().msg({ type: 'invalidate', tags: ['page:g', 'children:any'], origin: 'other' });

    expect(bump).toHaveBeenCalledWith(['page:g', 'children:any']);
    expect(ctx.remoteChange()).toBe(false);
  });

  it('does not flag remoteChange when only other pages changed', async () => {
    const { rt, ctx, bump } = setup();
    ctx.guid.set('g');
    ctx.mode.set('edit');
    ctx.dirty.set(true);
    rt.start();
    await flush();
    last().open();
    last().msg({ type: 'invalidate', tags: ['page:other'], origin: 'other' });

    expect(bump).toHaveBeenCalledWith(['page:other']);
    expect(ctx.remoteChange()).toBe(false);
  });

  it('flags remoteChange without bumping when the only tag is the held-back page', async () => {
    const { rt, ctx, bump } = setup();
    ctx.guid.set('g');
    ctx.mode.set('edit');
    ctx.dirty.set(true);
    rt.start();
    await flush();
    last().open();
    last().msg({ type: 'invalidate', tags: ['page:g'], origin: 'other' });

    expect(bump).not.toHaveBeenCalled();
    expect(ctx.remoteChange()).toBe(true);
  });

  it('reconnects with exponential backoff capped at 30 s, reset after a successful open', async () => {
    const { rt } = setup();
    rt.start();
    await flush();
    last().open();

    last().close(); // server drop
    await jest.advanceTimersByTimeAsync(999);
    expect(FakeWs.instances).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(FakeWs.instances).toHaveLength(2);

    last().close(); // failed attempt (never opened)
    await jest.advanceTimersByTimeAsync(1999);
    expect(FakeWs.instances).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(FakeWs.instances).toHaveLength(3);

    // 4 s, 8 s, 16 s, then capped at 30 s
    for (const d of [4000, 8000, 16000, 30000, 30000]) {
      const n = FakeWs.instances.length;
      last().close();
      await jest.advanceTimersByTimeAsync(d - 1);
      expect(FakeWs.instances).toHaveLength(n);
      await jest.advanceTimersByTimeAsync(1);
      expect(FakeWs.instances).toHaveLength(n + 1);
    }

    // a successful open resets the backoff to 1 s
    last().open();
    const n = FakeWs.instances.length;
    last().close();
    await jest.advanceTimersByTimeAsync(1000);
    expect(FakeWs.instances).toHaveLength(n + 1);
  });

  it('catches up only after a reopen, including page:<guid> for an open page', async () => {
    const { rt, ctx, bump } = setup();
    ctx.guid.set('g');
    rt.start();
    await flush();
    last().open();
    expect(bump).not.toHaveBeenCalled(); // first open: nothing missed

    last().close();
    await jest.advanceTimersByTimeAsync(1000);
    last().open();

    expect(bump).toHaveBeenCalledTimes(1);
    expect(bump).toHaveBeenCalledWith([...CATCH_UP, 'page:g']);
  });

  it('catch-up ALWAYS bumps page:<guid>, even for a dirty page being edited', async () => {
    const { rt, ctx, bump } = setup();
    rt.start();
    await flush();
    last().open();
    ctx.guid.set('g');
    ctx.mode.set('edit');
    ctx.dirty.set(true);

    last().close();
    await jest.advanceTimersByTimeAsync(1000);
    last().open();

    // Messages for g may have been missed while disconnected, so holding the
    // refetch back would hide them. page-detail compares modifiedAt on the
    // re-resolve and raises the banner itself; catch-up never sets it.
    expect(bump).toHaveBeenCalledWith([...CATCH_UP, 'page:g']);
    expect(ctx.remoteChange()).toBe(false);
  });

  it('catch-up with no page open bumps only the coarse tags', async () => {
    const { rt, bump } = setup();
    rt.start();
    await flush();
    last().open();
    last().close();
    await jest.advanceTimersByTimeAsync(1000);
    last().open();

    expect(bump).toHaveBeenCalledWith(CATCH_UP);
  });

  it('sends a ping every 5 minutes while open, and stops pinging once closed', async () => {
    const { rt } = setup();
    rt.start();
    await flush();
    const ws = last();
    await jest.advanceTimersByTimeAsync(300000);
    expect(ws.sent).toEqual([]); // not open yet

    ws.open();
    await jest.advanceTimersByTimeAsync(300000);
    expect(ws.sent).toEqual(['{"type":"ping"}']);
    await jest.advanceTimersByTimeAsync(300000);
    expect(ws.sent).toHaveLength(2);

    rt.stop();
    await jest.advanceTimersByTimeAsync(600000);
    expect(ws.sent).toHaveLength(2);
  });

  it('stop() closes the socket and never reconnects', async () => {
    const { rt } = setup();
    rt.start();
    await flush();
    const ws = last();
    ws.open();

    rt.stop();
    expect(ws.readyState).toBe(3);
    await jest.advanceTimersByTimeAsync(120000);
    expect(FakeWs.instances).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stop() during a pending reconnect cancels it', async () => {
    const { rt } = setup();
    rt.start();
    await flush();
    last().open();
    last().close();

    rt.stop();
    await jest.advanceTimersByTimeAsync(60000);
    expect(FakeWs.instances).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stop() while the token is still resolving opens no socket', async () => {
    env.disableAuth = false;
    const { rt } = setup();
    rt.start();
    rt.stop();
    await flush();

    expect(FakeWs.instances).toHaveLength(0);
  });

  it('start() twice opens only one socket', async () => {
    const { rt } = setup();
    rt.start();
    rt.start();
    await flush();

    expect(FakeWs.instances).toHaveLength(1);
  });

  it('can start again after stop()', async () => {
    const { rt } = setup();
    rt.start();
    await flush();
    rt.stop();
    rt.start();
    await flush();

    expect(FakeWs.instances).toHaveLength(2);
  });

  it('does nothing when realtimeUrl is empty', async () => {
    env.realtimeUrl = '';
    const { rt } = setup();
    const add = jest.spyOn(document, 'addEventListener');
    rt.start();
    await jest.advanceTimersByTimeAsync(60000);

    expect(FakeWs.instances).toHaveLength(0);
    expect(add).not.toHaveBeenCalledWith('visibilitychange', expect.anything());
    expect(jest.getTimerCount()).toBe(0);
    add.mockRestore();
  });

  it('resolves a relative realtimeUrl against location', async () => {
    env.realtimeUrl = '/ws';
    const { rt } = setup();
    rt.start();
    await flush();

    expect(last().url).toBe('ws://localhost/ws?token=mock-jwt-token');
  });

  it('closes while the tab is hidden and reopens with a catch-up when visible', async () => {
    const { rt, bump } = setup();
    rt.start();
    await flush();
    const ws = last();
    ws.open();

    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ws.readyState).toBe(3);
    await jest.advanceTimersByTimeAsync(120000);
    expect(FakeWs.instances).toHaveLength(1);

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(FakeWs.instances).toHaveLength(2);
    last().open();
    expect(bump).toHaveBeenCalledWith(CATCH_UP);
  });

  it('does not connect while started hidden, and connects once visible', async () => {
    hidden = true;
    const { rt } = setup();
    rt.start();
    await flush();
    expect(FakeWs.instances).toHaveLength(0);

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(FakeWs.instances).toHaveLength(1);
  });

  it('stop() removes the visibility listener', async () => {
    const { rt } = setup();
    rt.start();
    await flush();
    rt.stop();

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(FakeWs.instances).toHaveLength(1);
  });
});
