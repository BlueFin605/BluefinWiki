import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import {
  Invitations,
  type Invitation,
  type CreateInvitationRequest,
} from './invitations';
import {
  InvitationCreateDialog,
  type InvitationCreateResult,
} from './invitation-create-dialog';
import { AdminBackHeader } from '../../shared/components/admin-back-header';

@Component({
  selector: 'wiki-invitation-management',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatIconModule,
    MatTableModule,
    AdminBackHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="page-header">
        <wiki-admin-back-header title="Invitations" />
        <button mat-flat-button color="primary" type="button" (click)="onCreate()">
          Create invitation
        </button>
      </header>

      @if (createdCode(); as code) {
        <div class="banner success" role="status">
          <span>Invitation created: {{ code }}</span>
          <button mat-button type="button" (click)="createdCode.set(null)">
            Dismiss
          </button>
        </div>
      }

      <mat-button-toggle-group
        class="status-filter"
        [value]="status()"
        (change)="onStatusToggle($event.value)"
        aria-label="Filter by status"
      >
        <mat-button-toggle value="">All</mat-button-toggle>
        <mat-button-toggle value="pending">Pending</mat-button-toggle>
        <mat-button-toggle value="used">Used</mat-button-toggle>
        <mat-button-toggle value="expired">Expired</mat-button-toggle>
        <mat-button-toggle value="revoked">Revoked</mat-button-toggle>
      </mat-button-toggle-group>

      @if (resource.isLoading()) {
        <p class="state">Loading invitations...</p>
      } @else if (resource.error()) {
        <p class="state error">Failed to load invitations.</p>
      } @else {
        <table mat-table [dataSource]="invitations()" class="invite-table">
          <ng-container matColumnDef="inviteCode">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let inv" class="mono">{{ inv.inviteCode }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let inv">{{ inv.email || '-' }}</td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Role</th>
            <td mat-cell *matCellDef="let inv">{{ inv.role }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let inv">{{ inv.status }}</td>
          </ng-container>
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Created</th>
            <td mat-cell *matCellDef="let inv">{{ formatDate(inv.createdAt) }}</td>
          </ng-container>
          <ng-container matColumnDef="expiresAt">
            <th mat-header-cell *matHeaderCellDef>Expires</th>
            <td mat-cell *matCellDef="let inv">{{ formatDate(inv.expiresAt) }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let inv">
              @if (inv.status === 'pending') {
                <button
                  mat-stroked-button
                  color="warn"
                  type="button"
                  [attr.aria-label]="'Revoke ' + inv.inviteCode"
                  (click)="onRevoke(inv)"
                >
                  Revoke
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
        @if (invitations().length === 0) {
          <p class="state">No invitations found.</p>
        }
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .page { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
      .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
      .banner { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 1rem; margin-bottom: 1rem; border-radius: 4px; }
      .banner.success { background: #e8f5e9; color: #1b5e20; }
      .status-filter { margin-bottom: 1rem; }
      .invite-table { width: 100%; background: #fff; }
      .mono { font-family: monospace; }
      .state { padding: 1rem; color: #6b7280; }
      .state.error { color: #b91c1c; }
    `,
  ],
})
export class InvitationManagement {
  private readonly invitationsService = inject(Invitations);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly displayedColumns = [
    'inviteCode',
    'email',
    'role',
    'status',
    'createdAt',
    'expiresAt',
    'actions',
  ];

  protected readonly status = signal<Invitation['status'] | ''>('');
  protected readonly createdCode = signal<string | null>(null);

  readonly resource = this.invitationsService.invitationsResource(this.status);

  protected readonly invitations = computed<Invitation[]>(() => {
    if (this.resource.status() !== 'resolved') return [];
    return this.resource.value() ?? [];
  });

  protected formatDate(raw: string): string {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
  }

  onStatusToggle(next: Invitation['status'] | ''): void {
    this.status.set(next);
  }

  onCreate(): void {
    const ref = this.dialog.open<
      InvitationCreateDialog,
      void,
      InvitationCreateResult | null
    >(InvitationCreateDialog);
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      void this.runCreate(result);
    });
  }

  private async runCreate(result: InvitationCreateResult): Promise<void> {
    const body: CreateInvitationRequest = {
      role: result.role,
      ...(result.email ? { email: result.email } : {}),
      ...(result.expiryDays ? { expiryDays: result.expiryDays } : {}),
    };
    try {
      const created = await this.invitationsService.createInvitation(body);
      this.createdCode.set(created.inviteCode);
    } catch (err) {
      this.snack.open(this.toMessage(err, 'Failed to create invitation.'), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  onRevoke(inv: Invitation): void {
    void this.runRevoke(inv.inviteCode);
  }

  private async runRevoke(code: string): Promise<void> {
    try {
      await this.invitationsService.revokeInvitation(code);
    } catch (err) {
      this.snack.open(this.toMessage(err, 'Failed to revoke invitation.'), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  private toMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    return fallback;
  }
}
