import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isTicketKey } from './ticket-key';

export { TICKET_KEY_PATTERN, isTicketKey } from './ticket-key';

export interface ResolvedTicketKey { key: string; guid: string; title: string }
export interface BackfillResult { assigned: number; repaired: number }

/** The reference to put in a page URL: the ticket key when there is one, else the GUID. */
export const pageRef = (p: { guid: string; ticketKey?: string | null }): string => p.ticketKey ?? p.guid;

const canonical = (key: string): string => key.trim().toUpperCase();

@Injectable({ providedIn: 'root' })
export class TicketKeys {
  private readonly http = inject(HttpClient);
  private readonly guidsByKey = new Map<string, string>();
  private readonly keysByGuid = new Map<string, string>();

  /** Cache a known key ↔ GUID pair (keys are write-once, so this never goes stale). */
  remember(key: string, guid: string): void {
    const k = canonical(key);
    this.guidsByKey.set(k, guid);
    this.keysByGuid.set(guid, k);
  }

  /** GUID for a key from the cache only; undefined when not cached. */
  guidFor(key: string): string | undefined {
    return this.guidsByKey.get(canonical(key));
  }

  /** Key for a GUID from the cache only; undefined when not cached. */
  keyFor(guid: string): string | undefined {
    return this.keysByGuid.get(guid);
  }

  /**
   * Resolve a ticket key to its page (always a live lookup, so the title is
   * current); null when no such key (404). Successes feed the cache.
   */
  async resolve(key: string): Promise<ResolvedTicketKey | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ResolvedTicketKey>(`/api/ticket-keys/${encodeURIComponent(key.trim())}`),
      );
      this.remember(res.key, res.guid);
      return res;
    } catch (err) {
      // errorInterceptor rethrows HTTP errors as an ApiError ({ status, … }),
      // so match on the status, not the HttpErrorResponse class.
      if ((err as { status?: number } | null)?.status === 404) return null;
      throw err;
    }
  }

  /** A page reference as a GUID: non-keys pass through; keys come from the cache or resolve (null when unknown). */
  async toGuid(ref: string): Promise<string | null> {
    if (!isTicketKey(ref)) return ref;
    return this.guidFor(ref) ?? (await this.resolve(ref))?.guid ?? null;
  }

  /** Assign keys to unkeyed tickets under an Initiative (Admin). */
  backfill(initiativeGuid: string): Promise<BackfillResult> {
    return firstValueFrom(
      this.http.post<BackfillResult>(`/api/pages/${encodeURIComponent(initiativeGuid)}/ticket-keys/backfill`, {}),
    );
  }
}
