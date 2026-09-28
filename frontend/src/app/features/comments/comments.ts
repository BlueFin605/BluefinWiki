import { HttpClient } from '@angular/common/http';
import { Injectable, type Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { type Observable, firstValueFrom, map } from 'rxjs';
import { InvalidationBus, commentsTag } from '../../core/api/invalidation';
import type { Comment } from './comment.types';

export interface CreateCommentInput {
  body: string;
  parentId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class Comments {
  private readonly http = inject(HttpClient);
  private readonly bus = inject(InvalidationBus);

  /**
   * `GET /api/pages/:guid/comments` → the page's flat comment list, as a
   * cold observable that issues one request per subscription.
   */
  listComments(pageGuid: string): Observable<Comment[]> {
    return this.http
      .get<{ comments: Comment[] }>(`/api/pages/${pageGuid}/comments`)
      .pipe(map((r) => r.comments ?? []));
  }

  /** Keys on `comments:<pageGuid>`. */
  listResource(pageGuid: Signal<string | null>) {
    return rxResource({
      params: () => {
        const g = pageGuid();
        return { guid: g, v: g ? this.bus.version(commentsTag(g)) : 0 };
      },
      stream: ({ params }) => {
        if (!params.guid) {
          throw new Error('listResource: pageGuid is null');
        }
        return this.listComments(params.guid);
      },
    });
  }

  async addComment(pageGuid: string, input: CreateCommentInput): Promise<Comment> {
    const comment = await firstValueFrom(
      this.http.post<Comment>(`/api/pages/${pageGuid}/comments`, input),
    );
    this.bus.bump(commentsTag(pageGuid));
    return comment;
  }

  async updateComment(pageGuid: string, commentId: string, body: string): Promise<Comment> {
    const comment = await firstValueFrom(
      this.http.put<Comment>(`/api/pages/${pageGuid}/comments/${commentId}`, { body }),
    );
    this.bus.bump(commentsTag(pageGuid));
    return comment;
  }

  async deleteComment(pageGuid: string, commentId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`/api/pages/${pageGuid}/comments/${commentId}`),
    );
    this.bus.bump(commentsTag(pageGuid));
  }
}
