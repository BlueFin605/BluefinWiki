import { APIGatewayProxyResult } from 'aws-lambda';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { withAuth, AuthenticatedEvent } from '../middleware/auth.js';

/**
 * Lambda: imdb-show-details
 * POST /imdb/show-details
 *
 * Looks up an IMDb TV show and returns key details for AI follow-up turns:
 * synopsis, number of seasons, and rating.
 */

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_000_000;

export const handler = withAuth(async (
  event: AuthenticatedEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return bad(400, 'Request body is required');

    let body: { query?: string; imdbId?: string };
    try {
      body = JSON.parse(event.body);
    } catch {
      return bad(400, 'Body must be valid JSON');
    }

    const rawQuery = (body.query || '').trim();
    const rawImdbId = (body.imdbId || '').trim();

    if (!rawQuery && !rawImdbId) {
      return bad(400, 'Provide either "query" or "imdbId"');
    }

    const match = rawImdbId
      ? { imdbId: rawImdbId, title: undefined }
      : await lookupShow(rawQuery);

    if (!match?.imdbId) {
      return bad(404, 'No IMDb TV show match found');
    }

    const details = await fetchImdbDetails(match.imdbId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: rawQuery || undefined,
        imdbId: match.imdbId,
        title: details.title || match.title || rawQuery,
        synopsis: details.synopsis || '',
        seasons: details.seasons,
        rating: details.rating,
        votes: details.votes,
        url: `https://www.imdb.com/title/${match.imdbId}/`,
      }),
    };
  } catch (err) {
    console.error('imdb-show-details error:', err);
    return bad(500, 'Failed to fetch IMDb show details');
  }
});

interface LookupResult {
  imdbId: string;
  title?: string;
}

interface ImdbDetails {
  title?: string;
  synopsis?: string;
  seasons?: number;
  rating?: number;
  votes?: number;
}

async function lookupShow(query: string): Promise<LookupResult | null> {
  const key = encodeURIComponent(query.toLowerCase().slice(0, 1) || 'a');
  const q = encodeURIComponent(query);
  const url = `https://v3.sg.media-imdb.com/suggestion/${key}/${q}.json`;

  const payload = await fetchText(url);
  const parsed = JSON.parse(payload) as {
    d?: Array<{
      id?: string;
      l?: string;
      q?: string;
      qid?: string;
    }>;
  };

  const candidates = parsed.d ?? [];

  const tv = candidates.find((item) => {
    const type = `${item.q || ''} ${item.qid || ''}`.toLowerCase();
    return Boolean(item.id && (type.includes('tv') || type.includes('series')));
  });
  if (tv?.id) return { imdbId: tv.id, title: tv.l };

  const fallback = candidates.find((item) => Boolean(item.id));
  return fallback?.id ? { imdbId: fallback.id, title: fallback.l } : null;
}

async function fetchImdbDetails(imdbId: string): Promise<ImdbDetails> {
  const html = await fetchText(`https://www.imdb.com/title/${encodeURIComponent(imdbId)}/`);

  const jsonLdBlocks = extractJsonLdBlocks(html);
  const bestLd = jsonLdBlocks.find((x) => {
    const t = String((x as Record<string, unknown>)['@type'] || '').toLowerCase();
    return t.includes('tvseries') || t.includes('tv series');
  }) || jsonLdBlocks[0];

  const title = asString(bestLd?.name) || extractMeta(html, 'og:title');
  const synopsis = asString(bestLd?.description) || extractMeta(html, 'description');
  const rating = asNumber((bestLd?.aggregateRating as Record<string, unknown> | undefined)?.ratingValue)
    ?? parseNumberFromRegex(html, /"aggregateRating"\s*:\s*\{[^}]*"ratingValue"\s*:\s*([0-9.]+)/i);
  const votes = asNumber((bestLd?.aggregateRating as Record<string, unknown> | undefined)?.ratingCount)
    ?? parseNumberFromRegex(html, /"aggregateRating"\s*:\s*\{[^}]*"ratingCount"\s*:\s*([0-9,]+)/i, true);

  const seasons = asNumber(bestLd?.numberOfSeasons)
    ?? parseNumberFromRegex(html, /"numberOfSeasons"\s*:\s*([0-9]+)/i)
    ?? parseNumberFromRegex(html, /(\d+)\s+season(?:s)?\b/i);

  return {
    title: title?.replace(/\s*-\s*IMDb\s*$/i, '').trim(),
    synopsis: synopsis?.trim(),
    seasons: seasons ? Math.trunc(seasons) : undefined,
    rating,
    votes: votes ? Math.trunc(votes) : undefined,
  };
}

function extractJsonLdBlocks(html: string): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  const re = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(re)) {
    const raw = (match[1] || '').trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          if (entry && typeof entry === 'object') {
            blocks.push(entry as Record<string, unknown>);
          }
        });
      } else if (parsed && typeof parsed === 'object') {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Ignore malformed json-ld blocks.
    }
  }

  return blocks;
}

function extractMeta(html: string, name: string): string | undefined {
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${safe}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  );
  const match = html.match(re);
  return match?.[1]?.trim();
}

function parseNumberFromRegex(html: string, re: RegExp, stripCommas = false): number | undefined {
  const match = html.match(re);
  if (!match?.[1]) return undefined;
  const raw = stripCommas ? match[1].replace(/,/g, '') : match[1];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options: RequestOptions = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined,
      method: 'GET',
      path: `${parsed.pathname || '/'}${parsed.search || ''}`,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'BluefinWiki-AI/1.0 (+https://bluefin605.com)',
        Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en',
      },
    };

    const req = httpsRequest(options, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400) {
        res.resume();
        reject(new Error(`IMDb redirected (${status})`));
        return;
      }
      if (status >= 400) {
        res.resume();
        reject(new Error(`IMDb returned ${status}`));
        return;
      }

      const chunks: Buffer[] = [];
      let bytes = 0;
      let aborted = false;

      res.on('data', (chunk: Buffer) => {
        if (aborted) return;
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          aborted = true;
          res.destroy(new Error('IMDb response exceeded size limit'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });

      res.on('error', reject);
    });

    req.on('timeout', () => {
      req.destroy(new Error('IMDb request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

function bad(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}
