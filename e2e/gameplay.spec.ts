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

// All "Loading & Menu" checks are read-only UI assertions after a single page
// load — share one browser instance instead of loading 4 times.
test.describe('TIRE CHAOS — Loading & Menu', () => {
  test.describe.configure({ mode: 'serial' });
  let sharedPage: any;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    await sharedPage.goto('/');
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('loading screen hides after init', async () => {
    await sharedPage.waitForSelector('#loading.hidden', { timeout: 15000 });
    await expect(sharedPage.locator('#loading')).toBeHidden();
  });

  test('main menu appears after loading', async () => {
    await waitForMenu(sharedPage);
    await expect(sharedPage.locator('#main-menu')).toBeVisible();
    await expect(sharedPage.locator('#btn-start')).toBeVisible();
    await expect(sharedPage.locator('#btn-instructions')).toBeVisible();
    await expect(sharedPage.locator('#btn-settings')).toBeVisible();
    await expect(sharedPage.locator('#btn-leaderboard')).toBeVisible();
  });

  test('page title is correct', async () => {
    await expect(sharedPage).toHaveTitle(/TIRE CHAOS/);
  });

  test('instructions screen opens and closes', async () => {
    await waitForMenu(sharedPage);
    await sharedPage.click('#btn-instructions');
    await sharedPage.waitForSelector('#instructions-screen:not(.hidden)', { timeout: 3000 });
    await expect(sharedPage.locator('#instructions-screen')).toBeVisible();
    await sharedPage.click('#btn-back');
    await sharedPage.waitForSelector('#main-menu:not(.hidden)', { timeout: 3000 });
    await expect(sharedPage.locator('#main-menu')).toBeVisible();
  });
});

// All "Gameplay HUD" assertions are read-only — share one started game instance.
test.describe('TIRE CHAOS — Gameplay HUD', () => {
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

  test('HUD shows initial values', async () => {
    await expect(sharedPage.locator('#score-value')).toContainText('0');
    await expect(sharedPage.locator('#combo-value')).toContainText('0x');
    await expect(sharedPage.locator('#tires-value')).toContainText('5');
  });

  test('HUD shows time countdown', async () => {
    const time = await sharedPage.locator('#time-value').textContent();
    expect(Number(time)).toBeGreaterThan(0);
  });

  test('trajectory indicator hidden by default', async () => {
    await expect(sharedPage.locator('#trajectory-indicator')).toBeHidden();
  });

  test('canvas is full-screen', async () => {
    const box = await sharedPage.locator('#game-canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('no critical console errors during gameplay', async () => {
    const consoleErrors: string[] = [];
    sharedPage.on('console', (msg: any) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await sharedPage.waitForTimeout(1000);
    const critical = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('passive')
    );
    expect(critical).toHaveLength(0);
  });
});

// "Tire Launching" shares one page: test 1 launches (state mutates),
// test 2 only reads the angle display which is unaffected by launch count.
test.describe('TIRE CHAOS — Tire Launching', () => {
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

  test('tires remaining decreases after launch', async () => {
    const before = await sharedPage.locator('#tires-value').textContent();
    await sharedPage.keyboard.press('Space');
    await sharedPage.waitForTimeout(600);
    const after = await sharedPage.locator('#tires-value').textContent();
    expect(Number(after)).toBeLessThan(Number(before));
  });

  test('angle display is visible after game start', async () => {
    const angle = await sharedPage.locator('#angle-value').textContent();
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
