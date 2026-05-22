import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
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

@Component({
  selector: 'wiki-invitation-management',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatTableModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="page-header">
        <h1>Invitations</h1>
        <button mat-flat-button color="primary" type="button" (click)="onCreate()">
          Create invitation
        </button>
      </header>

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

  readonly resource = this.invitationsService.invitationsResource();

  protected readonly invitations = computed<Invitation[]>(() => {
    if (this.resource.status() !== 'resolved') return [];
    return this.resource.value() ?? [];
  });

  protected formatDate(raw: string): string {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
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
      await this.invitationsService.createInvitation(body);
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
