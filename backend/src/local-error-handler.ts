import type { NextFunction, Request, Response } from 'express';

interface HttpishError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

/**
 * Catch-all for unmatched routes on the local dev server. Uses the project's
 * `{ error, code }` shape. (Deployed, API Gateway answers unknown routes itself
 * with 403 `{"message":"Missing Authentication Token"}`; there is no catch-all Lambda.)
 */
export function localNotFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
}

/**
 * Express error-handling middleware for the local dev server.
 *
 * Must declare four parameters: Express only treats a function as an error
 * handler by its arity, otherwise it is skipped and Express falls back to its
 * default HTML handler, which prints the stack trace and local file paths.
 *
 * Responses use the project's JSON shape `{ error, code }`. The error message
 * and stack are logged server-side only and never sent to the client.
 */
export function localErrorHandler(
  err: HttpishError,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = err.status ?? err.statusCode;

  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON', code: 'INVALID_JSON' });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
    return;
  }
  if (status === 400 || err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
    res.status(400).json({ error: 'Bad request', code: 'BAD_REQUEST' });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
}
