import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ResolvedTicketKey { key: string; guid: string; title: string }
export interface BackfillResult { assigned: number; repaired: number }

@Injectable({ providedIn: 'root' })
export class TicketKeys {
  private readonly http = inject(HttpClient);

  /** Resolve a ticket key to its page; null when no such key (404). */
  async resolve(key: string): Promise<ResolvedTicketKey | null> {
    try {
      return await firstValueFrom(
        this.http.get<ResolvedTicketKey>(`/api/ticket-keys/${encodeURIComponent(key.trim())}`),
      );
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 404) return null;
      throw err;
    }
  }

  /** Assign keys to unkeyed tickets under an Initiative (Admin). */
  backfill(initiativeGuid: string): Promise<BackfillResult> {
    return firstValueFrom(
      this.http.post<BackfillResult>(`/api/pages/${encodeURIComponent(initiativeGuid)}/ticket-keys/backfill`, {}),
    );
  }
}
