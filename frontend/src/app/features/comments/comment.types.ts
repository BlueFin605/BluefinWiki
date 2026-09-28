/**
 * Comment types for BlueFinWiki frontend. Mirrors `backend/src/types/index.ts`'s
 * `Comment` interface — comments live in a per-page S3 sidecar, never the
 * page's own frontmatter (see
 * `docs/superpowers/specs/2026-09-28-page-comments-design.md`).
 */

export interface Comment {
  id: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

/** A top-level comment with its (at most one level deep) replies attached. */
export interface CommentThread {
  comment: Comment;
  replies: Comment[];
}

/**
 * Group a page's flat comment list into top-level comments with their
 * replies nested one level, in the order the top-level comments were
 * created (oldest first) — replies within a thread are also oldest first.
 */
export function groupIntoThreads(comments: readonly Comment[]): CommentThread[] {
  const topLevel = comments
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return topLevel.map((comment) => ({
    comment,
    replies: comments
      .filter((c) => c.parentId === comment.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));
}
