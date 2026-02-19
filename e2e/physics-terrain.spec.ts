/**
 * Physics & Terrain E2E Tests
 *
 * Verifies the game concept overhaul:
 *   - Release Control UI (not throw/projectile)
 *   - Tire lands on terrain and doesn't fall through
 *   - Tire rolls (position changes over time, not frozen)
 *   - No physics console errors
 *   - Contact materials are wired (tire has friction with terrain)
 *   - Per-type tire radius used for spawn position
 */

import { test, expect } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForLoaded(page: any) {
  // Wait for the loading overlay to become hidden (state:'hidden' checks for
  // Playwright invisibility, i.e. display:none — NOT for the CSS class name).
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 20000 });
  await page.waitForSelector('#main-menu', { state: 'visible', timeout: 8000 });
}

async function startGame(page: any) {
  await waitForLoaded(page);
  await page.click('#btn-start');
  await page.waitForSelector('#game-hud', { state: 'visible', timeout: 8000 });
  // Poll until the physics world has at least one body (terrain heightfield).
  // Avoids a fixed 1500 ms sleep — resolves in ~200–500 ms on fast hardware.
  await page.waitForFunction(
    () => ((window as any).__gameManager?.physicsManager?.world?.bodies?.length ?? 0) >= 1,
    { timeout: 10000 },
  );
}

/** Read a physics value from the live game via the exposed __gameManager. */
async function physicsState(page: any) {
  return page.evaluate(() => {
    const gm = (window as any).__gameManager;
    if (!gm) return null;
    const tire = gm.activeTires?.[0];
    const world = gm.physicsManager?.world;
    return {
      activeTireCount: gm.activeTires?.length ?? 0,
      physicsBodyCount: world?.bodies?.length ?? 0,
      contactMaterialCount: world?.contactmaterials?.length ?? world?.contactMaterials?.length ?? 0,
      tire: tire
        ? {
            posX: tire.body?.position?.x ?? null,
            posY: tire.body?.position?.y ?? null,
            posZ: tire.body?.position?.z ?? null,
            speedXZ: Math.sqrt(
              (tire.body?.velocity?.x ?? 0) ** 2 +
              (tire.body?.velocity?.z ?? 0) ** 2,
            ),
            isLaunched: tire.isLaunched ?? false,
            allowSleep: tire.body?.allowSleep ?? true,
          }
        : null,
    };
  });
}

// ── Suite: Release Control UI ─────────────────────────────────────────────────
// All tests here are read-only UI checks — share a single page load via
// beforeAll to avoid paying the ~10 s Babylon.js boot cost 6 times.

test.describe('Release Control UI', () => {
  test.describe.configure({ mode: 'serial' });
  let sharedPage: any;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    await sharedPage.goto('/');
    await startGame(sharedPage);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('panel is visible with RELEASE CONTROL title', async () => {
    const panel = sharedPage.locator('#launch-control-ui');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('RELEASE CONTROL');
  });

  test('speed slider exists (not power/throw)', async () => {
    const panel = sharedPage.locator('#launch-control-ui');
    // Label should say SPEED, not POWER
    await expect(panel).toContainText('SPEED');
    const slider = sharedPage.locator('#lc-power-slider');
    await expect(slider).toBeVisible();
  });

  test('direction slider has range -45 to +45', async () => {
    const slider = sharedPage.locator('#lc-angle-slider');
    await expect(slider).toBeVisible();
    const min = await slider.getAttribute('min');
    const max = await slider.getAttribute('max');
    expect(Number(min)).toBe(-45);
    expect(Number(max)).toBe(45);
  });

  test('direction slider defaults to 0 (straight downhill)', async () => {
    const slider = sharedPage.locator('#lc-angle-slider');
    const value = await slider.inputValue();
    expect(Number(value)).toBe(0);
  });

  test('release button is labeled RELEASE', async () => {
    const btn = sharedPage.locator('#lc-launch-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('RELEASE');
  });

  test('direction label shows DIRECTION', async () => {
    await expect(sharedPage.locator('#launch-control-ui')).toContainText('DIRECTION');
  });
});

// ── Suite: Terrain Collision ─────────────────────────────────────────────────

test.describe('Terrain Collision', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await startGame(page);
  });

  test('physics world has contact materials registered', async ({ page }) => {
    const state = await physicsState(page);
    expect(state).not.toBeNull();
    // At minimum: tire×ground pairs for 5 tire types + generic + default = 7+
    expect(state!.contactMaterialCount).toBeGreaterThanOrEqual(6);
  });

  test('physics world has terrain body before any launch', async ({ page }) => {
    const state = await physicsState(page);
    expect(state).not.toBeNull();
    // At minimum: terrain heightfield body must exist
    expect(state!.physicsBodyCount).toBeGreaterThanOrEqual(1);
  });

  test('tire Y stays above terrain after release', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Release with Space (straight downhill, 50% speed)
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    let state = await physicsState(page);
    // At least 1 tire launched (headless Space key can repeat; check >=1 not ===1)
    expect(state?.activeTireCount).toBeGreaterThanOrEqual(1);
    expect(state?.tire?.isLaunched).toBe(true);

    // Wait 4 seconds for tire to roll and settle
    await page.waitForTimeout(4000);

    state = await physicsState(page);
    const posY = state?.tire?.posY ?? null;

    // The fell-off-map threshold is Y < -50.  Terrain bottom is -8.
    // A tire on the terrain should have Y between -10 and +20.
    expect(posY).not.toBeNull();
    expect(posY!).toBeGreaterThan(-50);  // didn't fall through terrain
    expect(posY!).toBeGreaterThan(-10);  // sitting on terrain, not below it

    const critical = errors.filter(
      e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('passive') &&
        !e.includes('playground.babylonjs.com') &&
        !e.includes('ERR_FAILED') &&
        !e.includes('CORS'),
    );
    expect(critical).toHaveLength(0);
  });

  test('tire rolls (position changes over time)', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);

    const s1 = await physicsState(page);
    const x1 = s1?.tire?.posX ?? 0;
    const z1 = s1?.tire?.posZ ?? 0;

    await page.waitForTimeout(2000);

    const s2 = await physicsState(page);
    const x2 = s2?.tire?.posX ?? 0;
    const z2 = s2?.tire?.posZ ?? 0;

    // Tire should have moved at least 1 unit in XZ (downhill roll)
    const dist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    expect(dist).toBeGreaterThan(1);
  });

  test('tire body has sleep disabled', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    const state = await physicsState(page);
    // allowSleep must be false — prevents tire freezing mid-slope
    expect(state?.tire?.allowSleep).toBe(false);
  });
});

