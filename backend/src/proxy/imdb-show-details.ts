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

    console.log('[imdb-show-details] request received', {
      hasQuery: Boolean(rawQuery),
      hasImdbId: Boolean(rawImdbId),
      queryPreview: rawQuery.slice(0, 120),
      imdbId: rawImdbId || undefined,
    });

    if (!rawQuery && !rawImdbId) {
      return bad(400, 'Provide either "query" or "imdbId"');
    }

    const resolved = await resolveShowDetails({
      rawQuery,
      rawImdbId,
    });

    console.log('[imdb-show-details] resolved show details', {
      provider: resolved?.provider,
      imdbId: resolved?.imdbId,
      title: resolved?.title,
      url: resolved?.url,
    });

    if (!resolved) {
      return bad(404, 'No IMDb TV show match found');
    }

    const details = resolved.details;

    console.log('[imdb-show-details] parsed details', {
      provider: resolved.provider,
      imdbId: resolved.imdbId,
      title: details.title,
      synopsisLength: details.synopsis?.length ?? 0,
      seasons: details.seasons,
      rating: details.rating,
      votes: details.votes,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: rawQuery || undefined,
        imdbId: resolved.imdbId,
        title: details.title || resolved.title || rawQuery,
        synopsis: details.synopsis || '',
        seasons: details.seasons,
        rating: details.rating,
        votes: details.votes,
        url: resolved.url,
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

interface ResolvedShowDetails {
  imdbId: string;
  title?: string;
  details: ImdbDetails;
  url: string;
  provider: 'tvmaze' | 'imdb-scrape';
}

interface TvMazeShow {
  id: number;
  name?: string;
  summary?: string;
  url?: string;
  rating?: { average?: number | null };
  externals?: { imdb?: string | null };
}

async function resolveShowDetails({
  rawQuery,
  rawImdbId,
}: {
  rawQuery: string;
  rawImdbId: string;
}): Promise<ResolvedShowDetails | null> {
  const tvMaze = await fetchTvMazeDetails({
    query: rawQuery || undefined,
    imdbId: rawImdbId || undefined,
  });

  if (tvMaze) {
    const imdbId = tvMaze.imdbId || rawImdbId || (rawQuery ? (await lookupShow(rawQuery))?.imdbId : undefined);
    if (imdbId) {
      console.log('[imdb-show-details] using TVMaze provider', {
        tvmazeUrl: tvMaze.url,
        imdbId,
      });
      return {
        imdbId,
        title: tvMaze.title,
        details: {
          title: tvMaze.title,
          synopsis: tvMaze.synopsis,
          seasons: tvMaze.seasons,
          rating: tvMaze.rating,
          votes: undefined,
        },
        url: `https://www.imdb.com/title/${imdbId}/`,
        provider: 'tvmaze',
      };
    }
  }

  const match = rawImdbId
    ? { imdbId: rawImdbId, title: undefined }
    : await lookupShow(rawQuery);

  console.log('[imdb-show-details] fallback IMDb lookup result', {
    imdbId: match?.imdbId,
    title: match?.title,
  });

  if (!match?.imdbId) return null;

  const details = await fetchImdbDetails(match.imdbId);
  return {
    imdbId: match.imdbId,
    title: match.title,
    details,
    url: `https://www.imdb.com/title/${match.imdbId}/`,
    provider: 'imdb-scrape',
  };
}

async function fetchTvMazeDetails({
  query,
  imdbId,
}: {
  query?: string;
  imdbId?: string;
}): Promise<{
  title?: string;
  synopsis?: string;
  seasons?: number;
  rating?: number;
  imdbId?: string;
  url?: string;
} | null> {
  try {
    const base = 'https://api.tvmaze.com';
    const showUrl = imdbId
      ? `${base}/lookup/shows?imdb=${encodeURIComponent(imdbId)}`
      : query
        ? `${base}/singlesearch/shows?q=${encodeURIComponent(query)}`
        : null;
    if (!showUrl) return null;

    console.log('[imdb-show-details] querying TVMaze show API', { showUrl, query, imdbId });
    const show = await fetchJson<TvMazeShow>(showUrl);

    if (!show || typeof show.id !== 'number') {
      console.log('[imdb-show-details] TVMaze returned no show');
      return null;
    }

    let seasons: number | undefined;
    const episodesUrl = `${base}/shows/${show.id}/episodes`;
    console.log('[imdb-show-details] querying TVMaze episodes API', { episodesUrl, showId: show.id });
    const episodes = await fetchJson<Array<{ season?: number }>>(episodesUrl);
    if (Array.isArray(episodes) && episodes.length > 0) {
      const seasonSet = new Set<number>();
      for (const ep of episodes) {
        if (typeof ep.season === 'number' && Number.isFinite(ep.season)) {
          seasonSet.add(ep.season);
        }
      }
      if (seasonSet.size > 0) {
        seasons = Math.max(...Array.from(seasonSet.values()));
      }
    }

    const synopsis = stripHtml(show.summary || '');
    const rating = typeof show.rating?.average === 'number' ? show.rating.average : undefined;
    const resolvedImdbId = (show.externals?.imdb || '').trim() || undefined;

    console.log('[imdb-show-details] TVMaze extraction summary', {
      showId: show.id,
      title: show.name,
      synopsisLength: synopsis.length,
      seasons,
      rating,
      imdbId: resolvedImdbId,
      url: show.url,
    });

    return {
      title: show.name,
      synopsis: synopsis || undefined,
      seasons,
      rating,
      imdbId: resolvedImdbId,
      url: show.url,
    };
  } catch (err) {
    console.warn('[imdb-show-details] TVMaze provider failed, will fallback to IMDb scrape', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function lookupShow(query: string): Promise<LookupResult | null> {
  const key = encodeURIComponent(query.toLowerCase().slice(0, 1) || 'a');
  const q = encodeURIComponent(query);
  const url = `https://v3.sg.media-imdb.com/suggestion/${key}/${q}.json`;
  console.log('[imdb-show-details] querying IMDb suggestion API', { url, query });

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
  console.log('[imdb-show-details] suggestion candidates', {
    total: candidates.length,
    sample: candidates.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.l,
      type: item.q,
      qid: item.qid,
    })),
  });

  const tv = candidates.find((item) => {
    const type = `${item.q || ''} ${item.qid || ''}`.toLowerCase();
    return Boolean(item.id && (type.includes('tv') || type.includes('series')));
  });
  if (tv?.id) return { imdbId: tv.id, title: tv.l };

  const fallback = candidates.find((item) => Boolean(item.id));
  return fallback?.id ? { imdbId: fallback.id, title: fallback.l } : null;
}

async function fetchImdbDetails(imdbId: string): Promise<ImdbDetails> {
  const detailsUrl = `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/`;
  console.log('[imdb-show-details] querying IMDb title page', { detailsUrl, imdbId });
  const html = await fetchText(detailsUrl);
  console.log('[imdb-show-details] title page fetched', {
    imdbId,
    htmlLength: html.length,
  });

  const jsonLdBlocks = extractJsonLdBlocks(html);
  console.log('[imdb-show-details] json-ld blocks found', {
    imdbId,
    count: jsonLdBlocks.length,
    types: jsonLdBlocks.slice(0, 6).map((x) => String((x as Record<string, unknown>)['@type'] || 'unknown')),
  });
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

  console.log('[imdb-show-details] extraction summary', {
    imdbId,
    usedJsonLd: Boolean(bestLd),
    titleFound: Boolean(title),
    synopsisFound: Boolean(synopsis),
    synopsisPreview: synopsis?.slice(0, 200),
    rating,
    votes,
    seasons,
  });

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
      console.log('[imdb-show-details] upstream response', {
        url,
        status,
        contentType: res.headers['content-type'],
      });
      if (status >= 300 && status < 400) {
        res.resume();
        reject(new Error(`Upstream redirected (${status})`));
        return;
      }
      if (status >= 400) {
        res.resume();
        reject(new Error(`Upstream returned ${status}`));
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

async function fetchJson<T>(url: string): Promise<T> {
  const payload = await fetchText(url);
  return JSON.parse(payload) as T;
}

function stripHtml(value: string): string {
  if (!value) return '';
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function bad(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}
