import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
});

const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });

console.log('Navigating to game...');
await page.goto('http://localhost:3000/');

try {
  // Wait for loading screen to be hidden and main menu to be visible
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 25000 });
  await page.waitForSelector('#main-menu', { state: 'visible', timeout: 5000 });
  console.log('Menu visible, taking screenshot');
  await page.screenshot({ path: '/tmp/screenshot_menu.png' });

  await page.click('#btn-start');
  await page.waitForSelector('#game-hud', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(2500);
  
  console.log('Game running, taking screenshots');
  await page.screenshot({ path: '/tmp/screenshot_game.png' });
  await page.screenshot({ path: '/tmp/screenshot_bottom.png', clip: { x: 0, y: 360, width: 1280, height: 360 } });
  await page.screenshot({ path: '/tmp/screenshot_top.png', clip: { x: 0, y: 0, width: 1280, height: 160 } });
  await page.screenshot({ path: '/tmp/screenshot_left.png', clip: { x: 0, y: 0, width: 450, height: 720 } });

  console.log('Done');
} catch (e) {
  console.error('Error:', e.message);
  await page.screenshot({ path: '/tmp/screenshot_error.png' });
}

await browser.close();
