import type { APIRequestContext } from '@playwright/test';
import { API_BASE_URL, AUTH_HEADER } from './api';

export interface PageTypePropertyInput {
  name: string;
  type: 'string' | 'number' | 'date' | 'tags';
  required: boolean;
}

export async function createPageType(
  request: APIRequestContext,
  name: string,
  opts: { properties?: PageTypePropertyInput[]; icon?: string } = {},
): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/page-types`, {
    headers: AUTH_HEADER,
    data: {
      name,
      icon: opts.icon ?? 'note',
      properties: opts.properties ?? [],
    },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create page type "${name}": ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { guid: string };
  return body.guid;
}

export async function deletePageType(request: APIRequestContext, guid: string): Promise<void> {
  await request.delete(`${API_BASE_URL}/page-types/${guid}`, { headers: AUTH_HEADER });
}

/** Lets a page type's own children be created as instances of itself (or of `allowedChildTypeGuids`). */
export async function allowChildTypes(
  request: APIRequestContext,
  guid: string,
  allowedChildTypeGuids: string[],
): Promise<void> {
  const res = await request.put(`${API_BASE_URL}/page-types/${guid}`, {
    headers: AUTH_HEADER,
    data: { allowedChildTypes: allowedChildTypeGuids },
  });
  if (!res.ok()) {
    throw new Error(`Failed to update allowedChildTypes for "${guid}": ${res.status()} ${await res.text()}`);
  }
}
