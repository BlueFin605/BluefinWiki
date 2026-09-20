import { test as base, expect } from '@playwright/test';
import { API_BASE_URL, AUTH_HEADER } from './api';

/** Minimal local shape — mirrors the backend's page-property contract without importing the Angular app. */
export interface PageProperty {
  type: 'string' | 'number' | 'date' | 'tags';
  value: string | number | string[];
}

export interface PageFixtureTree {
  runId: string;
  rootGuid: string;
  childGuid: string;
  grandchildGuid: string;
  greatGrandchildGuid: string;
  longPageGuid: string;
}

const LONG_PAGE_CONTENT = `# Long Page

## Getting Started

Intro text for the getting-started section.

### Prerequisites

Prerequisite text.

## Architecture

Architecture overview text.

### Backend

Backend details.

### Frontend

Frontend details.

#### Frontend Build

Build pipeline notes.

## Deployment

Deployment process notes.

### Staging

Staging environment notes.

### Production

Production environment notes.

## Troubleshooting

Common issues and fixes.

## FAQ

Frequently asked questions.

## Glossary

Term definitions.

## Appendix

This is the final section, marking the end of the document for scroll testing.
`;

export async function createPage(
  request: import('@playwright/test').APIRequestContext,
  title: string,
  opts: {
    parentGuid?: string | null;
    content?: string;
    pageType?: string;
    properties?: Record<string, PageProperty>;
  } = {},
): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/pages`, {
    headers: AUTH_HEADER,
    data: {
      title,
      content: opts.content ?? `# ${title}`,
      parentGuid: opts.parentGuid ?? null,
      ...(opts.pageType ? { pageType: opts.pageType } : {}),
      ...(opts.properties ? { properties: opts.properties } : {}),
    },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create page "${title}": ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { guid: string };
  return body.guid;
}

export async function updatePage(
  request: import('@playwright/test').APIRequestContext,
  guid: string,
  data: Record<string, unknown>,
): Promise<void> {
  const res = await request.put(`${API_BASE_URL}/pages/${guid}`, {
    headers: AUTH_HEADER,
    data,
  });
  if (!res.ok()) {
    throw new Error(`Failed to update page "${guid}": ${res.status()} ${await res.text()}`);
  }
}

export async function deletePageRecursive(
  request: import('@playwright/test').APIRequestContext,
  guid: string,
): Promise<void> {
  await request.delete(`${API_BASE_URL}/pages/${guid}?recursive=true`, { headers: AUTH_HEADER });
}

export const test = base.extend<object, { pageTree: PageFixtureTree }>({
  pageTree: [
    async ({ playwright }, use) => {
      const api = await playwright.request.newContext();
      const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const prefix = `E2E-${runId}`;

      const rootGuid = await createPage(api, `${prefix} Root`);
      const childGuid = await createPage(api, `${prefix} Child`, { parentGuid: rootGuid });
      const grandchildGuid = await createPage(api, `${prefix} Grandchild`, { parentGuid: childGuid });
      const greatGrandchildGuid = await createPage(api, `${prefix} Great-grandchild`, {
        parentGuid: grandchildGuid,
      });
      const longPageGuid = await createPage(api, `${prefix} Long Page`, {
        parentGuid: rootGuid,
        content: LONG_PAGE_CONTENT,
      });

      await use({ runId, rootGuid, childGuid, grandchildGuid, greatGrandchildGuid, longPageGuid });

      await deletePageRecursive(api, rootGuid);
      await api.dispose();
    },
    { scope: 'worker' },
  ],
});

export { expect };
