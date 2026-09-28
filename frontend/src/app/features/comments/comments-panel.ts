import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Comments } from './comments';
import { Auth } from '../../core/auth/auth';
import { groupIntoThreads } from './comment.types';
import type { Comment } from './comment.types';

/**
 * Threaded (one level deep) discussion on a page: a flat list of top-level
 * comments with their replies indented underneath. Edit/delete controls are
 * shown only for a comment's own author (delete also for Admins), enforced
 * for real server-side too — see `backend/src/pages/comments-service.ts`.
 * A soft-deleted comment (had replies at delete time) renders as a
 * "[deleted]" placeholder so its replies stay anchored.
 */
@Component({
  selector: 'wiki-comments-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <div class="state-region" role="status" aria-live="polite">
        @if (resource.isLoading()) {
          <p class="state">Loading comments…</p>
        } @else if (resource.error()) {
          <p class="state error">Failed to load comments.</p>
        } @else if (threads().length === 0) {
          <p class="state empty">No comments yet.</p>
        }
      </div>

      @if (!resource.isLoading() && !resource.error()) {
        <ul class="threads">
          @for (thread of threads(); track thread.comment.id) {
            <li class="thread">
              <div class="comment">
                @if (thread.comment.deletedAt) {
                  <p class="deleted">[deleted]</p>
                } @else {
                  <div class="head">
                    <span class="author">{{ thread.comment.authorName }}</span>
                    <span class="date">{{ thread.comment.createdAt | date: 'medium' }}</span>
                    @if (thread.comment.editedAt) {
                      <span class="edited">(edited)</span>
                    }
                  </div>

                  @if (editingId() === thread.comment.id) {
                    <textarea class="edit-box" [(ngModel)]="editBody" rows="3"></textarea>
                    <div class="row-actions">
                      <button mat-button type="button" (click)="submitEdit(thread.comment.id)">Save</button>
                      <button mat-button type="button" (click)="cancelEdit()">Cancel</button>
                    </div>
                  } @else {
                    <p class="body">{{ thread.comment.body }}</p>
                  }
                }

                <div class="actions">
                  <button mat-button type="button" (click)="startReply(thread.comment.id)">Reply</button>
                  @if (!thread.comment.deletedAt && canEdit(thread.comment) && editingId() !== thread.comment.id) {
                    <button mat-icon-button type="button" aria-label="Edit comment" title="Edit" (click)="startEdit(thread.comment)">
                      <mat-icon>edit</mat-icon>
                    </button>
                  }
                  @if (!thread.comment.deletedAt && canDelete(thread.comment)) {
                    <button mat-icon-button type="button" aria-label="Delete comment" title="Delete" (click)="onDelete(thread.comment)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
                </div>
              </div>

              @if (thread.replies.length > 0) {
                <ul class="replies">
                  @for (reply of thread.replies; track reply.id) {
                    <li class="comment reply">
                      @if (reply.deletedAt) {
                        <p class="deleted">[deleted]</p>
                      } @else {
                        <div class="head">
                          <span class="author">{{ reply.authorName }}</span>
                          <span class="date">{{ reply.createdAt | date: 'medium' }}</span>
                          @if (reply.editedAt) {
                            <span class="edited">(edited)</span>
                          }
                        </div>

                        @if (editingId() === reply.id) {
                          <textarea class="edit-box" [(ngModel)]="editBody" rows="3"></textarea>
                          <div class="row-actions">
                            <button mat-button type="button" (click)="submitEdit(reply.id)">Save</button>
                            <button mat-button type="button" (click)="cancelEdit()">Cancel</button>
                          </div>
                        } @else {
                          <p class="body">{{ reply.body }}</p>
                        }
                      }

                      <div class="actions">
                        @if (!reply.deletedAt && canEdit(reply) && editingId() !== reply.id) {
                          <button mat-icon-button type="button" aria-label="Edit reply" title="Edit" (click)="startEdit(reply)">
                            <mat-icon>edit</mat-icon>
                          </button>
                        }
                        @if (!reply.deletedAt && canDelete(reply)) {
                          <button mat-icon-button type="button" aria-label="Delete reply" title="Delete" (click)="onDelete(reply)">
                            <mat-icon>delete</mat-icon>
                          </button>
                        }
                      </div>
                    </li>
                  }
                </ul>
              }

              @if (replyingTo() === thread.comment.id) {
                <div class="reply-box">
                  <textarea [(ngModel)]="replyBody" rows="2" placeholder="Write a reply…"></textarea>
                  <div class="row-actions">
                    <button mat-button type="button" (click)="submitReply(thread.comment.id)">Reply</button>
                    <button mat-button type="button" (click)="cancelReply()">Cancel</button>
                  </div>
                </div>
              }
            </li>
          }
        </ul>
      }

      <div class="new-comment">
        <textarea [(ngModel)]="newTopLevelBody" rows="3" placeholder="Write a comment…"></textarea>
        <button mat-flat-button type="button" (click)="submitTopLevel()">Comment</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .panel { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .state { color: #6b7280; font-size: 0.875rem; margin: 0; }
    .state.error { color: #b91c1c; }
    .threads { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
    .thread { border: 1px solid #e5e7eb; border-radius: 4px; padding: 0.5rem 0.75rem; }
    .comment.reply { border: none; padding: 0; }
    .replies { list-style: none; padding: 0; margin: 0.5rem 0 0 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; border-left: 2px solid #e5e7eb; }
    .replies .comment { padding-left: 0.75rem; }
    .head { display: flex; align-items: baseline; gap: 0.5rem; }
    .author { font-weight: 500; font-size: 0.875rem; }
    .date { color: #6b7280; font-size: 0.75rem; }
    .edited { color: #6b7280; font-size: 0.75rem; font-style: italic; }
    .body { margin: 0.25rem 0 0; white-space: pre-wrap; font-size: 0.875rem; }
    .deleted { margin: 0.25rem 0 0; color: #6b7280; font-size: 0.875rem; font-style: italic; }
    .actions { display: flex; gap: 0.125rem; margin-top: 0.25rem; }
    .row-actions { display: flex; gap: 0.25rem; margin-top: 0.25rem; }
    .edit-box, .reply-box textarea, .new-comment textarea { width: 100%; box-sizing: border-box; font: inherit; padding: 0.375rem; border: 1px solid #e5e7eb; border-radius: 4px; resize: vertical; }
    .reply-box { margin: 0.5rem 0 0 1.25rem; }
    .new-comment { display: flex; flex-direction: column; gap: 0.375rem; }
  `],
})
export class CommentsPanel {
  private readonly comments = inject(Comments);
  private readonly auth = inject(Auth);

  readonly pageGuid = input.required<string>();

  private readonly guidSignal = computed(() => this.pageGuid());
  protected readonly resource = this.comments.listResource(this.guidSignal);

  protected readonly threads = computed(() => groupIntoThreads(this.resource.value() ?? []));

  protected readonly newTopLevelBody = signal('');
  protected readonly replyingTo = signal<string | null>(null);
  protected readonly replyBody = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editBody = signal('');

  protected canEdit(comment: Comment): boolean {
    const user = this.auth.user();
    return !!user && user.userId === comment.authorId;
  }

  protected canDelete(comment: Comment): boolean {
    const user = this.auth.user();
    if (!user) return false;
    return user.role === 'Admin' || user.userId === comment.authorId;
  }

  protected async submitTopLevel(): Promise<void> {
    const body = this.newTopLevelBody().trim();
    if (!body) return;
    try {
      await this.comments.addComment(this.pageGuid(), { body });
      this.newTopLevelBody.set('');
    } catch (err) {
      console.error('Failed to post comment', err);
      window.alert('Failed to post comment.');
    }
  }

  protected startReply(commentId: string): void {
    this.replyingTo.set(commentId);
    this.replyBody.set('');
  }

  protected cancelReply(): void {
    this.replyingTo.set(null);
    this.replyBody.set('');
  }

  protected async submitReply(parentId: string): Promise<void> {
    const body = this.replyBody().trim();
    if (!body) return;
    try {
      await this.comments.addComment(this.pageGuid(), { body, parentId });
      this.cancelReply();
    } catch (err) {
      console.error('Failed to post reply', err);
      window.alert('Failed to post reply.');
    }
  }

  protected startEdit(comment: Comment): void {
    this.editingId.set(comment.id);
    this.editBody.set(comment.body);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editBody.set('');
  }

  protected async submitEdit(commentId: string): Promise<void> {
    const body = this.editBody().trim();
    if (!body) return;
    try {
      await this.comments.updateComment(this.pageGuid(), commentId, body);
      this.cancelEdit();
    } catch (err) {
      console.error('Failed to edit comment', err);
      window.alert('Failed to edit comment.');
    }
  }

  protected async onDelete(comment: Comment): Promise<void> {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await this.comments.deleteComment(this.pageGuid(), comment.id);
    } catch (err) {
      console.error('Failed to delete comment', err);
      window.alert('Failed to delete comment.');
    }
  }
}
