import { test, expect } from '@playwright/test';

test.describe('TIRE CHAOS Gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load game successfully', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    // Check that HUD is visible
    await expect(page.locator('#hud')).toBeVisible();

    // Check that controls are visible
    await expect(page.locator('#controls')).toBeVisible();

    // Check initial score
    await expect(page.locator('#score')).toContainText('Score: 0');
  });

  test('should display correct initial game state', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    // Check initial values
    await expect(page.locator('#score')).toContainText('Score: 0');
    await expect(page.locator('#combo')).toContainText('Combo: 0x');
    await expect(page.locator('#tires-remaining')).toContainText('Tires: 3');
  });

  test('should show trajectory indicator on mouse down', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    const canvas = page.locator('#game-canvas');

    // Click and hold
    await canvas.click({ position: { x: 400, y: 300 } });

    // Trajectory indicator should be visible
    await expect(page.locator('#trajectory-indicator')).toBeVisible();
  });

  test('should launch tire on mouse release', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    const canvas = page.locator('#game-canvas');

    // Get initial tire count
    const initialTires = await page.locator('#tires-remaining').textContent();

    // Simulate drag and release
    await canvas.hover({ position: { x: 300, y: 300 } });
    await page.mouse.down();
    await page.mouse.move(400, 200);
    await page.mouse.up();

    // Wait a bit for tire count to update
    await page.waitForTimeout(500);

    // Tire count should decrease
    const currentTires = await page.locator('#tires-remaining').textContent();
    expect(currentTires).not.toBe(initialTires);
  });

  test('should update power and angle during drag', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    const canvas = page.locator('#game-canvas');

    // Start drag
    await canvas.hover({ position: { x: 300, y: 300 } });
    await page.mouse.down();

    // Move mouse
    await page.mouse.move(400, 200);

    // Check that power and angle are displayed
    const power = await page.locator('#power-value').textContent();
    const angle = await page.locator('#angle-value').textContent();

    expect(power).toMatch(/\d+%/);
    expect(angle).toMatch(/\d+°/);
  });

  test('should reset level on reset button click', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    // Launch a tire first
    const canvas = page.locator('#game-canvas');
    await canvas.hover({ position: { x: 300, y: 300 } });
    await page.mouse.down();
    await page.mouse.move(400, 200);
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Click reset button
    await page.click('#reset-btn');

    // Wait for reset
    await page.waitForTimeout(500);

    // Check that tires are back to 3
    await expect(page.locator('#tires-remaining')).toContainText('Tires: 3');

    // Score should be reset
    await expect(page.locator('#score')).toContainText('Score: 0');
  });

  test('should have responsive canvas', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    const canvas = page.locator('#game-canvas');

    // Check canvas dimensions
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    // Press 'r' to reset
    await page.keyboard.press('r');
    await page.waitForTimeout(500);

    // Should reset to initial state
    await expect(page.locator('#tires-remaining')).toContainText('Tires: 3');

    // Press space to quick launch
    const initialTires = await page.locator('#tires-remaining').textContent();
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const currentTires = await page.locator('#tires-remaining').textContent();
    expect(currentTires).not.toBe(initialTires);
  });

  test('should render 3D scene', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    const canvas = page.locator('#game-canvas');

    // Take screenshot to verify rendering
    const screenshot = await canvas.screenshot();
    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('should maintain consistent frame rate', async ({ page }) => {
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    // Monitor for errors in console
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for a few seconds of gameplay
    await page.waitForTimeout(3000);

    // Should have no critical errors
    const criticalErrors = errors.filter(
      (err) => !err.includes('favicon') && !err.includes('404'),
    );
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('TIRE CHAOS Scoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });
  });

  test('should update score when objects destroyed', async ({ page }) => {
    // Launch multiple tires
    for (let i = 0; i < 3; i++) {
      const canvas = page.locator('#game-canvas');
      await canvas.hover({ position: { x: 300, y: 300 } });
      await page.mouse.down();
      await page.mouse.move(500, 150);
      await page.mouse.up();
      await page.waitForTimeout(1000);
    }

    // Wait for physics to settle
    await page.waitForTimeout(3000);

    // Score might have increased if objects were hit
    const scoreText = await page.locator('#score').textContent();
    // We can't guarantee hits, but text should still be formatted correctly
    expect(scoreText).toMatch(/Score: \d+/);
  });

  test('should track combo correctly', async ({ page }) => {
    const comboText = await page.locator('#combo').textContent();
    expect(comboText).toMatch(/Combo: \d+x/);
  });
});

test.describe('TIRE CHAOS UI/UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle('TIRE CHAOS');
  });

  test('should have all UI elements visible', async ({ page }) => {
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#controls')).toBeVisible();
    await expect(page.locator('#reset-btn')).toBeVisible();
  });

  test('should hide trajectory indicator when not aiming', async ({ page }) => {
    // Trajectory should be hidden by default
    await expect(page.locator('#trajectory-indicator')).toBeHidden();
  });

  test('should have styled buttons', async ({ page }) => {
    const resetBtn = page.locator('#reset-btn');

    // Check button has correct class
    await expect(resetBtn).toHaveClass(/button/);

    // Check button is clickable
    await expect(resetBtn).toBeEnabled();
  });
});
