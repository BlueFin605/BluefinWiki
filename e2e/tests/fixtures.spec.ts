import { test as base, expect } from '@playwright/test';
import { createPage, deletePageRecursive } from '../fixtures/page-tree';

const API_BASE_URL = 'http://localhost:3000';
const AUTH_HEADER = { Authorization: 'Bearer mock-jwt-token' };

base(
  'createPage/deletePageRecursive round-trip: created page is reachable, then gone after delete',
  async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const title = `E2E-fixture-check-${Date.now()}`;

    const guid = await createPage(api, title);
    const getRes = await api.get(`${API_BASE_URL}/pages/${guid}`, { headers: AUTH_HEADER });
    expect(getRes.status()).toBe(200);
    const body = (await getRes.json()) as { title: string };
    expect(body.title).toBe(title);

    await deletePageRecursive(api, guid);
    const getAfterDelete = await api.get(`${API_BASE_URL}/pages/${guid}`, { headers: AUTH_HEADER });
    expect(getAfterDelete.status()).toBe(404);

    await api.dispose();
  },
);
