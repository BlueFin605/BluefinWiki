import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import type { Role } from './users';

export interface InviteUserRef {
  userId: string;
  displayName?: string;
  email?: string;
}

export interface Invitation {
  inviteCode: string;
  email?: string;
  role: Role;
  createdBy: InviteUserRef;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'used' | 'revoked' | 'expired';
  usedBy?: InviteUserRef;
  usedAt?: string;
}

export interface CreateInvitationRequest {
  email?: string;
  role: Role;
  expiryDays?: number;
}

@Injectable({ providedIn: 'root' })
export class Invitations {
  private readonly http = inject(HttpClient);
  private readonly _version = signal(0);

  bumpVersion(): void {
    this._version.update((v) => v + 1);
  }

  invitationsResource() {
    return rxResource({
      params: () => this._version(),
      stream: () =>
        this.http
          .get<{ invitations: Invitation[] }>('/api/admin/invitations')
          .pipe(map((r) => r.invitations ?? [])),
    });
  }

  async createInvitation(body: CreateInvitationRequest): Promise<Invitation> {
    const result = await firstValueFrom(
      this.http.post<Invitation>('/api/admin/invitations', body),
    );
    this.bumpVersion();
    return result;
  }

  async revokeInvitation(inviteCode: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`/api/admin/invitations/${inviteCode}`),
    );
    this.bumpVersion();
  }
}
