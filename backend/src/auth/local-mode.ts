/**
 * True only when running under the local Express server (or a dev shell),
 * never inside a deployed Lambda.
 *
 * Mirrors the condition that makes `middleware/auth.ts` accept `mock-jwt-token`
 * (NODE_ENV=development, or a `local_` user pool id), and additionally refuses
 * whenever the Lambda runtime is present (`AWS_LAMBDA_FUNCTION_NAME` is always
 * set by Lambda), so a stray env var in a deployed function cannot switch the
 * Cognito stubs on.
 */
export function isLocalMode(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.AWS_LAMBDA_FUNCTION_NAME) return false;
  const poolId = env.COGNITO_USER_POOL_ID || env.USER_POOL_ID || '';
  return env.NODE_ENV === 'development' || poolId.startsWith('local_');
}

/** Profile of the user the local server's `mock-jwt-token` resolves to. */
export const LOCAL_DEV_USER = {
  cognitoUserId: 'local-dev-user-id',
  email: 'dev@example.com',
  displayName: 'Local Dev User',
  role: 'Admin',
  status: 'active',
} as const;