// ── Suite: Tire Type Spawn Position ──────────────────────────────────────────

test.describe('Tire Spawn Position', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await startGame(page);
  });

  test('standard tire spawns at correct height (not inside terrain)', async ({ page }) => {
    // Standard radius = 0.4; spawn Y should be surfaceY + 0.4 + 0.1 ≈ surfaceY + 0.5
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    const state = await physicsState(page);
    const posY = state?.tire?.posY ?? null;
    // surfaceY at hilltop is roughly TERRAIN_BASE_Y(-8) + hill(7) + slope(9) ≈ 8
    // So spawn Y should be roughly 8.5, definitely > 0
    expect(posY).not.toBeNull();
    expect(posY!).toBeGreaterThan(0);
  });

  test('tires remaining decrements by 1 on each release', async ({ page }) => {
    const before = Number(await page.locator('#tires-value').textContent());

    await page.keyboard.press('Space');
    await page.waitForTimeout(400);

    const after = Number(await page.locator('#tires-value').textContent());
    // Headless Space can repeat; just verify at least 1 tire was consumed.
    expect(after).toBeLessThan(before);
  });
});

// ── Suite: No Physics Errors ──────────────────────────────────────────────────

test.describe('Console Error Monitoring', () => {
  test('no errors during terrain build and tire release', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await startGame(page);

    // Release 3 tires in sequence
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(800);
    }

    await page.waitForTimeout(2000);

    const critical = errors.filter(
      e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('passive') &&
        !e.includes('ResizeObserver') &&
        // Babylon.js fetches optional HDR environment textures from its CDN;
        // CORS errors for these are pre-existing and non-critical (engine falls back).
        !e.includes('playground.babylonjs.com') &&
        !e.includes('ERR_FAILED') &&
        !e.includes('CORS'),
    );
    expect(critical).toHaveLength(0);
  });

  test('no errors after level reload (clearScene cleans up properly)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await startGame(page);

    // Launch a tire then reset — exercises clearScene + levelGenerator.clearLevel()
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    await page.keyboard.press('r');
    await page.waitForTimeout(2000);

    // Launch again on fresh level — would expose stale physics body errors
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);

    const critical = errors.filter(
      e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('passive') &&
        !e.includes('ResizeObserver') &&
        // Babylon.js fetches optional HDR environment textures from its CDN;
        // CORS errors for these are pre-existing and non-critical (engine falls back).
        !e.includes('playground.babylonjs.com') &&
        !e.includes('ERR_FAILED') &&
        !e.includes('CORS'),
    );
    expect(critical).toHaveLength(0);
  });
});

// ── Suite: Direction Control ──────────────────────────────────────────────────

test.describe('Direction Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await startGame(page);
  });

  test('direction display updates when slider moves', async ({ page }) => {
    const slider = page.locator('#lc-angle-slider');
    // Move to +30°
    await slider.fill('30');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(100);

    const display = await page.locator('#lc-angle-value').textContent();
    expect(display).toMatch(/30/);
  });

  test('angled release still keeps tire on terrain', async ({ page }) => {
    // Set direction to 30° right
    const slider = page.locator('#lc-angle-slider');
    await slider.fill('30');
    await slider.dispatchEvent('input');

    // Launch via button
    await page.click('#lc-launch-btn');
    await page.waitForTimeout(4000);

    const state = await physicsState(page);
    // Tire should still be on terrain, not fallen through
    expect(state?.tire?.posY ?? -999).toBeGreaterThan(-50);
  });
});
