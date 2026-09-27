import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { InvalidationBus, usersListTag } from '../../core/api/invalidation';

export type Role = 'Admin' | 'Standard';

export interface UserRecord {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  cognitoEnabled?: boolean;
}

export interface UpdateUserRequest {
  role?: Role;
  displayName?: string;
}

@Injectable({ providedIn: 'root' })
export class Users {
  private readonly http = inject(HttpClient);
  private readonly bus = inject(InvalidationBus);

  /** Keys on `users:list`; every mutation below bumps that one tag. */
  usersResource() {
    return rxResource({
      params: () => this.bus.version(usersListTag()),
      stream: () =>
        this.http
          .get<{ users: UserRecord[] }>('/api/admin/users')
          .pipe(map((r) => r.users ?? [])),
    });
  }

  async updateUser(userId: string, body: UpdateUserRequest): Promise<UserRecord> {
    const result = await firstValueFrom(
      this.http.put<UserRecord>(`/api/admin/users/${userId}`, body),
    );
    this.bus.bump(usersListTag());
    return result;
  }

  async suspendUser(userId: string): Promise<UserRecord> {
    const result = await firstValueFrom(
      this.http.post<UserRecord>(`/api/admin/users/${userId}/suspend`, {}),
    );
    this.bus.bump(usersListTag());
    return result;
  }

  async activateUser(userId: string): Promise<UserRecord> {
    const result = await firstValueFrom(
      this.http.post<UserRecord>(`/api/admin/users/${userId}/activate`, {}),
    );
    this.bus.bump(usersListTag());
    return result;
  }

  async deleteUser(userId: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`/api/admin/users/${userId}`));
    this.bus.bump(usersListTag());
  }
}
