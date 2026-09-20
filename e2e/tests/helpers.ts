import type { Locator, Page } from '@playwright/test';

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
 *
 * Waits for either accessible name to attach before the `.count()` check
 * below: `.count()`, unlike `.click()`, does not auto-wait for the element to
 * exist. Immediately after `page.goto()`, under enough parallel load that
 * Angular's initial bootstrap/render is still in flight, the check could
 * catch neither button yet mounted, fall through to the mobile "Page info"
 * name, and hang forever on a desktop viewport where that name never appears
 * (`inspector-sheet.spec.ts` hit this as a 30s timeout before the wait moved
 * here).
 */
export async function toggleInspector(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Toggle inspector|Page info/ }).waitFor();
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

/** `mat-sidenav.sidebar` — the tree drawer. */
export function sidebar(page: Page): Locator {
  return page.locator('mat-sidenav.sidebar');
}

/** `mat-sidenav.inspector` — the inspector panel/sheet. */
export function inspector(page: Page): Locator {
  return page.locator('mat-sidenav.inspector');
}

/** Whether a Material drawer locator currently carries `mat-drawer-opened`. */
export async function isDrawerOpen(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => el.classList.contains('mat-drawer-opened'));
}
