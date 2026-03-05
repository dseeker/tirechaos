import { test, expect } from '@playwright/test';

// Helper: wait for loading screen to disappear and main menu to appear
async function waitForMenu(page: any) {
  // Use 'attached' state because with display:none the element is not "visible"
  await page.waitForSelector('#loading.hidden', { timeout: 20000, state: 'attached' });
  await expect(page.locator('#main-menu')).toBeVisible({ timeout: 10000 });
}

// Helper: get past the main menu into active gameplay
async function startGame(page: any) {
  await waitForMenu(page);
  await page.click('#btn-start');
  // Wait for game to start and HUD to appear
  await page.waitForTimeout(500);
  await expect(page.locator('#game-hud')).toBeVisible({ timeout: 10000 });
}

test.describe('TIRE CHAOS — Loading & Menu', () => {
  test.describe.configure({ mode: 'serial' });
  let sharedPage: any;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    // Capture console errors
    sharedPage.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        console.error(`[Browser Error] ${msg.text()}`);
      }
    });
    await sharedPage.goto('/');
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('loading screen hides after init', async () => {
    await sharedPage.waitForSelector('#loading.hidden', { timeout: 20000, state: 'attached' });
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
    await expect(sharedPage.locator('#instructions-screen')).toBeVisible({ timeout: 5000 });
    // Use a more reliable selector for the back button
    await sharedPage.locator('#btn-back, #instructions-screen button').first().click();
    await expect(sharedPage.locator('#main-menu')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('TIRE CHAOS — Gameplay HUD', () => {
  test.describe.configure({ mode: 'serial' });
  let sharedPage: any;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    // Capture console errors
    sharedPage.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        console.error(`[Browser Error] ${msg.text()}`);
      }
    });
    await sharedPage.goto('/');
    await startGame(sharedPage);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('HUD shows initial values', async () => {
    await expect(sharedPage.locator('#score-value')).toContainText('0');
    await expect(sharedPage.locator('#combo-value')).toContainText('0.0x');
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

    // Allow gameplay to run for a bit
    await sharedPage.waitForTimeout(3000);

    const critical = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('passive')
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('TIRE CHAOS — Tire Launching', () => {
  test.describe.configure({ mode: 'serial' });
  let sharedPage: any;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    // Capture console errors
    sharedPage.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        console.error(`[Browser Error] ${msg.text()}`);
      }
    });
    await sharedPage.goto('/');
    await startGame(sharedPage);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('tires remaining decreases after launch', async () => {
    const before = await sharedPage.locator('#tires-value').textContent();
    // Use the launch control's quick-launch keyboard shortcut
    await sharedPage.keyboard.press('Space');
    await sharedPage.waitForTimeout(1000);
    const after = await sharedPage.locator('#tires-value').textContent();
    expect(Number(after)).toBeLessThan(Number(before));
  });

  test('angle display is visible after game start', async () => {
    const angle = await sharedPage.locator('#angle-value').textContent();
    expect(angle).toMatch(/\d+/);
  });
});

test.describe('TIRE CHAOS — Pause & Resume', () => {
  test.describe.configure({ mode: 'serial' });
  let sharedPage: any;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    // Capture console errors
    sharedPage.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        console.error(`[Browser Error] ${msg.text()}`);
      }
    });
    await sharedPage.goto('/');
    await startGame(sharedPage);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('pause menu opens on P key', async () => {
    // Focus the page first
    await sharedPage.locator('canvas').click({ position: { x: 100, y: 100 } });
    await sharedPage.keyboard.press('p');
    await expect(sharedPage.locator('#pause-menu')).toBeVisible({ timeout: 5000 });
  });

  test('resume from pause menu', async () => {
    // Focus the page first
    await sharedPage.locator('canvas').click({ position: { x: 100, y: 100 } });
    await sharedPage.keyboard.press('p');
    await expect(sharedPage.locator('#pause-menu')).toBeVisible({ timeout: 5000 });
    await sharedPage.click('#btn-resume');
    await expect(sharedPage.locator('#pause-menu')).toBeHidden();
  });
});
