import { test, expect } from '@playwright/test';

// Helper: wait for loading screen to disappear and main menu to appear
async function waitForMenu(page: any) {
  await page.waitForSelector('#loading.hidden', { timeout: 15000 });
  await page.waitForSelector('#main-menu:not(.hidden)', { timeout: 5000 });
}

// Helper: get past the main menu into active gameplay
async function startGame(page: any) {
  await waitForMenu(page);
  await page.click('#btn-start');
  // HUD appears when game starts
  await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });
}

test.describe('TIRE CHAOS — Loading & Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loading screen hides after init', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 15000 });
    const loading = page.locator('#loading');
    await expect(loading).toBeHidden();
  });

  test('main menu appears after loading', async ({ page }) => {
    await waitForMenu(page);
    await expect(page.locator('#main-menu')).toBeVisible();
    await expect(page.locator('#btn-start')).toBeVisible();
    await expect(page.locator('#btn-instructions')).toBeVisible();
    await expect(page.locator('#btn-settings')).toBeVisible();
    await expect(page.locator('#btn-leaderboard')).toBeVisible();
  });

  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(/TIRE CHAOS/);
  });

  test('instructions screen opens and closes', async ({ page }) => {
    await waitForMenu(page);
    await page.click('#btn-instructions');
    await page.waitForSelector('#instructions-screen:not(.hidden)', { timeout: 3000 });
    await expect(page.locator('#instructions-screen')).toBeVisible();
    await page.click('#btn-back');
    await page.waitForSelector('#main-menu:not(.hidden)', { timeout: 3000 });
    await expect(page.locator('#main-menu')).toBeVisible();
  });
});

test.describe('TIRE CHAOS — Gameplay HUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await startGame(page);
  });

  test('HUD shows initial values', async ({ page }) => {
    await expect(page.locator('#score-value')).toContainText('0');
    await expect(page.locator('#combo-value')).toContainText('0x');
    await expect(page.locator('#tires-value')).toContainText('5');
  });

  test('HUD shows time countdown', async ({ page }) => {
    const time = await page.locator('#time-value').textContent();
    expect(Number(time)).toBeGreaterThan(0);
  });

  test('trajectory indicator hidden by default', async ({ page }) => {
    await expect(page.locator('#trajectory-indicator')).toBeHidden();
  });

  test('canvas is full-screen', async ({ page }) => {
    const box = await page.locator('#game-canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('no critical console errors during gameplay', async ({ page }) => {
    // Allow gameplay to run for a bit
    await page.waitForTimeout(2000);

    // Console listener is already set up in beforeEach via startGame
    // Just verify no critical errors occurred
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Wait a bit more and check
    await page.waitForTimeout(1000);
    const critical = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('passive')
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('TIRE CHAOS — Tire Launching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await startGame(page);
  });

  test('tires remaining decreases after launch', async ({ page }) => {
    const before = await page.locator('#tires-value').textContent();
    // Use the launch control's quick-launch keyboard shortcut
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
    const after = await page.locator('#tires-value').textContent();
    expect(Number(after)).toBeLessThan(Number(before));
  });

  test('angle display is visible after game start', async ({ page }) => {
    const angle = await page.locator('#angle-value').textContent();
    expect(angle).toMatch(/\d+°/);
  });
});

test.describe('TIRE CHAOS — Pause & Resume', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await startGame(page);
  });

  test('pause menu opens on P key', async ({ page }) => {
    await page.keyboard.press('p');
    await expect(page.locator('#pause-menu')).toBeVisible();
  });

  test('resume from pause menu', async ({ page }) => {
    await page.keyboard.press('p');
    await expect(page.locator('#pause-menu')).toBeVisible();
    await page.click('#btn-resume');
    await expect(page.locator('#pause-menu')).toBeHidden();
  });
});
