import type { Page } from '@playwright/test';

export async function openTreeDrawer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open navigation' }).click();
}

export async function openAiOverlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
}

/**
 * The inspector toggle's accessible name switches with the breakpoint
 * (`page-detail.ts`: `'Toggle inspector'` on desktop, `'Page info'` below
 * 1024) — this helper works at either width.
 */
export async function toggleInspector(page: Page): Promise<void> {
  const desktopButton = page.getByRole('button', { name: 'Toggle inspector' });
  if (await desktopButton.count()) {
    await desktopButton.click();
    return;
  }
  await page.getByRole('button', { name: 'Page info' }).click();
}

export async function openSearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
}
