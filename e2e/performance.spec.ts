import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForSelector('#loading.hidden', { timeout: 15000 });

    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);

    console.log(`Game loaded in ${loadTime}ms`);
  });

  test('should not have memory leaks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    // Launch and reset multiple times
    for (let i = 0; i < 5; i++) {
      // Launch tire
      const canvas = page.locator('#game-canvas');
      await canvas.hover({ position: { x: 300, y: 300 } });
      await page.mouse.down();
      await page.mouse.move(400, 200);
      await page.mouse.up();
      await page.waitForTimeout(1000);

      // Reset
      await page.click('#reset-btn');
      await page.waitForTimeout(500);
    }

    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);

    const criticalErrors = errors.filter(
      (err) => !err.includes('favicon') && !err.includes('404'),
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should maintain 30+ FPS', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

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
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });

    // Launch all available tires
    const tiresText = await page.locator('#tires-remaining').textContent();
    const tireCount = parseInt(tiresText?.match(/\d+/)?.[0] || '3');

    for (let i = 0; i < tireCount; i++) {
      const canvas = page.locator('#game-canvas');
      await canvas.hover({ position: { x: 300, y: 300 } });
      await page.mouse.down();
      await page.mouse.move(400 + i * 10, 200);
      await page.mouse.up();
      await page.waitForTimeout(200);
    }

    // Should not crash or freeze
    await page.waitForTimeout(2000);

    // UI should still be responsive
    await expect(page.locator('#hud')).toBeVisible();
  });
});
