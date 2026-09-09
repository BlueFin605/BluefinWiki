import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Auth } from '../../core/auth/auth';
import { Users, type UserRecord } from './users';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../shared/components/confirm-dialog';
import {
  UserEditDialog,
  type UserEditDialogData,
  type UserEditDialogResult,
} from './user-edit-dialog';

@Component({
  selector: 'wiki-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <!-- TODO(8.1): replace with the shared admin back-header -->
      <a routerLink="/pages" class="back-link">Back to pages</a>
      <header class="page-header">
        <h1>Members</h1>
        <span class="count">({{ filtered().length }})</span>
      </header>

      <mat-form-field appearance="outline" class="search">
        <mat-label>Search</mat-label>
        <input
          matInput
          type="text"
          placeholder="Search by name or email..."
          [ngModel]="searchQuery()"
          (ngModelChange)="searchQuery.set($event)"
        />
      </mat-form-field>

      @if (resource.isLoading()) {
        <p class="state">Loading members...</p>
      } @else if (resource.error()) {
        <p class="state error">Failed to load members.</p>
      } @else {
        <table mat-table [dataSource]="filtered()" class="user-table">
          <ng-container matColumnDef="displayName">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let u">
              {{ u.displayName || 'No name' }}
              @if (isSelf(u)) {
                <span class="self"> (You)</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let u">{{ u.email }}</td>
          </ng-container>

          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Role</th>
            <td mat-cell *matCellDef="let u">{{ u.role }}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let u">{{ u.status }}</td>
          </ng-container>

          <ng-container matColumnDef="lastLoginAt">
            <th mat-header-cell *matHeaderCellDef>Last Login</th>
            <td mat-cell *matCellDef="let u">{{ formatDate(u.lastLoginAt) }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let u">
              <button
                mat-stroked-button
                type="button"
                [attr.aria-label]="'Edit ' + u.displayName"
                (click)="onEdit(u)"
              >
                Edit
              </button>
              @if (!isSelf(u) && u.status !== 'deleted') {
                @if (u.status === 'suspended') {
                  <button
                    mat-stroked-button
                    type="button"
                    [attr.aria-label]="'Activate ' + u.displayName"
                    (click)="onActivate(u)"
                  >
                    Activate
                  </button>
                } @else {
                  <button
                    mat-stroked-button
                    type="button"
                    [attr.aria-label]="'Suspend ' + u.displayName"
                    (click)="onSuspend(u)"
                  >
                    Suspend
                  </button>
                }
                <button
                  mat-stroked-button
                  color="warn"
                  type="button"
                  [attr.aria-label]="'Delete ' + u.displayName"
                  (click)="onDelete(u)"
                >
                  Delete
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
        @if (filtered().length === 0) {
          <p class="state">
            @if (searchQuery()) {
              No members match your search.
            } @else {
              No members found.
            }
          </p>
        }
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .page { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
      .back-link { display: inline-block; margin-bottom: 0.75rem; color: #1976d2; text-decoration: none; font-size: 0.875rem; }
      .back-link:hover { text-decoration: underline; }
      .page-header { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 1rem; }
      .count { color: #6b7280; }
      .search { width: 100%; max-width: 320px; }
      .user-table { width: 100%; background: #fff; }
      .self { color: #1976d2; font-size: 0.875rem; }
      .state { padding: 1rem; color: #6b7280; }
      .state.error { color: #b91c1c; }
      td.mat-mdc-cell { padding-right: 0.5rem; }
      td.mat-mdc-cell button { margin-right: 0.25rem; }
    `,
  ],
})
export class UserManagement {
  private readonly usersService = inject(Users);
  private readonly auth = inject(Auth);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly displayedColumns = [
    'displayName',
    'email',
    'role',
    'status',
    'lastLoginAt',
    'actions',
  ];

  readonly resource = this.usersService.usersResource();

  protected readonly users = computed<UserRecord[]>(() => {
    if (this.resource.status() !== 'resolved') return [];
    return this.resource.value() ?? [];
  });

  protected readonly searchQuery = signal('');

  protected readonly filtered = computed<UserRecord[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.users();
    return this.users().filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  });

  protected isSelf(u: UserRecord): boolean {
    return u.userId === this.auth.user()?.userId;
  }

  protected formatDate(raw?: string): string {
    if (!raw) return '-';
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
  }

  onEdit(u: UserRecord): void {
    const data: UserEditDialogData = { user: u, isSelf: this.isSelf(u) };
    const ref = this.dialog.open<UserEditDialog, UserEditDialogData, UserEditDialogResult | null>(
      UserEditDialog,
      { data },
    );
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      void this.runUpdate(u.userId, result);
    });
  }

  private async runUpdate(userId: string, result: UserEditDialogResult): Promise<void> {
    try {
      await this.usersService.updateUser(userId, result);
    } catch (err) {
      this.snack.open(this.toMessage(err, 'Failed to update member.'), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  onSuspend(u: UserRecord): void {
    void this.runStatus(u.userId, 'suspend');
  }

  onActivate(u: UserRecord): void {
    void this.runStatus(u.userId, 'activate');
  }

  private async runStatus(userId: string, action: 'suspend' | 'activate'): Promise<void> {
    try {
      if (action === 'suspend') await this.usersService.suspendUser(userId);
      else await this.usersService.activateUser(userId);
    } catch (err) {
      this.snack.open(this.toMessage(err, `Failed to ${action} member.`), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  onDelete(u: UserRecord): void {
    const data: ConfirmDialogData = {
      title: 'Delete Member',
      message: `Delete ${u.displayName} (${u.email})? Activity history will be preserved.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(
      ConfirmDialog,
      { data },
    );
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      void this.runDelete(u.userId);
    });
  }

  private async runDelete(userId: string): Promise<void> {
    try {
      await this.usersService.deleteUser(userId);
    } catch (err) {
      this.snack.open(this.toMessage(err, 'Failed to delete member.'), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  private toMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    return fallback;
  }
}
