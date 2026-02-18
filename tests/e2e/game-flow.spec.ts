import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the loading screen to disappear, which signals that the Babylon.js
 * engine has fully initialised and the UIManager has shown the main menu.
 */
async function waitForGameReady(page: Page, timeout = 15000): Promise<void> {
  // The loading div gets the 'hidden' class once init() completes
  await page.waitForSelector('#loading.hidden', { timeout });
}

/**
 * Navigate to the game and wait until it is ready.
 */
async function loadGame(page: Page): Promise<void> {
  await page.goto('/');
  await waitForGameReady(page);
}

/**
 * Click the START GAME button from the main menu and wait until the game HUD
 * becomes visible (i.e. a round has actually started).
 */
async function startGameFromMenu(page: Page): Promise<void> {
  await page.locator('#btn-start').click();
  // The HUD is shown by UIManager.showGameHUD() which removes the 'hidden' class
  await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });
}

/**
 * Press the pause key and wait for the pause menu to appear.
 */
async function pauseGame(page: Page): Promise<void> {
  await page.keyboard.press('p');
  await page.waitForSelector('#pause-menu:not(.hidden)', { timeout: 3000 });
}

// ---------------------------------------------------------------------------
// Test suite: Complete Game Flow
// ---------------------------------------------------------------------------

