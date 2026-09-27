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

export async function routeFailure(
  page: Page,
  urlPattern: string | RegExp,
  status: number,
  body: unknown = { message: 'Simulated failure' },
): Promise<void> {
  await page.route(urlPattern, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

/**
 * Drags `source` to a pre-computed point in `targetRow`'s `before` (top 10%),
 * `after` (bottom 10%) or `onto` (middle 50%) zone, using a single committed
 * mouse move — the target's bounding box is read once, up front, and never
 * re-read mid-drag.
 *
 * That single-point approach is reliable for `onto` (any target) and for
 * `before`/`after` against a STABLE, non-sibling target whose box does not
 * shift once the drag enters it — e.g. `tree-reparent.spec.ts`'s
 * `.root-drop-zone`, which has no CDK sort-preview to relocate it.
 *
 * It is NOT reliable for a `before`/`after` drop onto an ADJACENT sibling
 * row: `tree-drag-reorder.spec.ts`'s task-2 investigation found CDK's sort
 * preview visually shifts the target out from under the still pointer the
 * instant it classifies as `before`/`after`, firing a native `pointerleave`
 * that resets the app's zone-tracking signal and silently downgrades the
 * drop to `onto` — 100% of the time, not intermittently. Use
 * {@link dragBeforeAdjacentSibling} for that case instead.
 *
 * @param options.release When `false`, do everything up through the final
 *   committed move but do NOT call `page.mouse.up()` — lets the caller
 *   inspect mid-drag DOM state (e.g. hover-time `.drop-invalid` feedback)
 *   before completing the drop itself with its own `page.mouse.up()`.
 *   Defaults to `true`.
 */
export async function dragToRowZone(
  page: Page,
  source: Locator,
  targetRow: Locator,
  zone: 'before' | 'after' | 'onto',
  options: { release?: boolean } = {},
): Promise<void> {
  const { release = true } = options;
  const s = await source.boundingBox();
  const t = await targetRow.boundingBox();
  if (!s || !t) throw new Error('dragToRowZone: source or target has no bounding box');

  const targetY =
    zone === 'before' ? t.y + t.height * 0.1 : zone === 'after' ? t.y + t.height * 0.9 : t.y + t.height * 0.5;
  const targetX = t.x + t.width / 2;

  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 5, { steps: 5 });
  await page.waitForTimeout(100);
  // Single committed move to the pre-computed target point — no re-read of
  // targetRow's box after this point (see doc comment above).
  await page.mouse.move(targetX, targetY, { steps: 15 });
  await page.waitForTimeout(150);
  if (release) await page.mouse.up();
}

// ---- Adjacent-sibling before/after drops --------------------------------
//
// Named, per Finding M7 (2026-09-21 fix-wave review), so each magic number's
// role is legible at the call site below — values are unchanged from the
// original investigation in tree-drag-reorder.spec.ts (task 2).

/** How many convergent-chase steps to take while re-aiming at the target's live position. */
const CHASE_ITERATIONS = 25;
/** Easing factor per chase step — how far to close the gap to the target's current Y each iteration (0-1). */
const CHASE_EASE_FACTOR = 0.3;
/** Wait between chase steps, giving Angular/CDK time to process the move and re-render the sort preview. */
const CHASE_STEP_WAIT_MS = 20;
/** Aim point inside the target row's `before` zone (top 10% of its height) — a point well within `page-tree-item.ts`'s `zoneFromClientY` `before` band (`ratio < 0.25`), not the band's own boundary. */
const BEFORE_ZONE_FRACTION = 0.1;

/**
 * Drags `source` to land in the `before` zone (top 10%) of `targetRow`, for a
 * genuinely ADJACENT sibling — the case {@link dragToRowZone}'s single,
 * up-front-computed target point does not handle (see its doc comment).
 *
 * Investigation for task 2 of the phase-2 tree-crud e2e plan (see
 * task-2-report.md) found that for two adjacent siblings, the moment the drag
 * enters the target's zone with a valid `before`/`after` classification,
 * CDK's "sort preview" visually relocates the target row (translating it out
 * of the way) to show where the dragged item will land. Because the mouse
 * cursor stays put while the target's painted box moves out from under it,
 * the browser fires a genuine `pointerleave` on the target — which
 * `page-tree-item.ts`'s `onRowDragLeave()` uses to reset its `_dropZone`
 * signal back to `null`. `onDrop` then reads that `null` and falls back to
 * `'onto'` (reparent) instead of the intended `before`/`after` reorder — a
 * single static target point can never land correctly here, no matter how
 * far inside the 25% zone it aims (confirmed empirically: this fails 100% of
 * the time, not intermittently, so widening the zone band does not help).
 *
 * A real user succeeds here because their eye+hand naturally track the
 * shifting drop-indicator and keep the pointer over the target as it moves.
 * This helper reproduces that: it re-reads the target's LIVE bounding box on
 * every step and eases the pointer toward its current (possibly just-shifted)
 * 10%-zone point, rather than committing to one pre-drag coordinate. This is
 * a *convergent* correction (small steps continuously re-aiming at a
 * settling target), not the *chasing oscillation* the tree-reparent.spec.ts
 * comments warn about (a single big corrective jump re-provoking the next
 * swap in a multi-row sort preview).
 */
export async function dragBeforeAdjacentSibling(page: Page, source: Locator, targetRow: Locator): Promise<void> {
  const s = await source.boundingBox();
  if (!s) throw new Error('dragBeforeAdjacentSibling: source has no bounding box');

  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  // Small initial move past CDK's drag-start threshold, then a beat for
  // Angular to process `cdkDragStarted` (matches dragToRowZone's approach).
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 5, { steps: 5 });
  await page.waitForTimeout(100);

  let y = s.y + s.height / 2 + 5;
  const x = s.x + s.width / 2 + 10;
  for (let i = 0; i < CHASE_ITERATIONS; i++) {
    const box = await targetRow.boundingBox();
    if (!box) break;
    const wantY = box.y + box.height * BEFORE_ZONE_FRACTION; // top 10% — the 'before' zone
    y += (wantY - y) * CHASE_EASE_FACTOR; // ease toward the target's CURRENT position
    await page.mouse.move(x, y, { steps: 1 });
    await page.waitForTimeout(CHASE_STEP_WAIT_MS);
  }
  await page.waitForTimeout(100);
  await page.mouse.up();
}

export async function dragCardToColumn(
  page: Page,
  card: Locator,
  column: Locator,
  position: 'start' | 'end' | number = 'end',
): Promise<void> {
  const cardBox = await card.boundingBox();
  const cardsContainer = column.locator('.cards');
  const containerBox = await cardsContainer.boundingBox();
  if (!cardBox || !containerBox) throw new Error('dragCardToColumn: missing bounding box');

  const targetX = containerBox.x + containerBox.width / 2;
  const targetY =
    position === 'start'
      ? containerBox.y + 10
      : position === 'end'
        ? containerBox.y + containerBox.height - 10
        : containerBox.y + (position as number); // caller-supplied pixel offset for between-card drops

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + cardBox.width / 2 + 10, cardBox.y + cardBox.height / 2 + 5, { steps: 5 });
  await page.waitForTimeout(100);
  await page.mouse.move(targetX, targetY, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
