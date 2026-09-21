import type { APIRequestContext } from '@playwright/test';
import { API_BASE_URL, AUTH_HEADER } from './api';

const BATCH_SIZE = 15; // stays under the backend-concurrency ceiling playwright.config.ts already caps workers for

export async function createManyChildren(
  request: APIRequestContext,
  parentGuid: string,
  count: number,
  titlePrefix: string,
  opts: { pageType?: string; properties?: Record<string, unknown> } = {},
): Promise<string[]> {
  const guids: string[] = [];
  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, count - i);
    const batch = Array.from({ length: batchSize }, (_, j) => {
      const index = i + j;
      return request
        .post(`${API_BASE_URL}/pages`, {
          headers: AUTH_HEADER,
          data: {
            title: `${titlePrefix} ${index}`,
            content: `# ${titlePrefix} ${index}`,
            parentGuid,
            ...(opts.pageType ? { pageType: opts.pageType } : {}),
            ...(opts.properties ? { properties: opts.properties } : {}),
          },
        })
        .then(async (res) => {
          if (!res.ok()) throw new Error(`createManyChildren: ${res.status()} ${await res.text()}`);
          return ((await res.json()) as { guid: string }).guid;
        });
    });
    guids.push(...(await Promise.all(batch)));
  }
  return guids;
}
