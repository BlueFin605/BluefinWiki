import { APIGatewayProxyResult } from 'aws-lambda';
import { request as httpRequest, IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';
import { resolvePublicAddress } from './ip-guard.js';
import { htmlToText } from './html-to-text.js';

/**
 * Lambda: proxy-fetch-url
 * POST /fetch-url
 *
 * Fetches a public URL on behalf of the AI assistant so it can summarise or
 * extract content into a wiki page. Hardened against SSRF:
 *   - https-only (configurable via ALLOW_HTTP env for local dev)
 *   - DNS-resolves the hostname and rejects private/loopback/link-local IPs
 *   - Pins the connection to the validated IP to defeat DNS rebinding
 *   - No automatic redirects (3xx surfaces as a final error to the caller)
 *   - 10s connect+read timeout
 *   - 500 KB response cap
 *   - Lambda role grants no AWS service access — even a credential leak is inert.
 *
 * Request body:
 * { "url": "https://example.com/article" }
 *
 * Response:
 * {
 *   "url": "...",          // final URL used
 *   "contentType": "text/html",
 *   "title": "...",         // extracted <title> if available
 *   "text": "...",          // extracted readable text, truncated
 *   "truncated": true|false
 * }
 */

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 500 * 1024;
const MAX_TEXT_CHARS = 8_000;
const ALLOW_HTTP = process.env.ALLOW_HTTP === 'true';

export const handler = withAuth(async (
  event: AuthenticatedEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return bad(400, 'Request body is required');
    }

    let body: { url?: string };
    try {
      body = JSON.parse(event.body);
    } catch {
      return bad(400, 'Body must be valid JSON');
    }

    const rawUrl = (body.url || '').trim();
    if (!rawUrl) return bad(400, 'Missing "url"');

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return bad(400, 'Invalid URL');
    }

    if (parsed.protocol !== 'https:' && !(ALLOW_HTTP && parsed.protocol === 'http:')) {
      return bad(400, 'Only https URLs are allowed');
    }

    let pinned;
    try {
      pinned = await resolvePublicAddress(parsed.hostname);
    } catch (err) {
      return bad(400, (err as Error).message);
    }

    const result = await performRequest(parsed, pinned.address);

    if (result.status >= 300 && result.status < 400) {
      return bad(502, `Upstream redirected (${result.status}); redirects are not followed`);
    }
    if (result.status >= 400) {
      return bad(502, `Upstream returned ${result.status}`);
    }

    const text = htmlToText(result.body);
    const title = extractTitle(result.body);
    const truncated = text.length > MAX_TEXT_CHARS;
    const trimmedText = truncated ? `${text.slice(0, MAX_TEXT_CHARS)}…` : text;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: rawUrl,
        contentType: result.contentType,
        title,
        text: trimmedText,
        truncated,
      }),
    };
  } catch (err: unknown) {
    console.error('fetch-url error:', err);
    return bad(500, 'Failed to fetch URL');
  }
});

interface FetchResult {
  status: number;
  contentType: string;
  body: string;
}

function performRequest(target: URL, pinnedIp: string): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const isHttps = target.protocol === 'https:';
    const requestFn = isHttps ? httpsRequest : httpRequest;
    const defaultPort = isHttps ? 443 : 80;

    const req = requestFn(
      {
        host: pinnedIp,
        servername: target.hostname, // SNI: TLS still validates the certificate against the hostname
        port: target.port ? Number(target.port) : defaultPort,
        method: 'GET',
        path: `${target.pathname || '/'}${target.search || ''}`,
        headers: {
          Host: target.hostname,
          'User-Agent': 'BluefinWiki-AI/1.0 (+https://bluefin605.com)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'Accept-Language': 'en',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res: IncomingMessage) => {
        const status = res.statusCode || 0;
        const contentType = String(res.headers['content-type'] || '').toLowerCase();

        if (!contentType.includes('text/') && !contentType.includes('xhtml') && !contentType.includes('xml') && !contentType.includes('json')) {
          res.destroy();
          reject(new Error(`Unsupported content-type: ${contentType || 'unknown'}`));
          return;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        let aborted = false;

        res.on('data', (chunk: Buffer) => {
          if (aborted) return;
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            aborted = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve({
            status,
            contentType,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });

        res.on('error', reject);
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error('Upstream request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  return match[1].replace(/\s+/g, ' ').trim().slice(0, 200) || undefined;
}

function bad(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}
