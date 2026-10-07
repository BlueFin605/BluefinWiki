export interface ApiError {
  status: number;
  code: string;
  message: string;
  requestId?: string;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' && value !== null &&
    'status' in value && 'code' in value && 'message' in value
  );
}

/**
 * The HTTP status behind a failed request, or undefined when there isn't one.
 * errorInterceptor rethrows every HTTP error as a plain {@link ApiError}, so
 * `instanceof HttpErrorResponse` never matches in the app; match on this
 * instead. Looks through one `cause` too, since Angular's `resource()` wraps a
 * non-Error rejection (like an ApiError) before exposing it as `error()`.
 */
export function httpStatusOf(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return status;
  const cause = (err as { cause?: { status?: unknown } } | null)?.cause?.status;
  return typeof cause === 'number' ? cause : undefined;
}
