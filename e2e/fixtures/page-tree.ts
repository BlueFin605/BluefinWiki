import { test as base, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3000';
const AUTH_HEADER = { Authorization: 'Bearer mock-jwt-token' };

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
  opts: { parentGuid?: string | null; content?: string } = {},
): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/pages`, {
    headers: AUTH_HEADER,
    data: {
      title,
      content: opts.content ?? `# ${title}`,
      parentGuid: opts.parentGuid ?? null,
    },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create page "${title}": ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { guid: string };
  return body.guid;
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