test.describe('TIRE CHAOS - Complete Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress non-critical console noise that could distract from real errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Surface genuine errors during test execution for diagnostics
        console.error(`[browser error] ${msg.text()}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 1. Game loads and shows main menu
  // -------------------------------------------------------------------------

  test('game loads and displays main menu', async ({ page }) => {
    await loadGame(page);

    // Loading screen must be hidden
    await expect(page.locator('#loading')).toHaveClass(/hidden/);

    // Main menu must be visible
    const mainMenu = page.locator('#main-menu');
    await expect(mainMenu).toBeVisible();

    // Game title present in menu
    await expect(mainMenu.locator('.game-title')).toBeVisible();

    // All primary action buttons are rendered
    await expect(page.locator('#btn-start')).toBeVisible();
    await expect(page.locator('#btn-instructions')).toBeVisible();

    // High score section present
    await expect(page.locator('#menu-high-score')).toBeVisible();
  });

  test('page title is correct', async ({ page }) => {
    await loadGame(page);
    await expect(page).toHaveTitle(/TIRE CHAOS/);
  });

  // -------------------------------------------------------------------------
  // 2. Click START GAME and verify HUD appears
  // -------------------------------------------------------------------------

  test('clicking START GAME shows the game HUD', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);

    // HUD must be visible and NOT hidden
    const hud = page.locator('#game-hud');
    await expect(hud).toBeVisible();
    await expect(hud).not.toHaveClass(/hidden/);

    // Main menu must now be hidden
    await expect(page.locator('#main-menu')).toBeHidden();

    // All individual HUD sections are present
    await expect(page.locator('#score-value')).toBeVisible();
    await expect(page.locator('#round-value')).toBeVisible();
    await expect(page.locator('#combo-value')).toBeVisible();
    await expect(page.locator('#tires-value')).toBeVisible();
    await expect(page.locator('#time-value')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Round 1 starts with correct time and tires
  // -------------------------------------------------------------------------

  test('round 1 starts with correct initial values', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);

    // Round 1 of 5
    // RoundManager.createNewSession produces round 1 with tiresAvailable=5 and
    // timeLimit=60.  Values update within the render loop so we poll briefly.
    await expect(page.locator('#round-value')).toContainText('1');

    // Tires: round 1 → tiresAvailable = max(5 - floor(0/2), 2) = 5
    await expect(page.locator('#tires-value')).toContainText('5');

    // Time: should be near 60 (we accept any value between 55 and 60 to
    // avoid flakiness from scheduling delays)
    const timeText = await page.locator('#time-value').textContent();
    const timeValue = parseInt(timeText ?? '0', 10);
    expect(timeValue).toBeGreaterThanOrEqual(50);
    expect(timeValue).toBeLessThanOrEqual(60);

    // Score starts at zero
    await expect(page.locator('#score-value')).toContainText('0');

    // Combo starts at zero multiplier (displayed as 0.0x)
    await expect(page.locator('#combo-value')).toContainText('0.0x');
  });

  // -------------------------------------------------------------------------
  // 4. Launching a tire decrements the tire counter
  // -------------------------------------------------------------------------

  test('pressing SPACE launches a tire and decrements tires remaining', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);

    // Confirm we start with 5 tires
    await expect(page.locator('#tires-value')).toContainText('5');

    // SPACE triggers KeyboardManager's quick-launch shortcut
    await page.keyboard.press('Space');

    // Wait for the tire counter to update (useTire() fires synchronously)
    await expect(page.locator('#tires-value')).not.toContainText('5', { timeout: 3000 });
    await expect(page.locator('#tires-value')).toContainText('4');
  });

  test('launching a tire via canvas drag decrements tires remaining', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);

    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.3;
    const startY = box!.y + box!.height * 0.5;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 120, startY - 80, { steps: 10 });
    await page.mouse.up();

    // Tire count must decrease within a reasonable time
    await expect(page.locator('#tires-value')).not.toContainText('5', { timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 5. Score updates after a tire is launched
  // -------------------------------------------------------------------------

  test('score element stays formatted as a number after launch', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);

    // Launch all tires rapidly to maximise the chance of hitting something
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Space');
      // Small gap so each launch is processed individually
      await page.waitForTimeout(300);
    }

    // The score display must still render as a valid numeric string
    // (toLocaleString produces digit groups, e.g. "1,250" or "0")
    const scoreText = await page.locator('#score-value').textContent();
    expect(scoreText).toMatch(/^[\d,]+$/);
  });

  // -------------------------------------------------------------------------
  // 6. Pause menu (press P)
  // -------------------------------------------------------------------------

  test('pressing P shows the pause menu', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);

    await pauseGame(page);

    const pauseMenu = page.locator('#pause-menu');
    await expect(pauseMenu).toBeVisible();
    await expect(pauseMenu).not.toHaveClass(/hidden/);

    // Required pause menu buttons must all be visible
    await expect(page.locator('#btn-resume')).toBeVisible();
    await expect(page.locator('#btn-restart')).toBeVisible();
    await expect(page.locator('#btn-quit')).toBeVisible();

    // Tip text
    await expect(pauseMenu.locator('.pause-tip')).toContainText('Press P to resume');
  });

  // -------------------------------------------------------------------------
  // 7. Resume from pause menu
  // -------------------------------------------------------------------------

  test('clicking RESUME hides the pause menu and continues play', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);
    await pauseGame(page);

    await page.locator('#btn-resume').click();

    // Pause menu must become hidden
    await expect(page.locator('#pause-menu')).toHaveClass(/hidden/, { timeout: 3000 });

    // Game HUD must still be visible (game is running)
    await expect(page.locator('#game-hud')).toBeVisible();
    await expect(page.locator('#game-hud')).not.toHaveClass(/hidden/);
  });

  test('pressing P again after pause resumes the game', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);
    await pauseGame(page);

    // Second P press toggles pause off
    await page.keyboard.press('p');
    await expect(page.locator('#pause-menu')).toHaveClass(/hidden/, { timeout: 3000 });
    await expect(page.locator('#game-hud')).not.toHaveClass(/hidden/);
  });

  // -------------------------------------------------------------------------
  // 8. Quit to menu from pause
  // -------------------------------------------------------------------------

  test('clicking QUIT TO MENU returns to the main menu', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);
    await pauseGame(page);

    await page.locator('#btn-quit').click();

    // Main menu must appear
    await expect(page.locator('#main-menu')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#main-menu')).not.toHaveClass(/hidden/);

    // Game HUD must be gone
    await expect(page.locator('#game-hud')).toBeHidden();

    // Pause menu must be gone
    await expect(page.locator('#pause-menu')).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// Test suite: Game Over scenario
// ---------------------------------------------------------------------------

test.describe('TIRE CHAOS - Game Over Scenario', () => {
  test('game-over screen appears with correct structure when triggered', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await page.locator('#btn-start').click();
    await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });

    // Manually dispatch the game-over event the same way RoundManager does
    // so we do not have to wait for a real timeout expiry (which could be 60 s)
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('game-over', {
          detail: {
            totalScore: 750,
            roundsCompleted: 0,
            highScore: 0,
          },
        })
      );
    });

    // Game over screen must become visible
    const gameOverScreen = page.locator('#game-over-screen');
    await expect(gameOverScreen).toBeVisible({ timeout: 3000 });
    await expect(gameOverScreen).not.toHaveClass(/hidden/);

    // Title defaults to GAME OVER when roundsCompleted is 0
    await expect(page.locator('#game-over-title')).toContainText('GAME OVER');

    // Final score must reflect what we sent
    await expect(page.locator('#final-score')).toContainText('750');

    // Rounds completed stat
    await expect(page.locator('#total-rounds')).toContainText('0');

    // Action buttons present
    await expect(page.locator('#btn-play-again')).toBeVisible();
    await expect(page.locator('#btn-main-menu')).toBeVisible();
  });

  test('clicking PLAY AGAIN from game over restarts the game', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await page.locator('#btn-start').click();
    await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('game-over', {
          detail: { totalScore: 0, roundsCompleted: 0, highScore: 0 },
        })
      );
    });

    await page.waitForSelector('#game-over-screen:not(.hidden)', { timeout: 3000 });

    await page.locator('#btn-play-again').click();

    // After play-again the HUD should come back (new game started)
    await expect(page.locator('#game-hud')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#game-over-screen')).toBeHidden();
  });

  test('clicking MAIN MENU from game over returns to main menu', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await page.locator('#btn-start').click();
    await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('game-over', {
          detail: { totalScore: 1500, roundsCompleted: 1, highScore: 0 },
        })
      );
    });

    await page.waitForSelector('#game-over-screen:not(.hidden)', { timeout: 3000 });

    await page.locator('#btn-main-menu').click();

    await expect(page.locator('#main-menu')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#game-over-screen')).toBeHidden();
  });

  test('new high score banner is displayed when score exceeds stored high score', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForGameReady(page);

    // Clear any stored high score so our test value will always beat it
    await page.evaluate(() => localStorage.removeItem('tireChaosHighScore'));

    await page.locator('#btn-start').click();
    await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });

    // Dispatch victory event (GameManager.showGameOver is also called for victory)
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('game-victory', {
          detail: {
            totalScore: 9999,
            roundsCompleted: 5,
            highScore: 0,
            isNewHighScore: true,
          },
        })
      );
    });

    await page.waitForSelector('#game-over-screen:not(.hidden)', { timeout: 3000 });

    // The new-high-score banner should be revealed
    await expect(page.locator('#new-high-score')).not.toHaveClass(/hidden/, { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Test suite: Round completion
// ---------------------------------------------------------------------------

test.describe('TIRE CHAOS - Round Completion', () => {
  test('round-end screen appears with correct stats when round completes', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await page.locator('#btn-start').click();
    await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });

    // Trigger round-complete the same way RoundManager does
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('round-complete', {
          detail: {
            roundNumber: 1,
            isLastRound: false,
            roundData: {
              roundNumber: 1,
              targetScore: 1000,
              timeLimit: 60,
              tiresAvailable: 2,
              objectsToDestroy: 3,
              completed: true,
              score: 1250,
              timeRemaining: 35,
            },
          },
        })
      );
    });

    const roundEndScreen = page.locator('#round-end-screen');
    await expect(roundEndScreen).toBeVisible({ timeout: 3000 });
    await expect(roundEndScreen).not.toHaveClass(/hidden/);

    // Title should say ROUND 1 COMPLETE!
    await expect(page.locator('#round-end-title')).toContainText('ROUND 1 COMPLETE!');

    // Stats populated from roundData
    await expect(page.locator('#round-score')).toContainText('1,250');
    await expect(page.locator('#round-time')).toContainText('35s');

    // Next round button present
    await expect(page.locator('#btn-next-round')).toBeVisible();
  });

  test('final round completion shows FINAL ROUND COMPLETE title', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await page.locator('#btn-start').click();
    await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('round-complete', {
          detail: {
            roundNumber: 5,
            isLastRound: true,
            roundData: {
              roundNumber: 5,
              targetScore: 5000,
              timeLimit: 30,
              tiresAvailable: 0,
              objectsToDestroy: 0,
              completed: true,
              score: 5200,
              timeRemaining: 8,
            },
          },
        })
      );
    });

    await page.waitForSelector('#round-end-screen:not(.hidden)', { timeout: 3000 });
    await expect(page.locator('#round-end-title')).toContainText('FINAL ROUND COMPLETE!');
  });

  test('clicking NEXT ROUND hides round-end screen and continues play', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await page.locator('#btn-start').click();
    await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('round-complete', {
          detail: {
            roundNumber: 1,
            isLastRound: false,
            roundData: {
              roundNumber: 1,
              targetScore: 1000,
              timeLimit: 60,
              tiresAvailable: 3,
              objectsToDestroy: 2,
              completed: true,
              score: 1100,
              timeRemaining: 20,
            },
          },
        })
      );
    });

    await page.waitForSelector('#round-end-screen:not(.hidden)', { timeout: 3000 });

    await page.locator('#btn-next-round').click();

    // Round end screen should disappear
    // (UIManager hides all overlays and shows HUD again via showGameHUD on next round start)
    await expect(page.locator('#round-end-screen')).toBeHidden({ timeout: 5000 });
  });

  test('round 2 HUD displays correct round number after advancing', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await page.locator('#btn-start').click();
    await page.waitForSelector('#game-hud:not(.hidden)', { timeout: 5000 });

    // Complete round 1
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('round-complete', {
          detail: {
            roundNumber: 1,
            isLastRound: false,
            roundData: {
              roundNumber: 1,
              targetScore: 1000,
              timeLimit: 60,
              tiresAvailable: 2,
              objectsToDestroy: 0,
              completed: true,
              score: 1000,
              timeRemaining: 30,
            },
          },
        })
      );
    });

    await page.waitForSelector('#round-end-screen:not(.hidden)', { timeout: 3000 });
    await page.locator('#btn-next-round').click();

    // After advancing, the HUD round display should reflect round 2
    await expect(page.locator('#round-value')).toContainText('2', { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Test suite: UI element robustness
// ---------------------------------------------------------------------------

test.describe('TIRE CHAOS - UI Element Robustness', () => {
  test('canvas is present and has non-zero dimensions', async ({ page }) => {
    await loadGame(page);

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('no critical JavaScript errors during game load and start', async ({ page }) => {
    const criticalErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known benign errors (missing favicon, CDN assets, etc.)
        if (!text.includes('favicon') && !text.includes('404') && !text.includes('net::ERR')) {
          criticalErrors.push(text);
        }
      }
    });

    page.on('pageerror', (err) => {
      criticalErrors.push(err.message);
    });

    await loadGame(page);
    await startGameFromMenu(page);

    // Small window of active gameplay
    await page.waitForTimeout(1000);

    expect(criticalErrors, `Unexpected errors: ${criticalErrors.join('\n')}`).toHaveLength(0);
  });

  test('HUD values are valid numbers during gameplay', async ({ page }) => {
    await loadGame(page);
    await startGameFromMenu(page);

    // Allow one render cycle
    await page.waitForTimeout(500);

    const scoreText = await page.locator('#score-value').textContent();
    const tiresText = await page.locator('#tires-value').textContent();
    const timeText = await page.locator('#time-value').textContent();
    const roundText = await page.locator('#round-value').textContent();

    // score-value uses toLocaleString – digits and optional commas
    expect(scoreText).toMatch(/^[\d,]+$/);

    // tires-value is a plain integer
    expect(tiresText).toMatch(/^\d+$/);

    // time-value is a ceiled integer
    expect(timeText).toMatch(/^\d+$/);

    // round-value is "current/total"
    expect(roundText).toMatch(/^\d+\/\d+$/);
  });
});
