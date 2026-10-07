import { Injectable, inject, untracked } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  InvalidationBus,
  ancestorsAnyTag,
  childrenAnyTag,
  pageTag,
  pageTypesListTag,
} from '../api/invalidation';
import { Auth } from '../auth/auth';
import { PageContext } from '../../features/pages/page-context';
import { PageUpsert } from '../../features/pages/page.types';
import { clientId } from './client-id';
import { PageUpserts } from './page-upserts';

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
/** Keeps API Gateway's 10-minute idle timeout from dropping a quiet socket. */
const PING_MS = 300000;
/** A first open later than this after start() may have missed writes: catch up. */
const SLOW_FIRST_OPEN_MS = 3000;

/**
 * Live invalidation over a WebSocket.
 *
 * The server pushes `{type:'invalidate', tags, origin}` after most writes; this
 * bumps those tags on the {@link InvalidationBus} so the matching resources
 * refetch. A visible page save arrives as `{type:'upsert', pages, tags, origin}`
 * instead: the page summaries go out on {@link PageUpserts} for lists to patch
 * in place, and only `page:<guid>` of each (for open page bodies) plus the
 * extra `tags` are bumped. Messages whose `origin` is this tab's
 * {@link clientId} are echoes of our own writes (already applied locally) and
 * are dropped.
 *
 * Hold-back: while the open page is in edit mode with unsaved changes
 * (`PageContext.dirty`), its `page:<guid>` tag is NOT bumped — a refetch would
 * replace the working copy under the user. `PageContext.remoteChange` is set
 * instead, and page-detail offers Reload / Dismiss. The hold-back applies to
 * live messages only — the reconnect catch-up deliberately ignores it (see
 * below and {@link catchUp}).
 *
 * Connection: reconnects with exponential backoff (1 s doubling, 30 s cap,
 * reset on open); closes while the tab is hidden and reopens when visible.
 * After any REopen (or a first open slower than 3 s, e.g. a cold start) it
 * bumps coarse catch-up tags plus the open page, since messages sent while
 * disconnected are lost. The open page is bumped even
 * while held back: page-detail keeps a dirty working copy through that
 * refetch and raises the banner itself when `modifiedAt` moved. No UI —
 * failures only `console.warn`. With an empty `environment.realtimeUrl` it
 * does nothing at all.
 */
@Injectable({ providedIn: 'root' })
export class Realtime {
  private readonly bus = inject(InvalidationBus);
  private readonly auth = inject(Auth);
  private readonly ctx = inject(PageContext);
  private readonly upserts = inject(PageUpserts);

