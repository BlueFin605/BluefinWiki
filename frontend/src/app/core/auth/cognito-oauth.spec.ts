import { buildAuthorizeUrl, handleOAuthCallback } from './cognito-oauth';
import { createUserPool } from './cognito-config';

interface TokenResponse {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
}

type FetchMock = jest.Mock<
  Promise<{ ok: boolean; json?: () => Promise<TokenResponse> }>,
  [RequestInfo | URL, RequestInit?]
>;

describe('cognito-oauth', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    sessionStorage.clear();
    fetchMock = jest.fn<
      Promise<{ ok: boolean; json?: () => Promise<TokenResponse> }>,
      [RequestInfo | URL, RequestInit?]
    >();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('buildAuthorizeUrl', () => {
    // Note: redirectToLogin's window.location.href = url side-effect is not
    // tested directly because jsdom 28 makes Location.href a non-configurable
    // accessor that cannot be stubbed. buildAuthorizeUrl carries all the
    // meaningful behaviour (state stashing + URL composition); redirectToLogin
    // is a one-liner wrapper.
    it('stores a state token in sessionStorage and returns a Hosted UI authorize URL', () => {
      const url = buildAuthorizeUrl();
      const stored = sessionStorage.getItem('oauth_state');
      expect(stored).not.toBeNull();
      expect(stored!.length).toBe(32);
      expect(url).toMatch(/^https:\/\/.+\/oauth2\/authorize\?/);
      expect(url).toContain(`state=${stored!}`);
    });
  });

  describe('handleOAuthCallback', () => {
    it('throws when state mismatches saved value', async () => {
      sessionStorage.setItem('oauth_state', 'aaaaaaaa');
      await expect(handleOAuthCallback('code', 'bbbbbbbb')).rejects.toMatchObject({
        name: 'OAuthError',
        code: 'state_mismatch',
        message: expect.stringContaining('State mismatch') as unknown,
      });
    });

    it('exchanges code for tokens and returns a session', async () => {
      sessionStorage.setItem('oauth_state', 'matching');
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id_token: 'idt',
            access_token: 'act',
            refresh_token: 'ref',
          }),
      });

      const result = await handleOAuthCallback('thecode', 'matching');
      expect(result.idToken).toBe('idt');
      expect(result.accessToken).toBe('act');
      expect(result.refreshToken).toBe('ref');
      expect(sessionStorage.getItem('oauth_state')).toBeNull();
    });

    it('throws when token endpoint returns non-ok', async () => {
      sessionStorage.setItem('oauth_state', 'matching');
      fetchMock.mockResolvedValueOnce({ ok: false });
      await expect(handleOAuthCallback('thecode', 'matching')).rejects.toMatchObject({
        name: 'OAuthError',
        code: 'token_exchange_failed',
        message: expect.stringContaining('Failed to exchange') as unknown,
      });
    });

    it('throws when response is missing tokens', async () => {
      sessionStorage.setItem('oauth_state', 'matching');
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await expect(handleOAuthCallback('thecode', 'matching')).rejects.toMatchObject({
        name: 'OAuthError',
        code: 'missing_tokens',
        message: expect.stringContaining('Missing tokens') as unknown,
      });
    });
  });
});

describe('createUserPool', () => {
  it('constructs without referencing a cognito-local endpoint', () => {
    // environment.ts has disableAuth: true, so missing ids do not throw.
    const pool = createUserPool();
    expect(pool).toBeDefined();
    // The Environment type no longer has `endpoint`; this file compiling is the assertion.
  });
});
