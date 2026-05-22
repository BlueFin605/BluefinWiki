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
