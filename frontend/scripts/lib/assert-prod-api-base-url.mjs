/**
 * Throws unless `value` is a plausible production API base URL:
 * non-empty, https, and not pointed at a local/loopback host.
 *
 * Pass { allowLocal: true } (from ALLOW_LOCAL_API_URL=1) as a full escape hatch:
 * once `value` parses as a URL it returns early, bypassing BOTH the
 * https-protocol check AND the local/loopback host check. The only checks that
 * still run are "non-empty" and "parses as a URL".
 */
export function assertProdApiBaseUrl(value, opts = {}) {
  if (!value || !value.trim()) {
    throw new Error('build-env: NG_APP_API_BASE_URL is empty/missing for a production build.');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`build-env: NG_APP_API_BASE_URL is not a valid URL: ${value}`);
  }
  // Full escape hatch: skips the protocol check below as well as the host check.
  if (opts.allowLocal) return;
  if (url.protocol !== 'https:') {
    throw new Error(`build-env: NG_APP_API_BASE_URL must use https in production, got: ${value}`);
  }
  const host = url.hostname.toLowerCase();
  const local =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local');
  if (local) {
    throw new Error(
      `build-env: NG_APP_API_BASE_URL points at a local host (${host}) for a production build. ` +
        'Set a real https api.* URL, or ALLOW_LOCAL_API_URL=1 to override.',
    );
  }
}
