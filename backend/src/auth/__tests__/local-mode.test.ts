import { describe, it, expect } from 'vitest';
import { isLocalMode } from '../local-mode.js';

describe('isLocalMode', () => {
  it('is true for NODE_ENV=development', () => {
    expect(isLocalMode({ NODE_ENV: 'development' })).toBe(true);
  });

  it('is true for a local_ user pool id', () => {
    expect(isLocalMode({ USER_POOL_ID: 'local_user_pool_id' })).toBe(true);
    expect(isLocalMode({ COGNITO_USER_POOL_ID: 'local_pool' })).toBe(true);
  });

  it('is false for a real pool in production', () => {
    expect(isLocalMode({ NODE_ENV: 'production', USER_POOL_ID: 'us-east-1_Abc' })).toBe(false);
    expect(isLocalMode({})).toBe(false);
  });

  it('is never true inside a Lambda, whatever else is set', () => {
    expect(isLocalMode({
      AWS_LAMBDA_FUNCTION_NAME: 'bluefinwiki-auth-register-production',
      NODE_ENV: 'development',
      USER_POOL_ID: 'local_user_pool_id',
    })).toBe(false);
  });
});
