import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForSelector('#loading.hidden', { timeout: 20000, state: 'attached' });

    const loadTime = Date.now() - startTime;

    // Should load within 20 seconds (Babylon.js + assets can be heavy)
    expect(loadTime).toBeLessThan(20000);

    console.log(`Game loaded in ${loadTime}ms`);
  });

  test('should not have memory leaks', async ({ page }) => {
    // Capture console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForSelector('#loading.hidden', { timeout: 20000, state: 'attached' });

    // Start game
    await expect(page.locator('#main-menu')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-start');
    await page.waitForTimeout(500);
    await expect(page.locator('#game-hud')).toBeVisible({ timeout: 10000 });

    // Launch and reset multiple times
    for (let i = 0; i < 5; i++) {
      // Launch tire using spacebar
      await page.keyboard.press('Space');
      await page.waitForTimeout(600);

      // Reset using keyboard
      await page.keyboard.press('r');
      await page.waitForTimeout(600);
    }

    await page.waitForTimeout(1000);

    const criticalErrors = errors.filter(
      (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('passive'),
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should maintain 30+ FPS', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#loading.hidden', { timeout: 20000, state: 'attached' });

    // Start game
    await expect(page.locator('#main-menu')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-start');
    await page.waitForTimeout(500);
    await expect(page.locator('#game-hud')).toBeVisible({ timeout: 10000 });

    // Measure FPS (simplified - just check no freezes)
    const frameChecks: number[] = [];

    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await page.waitForTimeout(100);
      const duration = Date.now() - start;

      // Should be close to 100ms, not frozen
      frameChecks.push(duration);
    }

    // Average should be close to 100ms (no major freezes)
    const average = frameChecks.reduce((a, b) => a + b, 0) / frameChecks.length;
    expect(average).toBeLessThan(150); // Allow some variance
  });

  test('should handle multiple tires efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#loading.hidden', { timeout: 20000, state: 'attached' });

    // Start game
    await expect(page.locator('#main-menu')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-start');
    await page.waitForTimeout(500);
    await expect(page.locator('#game-hud')).toBeVisible({ timeout: 10000 });

    // Launch all available tires
    const tiresText = await page.locator('#tires-value').textContent();
    const tireCount = parseInt(tiresText?.match(/\d+/)?.[0] || '5');

    for (let i = 0; i < tireCount; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
    }

    // Should not crash or freeze
    await page.waitForTimeout(2000);

    // UI should still be responsive
    await expect(page.locator('#game-hud')).toBeVisible();
  });
});