  private started = false;
  private ws: WebSocket | null = null;
  private attempt = 0;
  /** Set after the first successful open; any later open runs catch-up. */
  private opened = false;
  /** When start() ran; a slow first open (cold start) catches up too. */
  private startedAt = 0;
  /** Bumped on every intentional teardown so an in-flight connect() bails. */
  private generation = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      this.teardown();
    } else if (!this.ws && this.reconnectTimer === null) {
      this.attempt = 0;
      void this.connect();
    }
  };

  start(): void {
    if (this.started || !environment.realtimeUrl) return;
    this.started = true;
    this.attempt = 0;
    this.opened = false;
    this.startedAt = Date.now();
    document.addEventListener('visibilitychange', this.onVisibility);
    if (!document.hidden) void this.connect();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.teardown();
  }

  /** Close the socket and cancel timers without scheduling a reconnect. */
  private teardown(): void {
    this.generation++;
    this.clearReconnect();
    this.clearPing();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        // already closed
      }
    }
  }

  private async connect(): Promise<void> {
    const gen = this.generation;
    let token: string | null;
    try {
      token = environment.disableAuth ? 'mock-jwt-token' : await this.auth.refreshIdToken();
    } catch {
      token = null;
    }
    if (gen !== this.generation || !this.started) return;
    if (!token) {
      this.scheduleReconnect();
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsUrl(environment.realtimeUrl)}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.warn('[realtime] connect failed', err);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => this.handleOpen();
    ws.onmessage = (e: MessageEvent | { data: string }) => this.handleMessage(e.data);
    ws.onclose = () => this.handleClose(ws);
  }

  private handleOpen(): void {
    this.attempt = 0;
    this.clearPing();
    this.pingTimer = setInterval(() => {
      try {
        this.ws?.send(JSON.stringify({ type: 'ping' }));
      } catch (err) {
        console.warn('[realtime] ping failed', err);
      }
    }, PING_MS);
    if (this.opened || Date.now() - this.startedAt > SLOW_FIRST_OPEN_MS) this.catchUp();
    this.opened = true;
  }

  private handleClose(ws: WebSocket): void {
    if (this.ws !== ws) return;
    this.ws = null;
    this.clearPing();
    this.scheduleReconnect();
  }

  private handleMessage(data: unknown): void {
    let msg: unknown;
    try {
      msg = JSON.parse(String(data));
    } catch (err) {
      console.warn('[realtime] bad message', err);
      return;
    }
    if (isUpsertType(msg) && !isUpsert(msg)) {
      console.warn('[realtime] malformed upsert', msg);
      return;
    }
    if (!(isInvalidate(msg) || isUpsert(msg)) || msg.origin === clientId()) return;
    untracked(() => {
      if (msg.type === 'upsert') {
        this.upserts.emit(msg.pages, 'remote');
        this.bumpTags([...msg.pages.map((p) => pageTag(p.guid)), ...msg.tags]);
      } else {
        this.bumpTags(msg.tags);
      }
    });
  }

  /** Bump `tags`, holding back the open dirty page's tag (see class doc). */
  private bumpTags(tags: string[]): void {
    const held = this.heldBackTag();
    let rest = tags;
    if (held !== null && rest.includes(held)) {
      rest = rest.filter((t) => t !== held);
      this.ctx.remoteChange.set(true);
    }
    if (rest.length > 0) this.bus.bumpMany(rest);
  }

  /**
   * Messages may have been missed while disconnected: refetch the broad views
   * and the open page. The open page is bumped even while it is held back —
   * a missed change to it would otherwise go unseen and a Save would silently
   * overwrite it. page-detail keeps a dirty working copy through that refetch
   * and raises `remoteChange` itself when the server `modifiedAt` moved.
   */
  private catchUp(): void {
    untracked(() => {
      const tags = [childrenAnyTag(), ancestorsAnyTag(), pageTypesListTag()];
      const guid = this.ctx.guid();
      if (guid !== null) tags.push(pageTag(guid));
      this.bus.bumpMany(tags);
    });
  }

  /** `page:<guid>` of the open page while it is being edited with unsaved changes. */
  private heldBackTag(): string | null {
    const guid = this.ctx.guid();
    return guid !== null && this.ctx.mode() === 'edit' && this.ctx.dirty() ? pageTag(guid) : null;
  }

  private scheduleReconnect(): void {
    if (!this.started) return;
    this.clearReconnect();
    const delay = Math.min(BASE_DELAY_MS * 2 ** this.attempt, MAX_DELAY_MS);
    this.attempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

interface InvalidateMessage {
  type: 'invalidate';
  tags: string[];
  origin?: string;
}

interface UpsertMessage {
  type: 'upsert';
  pages: PageUpsert[];
  tags: string[];
  origin?: string;
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((t) => typeof t === 'string');

function isInvalidate(m: unknown): m is InvalidateMessage {
  if (typeof m !== 'object' || m === null) return false;
  const o = m as Record<string, unknown>;
  return o['type'] === 'invalidate' && isStringArray(o['tags']);
}

function isUpsertType(m: unknown): boolean {
  return typeof m === 'object' && m !== null && (m as Record<string, unknown>)['type'] === 'upsert';
}

function isUpsert(m: unknown): m is UpsertMessage {
  if (!isUpsertType(m)) return false;
  const o = m as Record<string, unknown>;
  return isStringArray(o['tags']) && Array.isArray(o['pages']) && o['pages'].every(isPageUpsert);
}

/** The fields consumers key and place on; the rest are optional or patched as-is. */
function isPageUpsert(p: unknown): p is PageUpsert {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o['guid'] === 'string' &&
    typeof o['title'] === 'string' &&
    (o['parentGuid'] === null || typeof o['parentGuid'] === 'string') &&
    typeof o['status'] === 'string'
  );
}

/** Absolute `ws:`/`wss:` URLs pass through; a path resolves against the page origin. */
function wsUrl(url: string): string {
  if (/^wss?:\/\//i.test(url)) return url;
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}${url}`;
}
