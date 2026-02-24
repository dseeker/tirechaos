import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
});

const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });
await page.goto('http://localhost:3000/');

try {
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 25000 });
  await page.waitForSelector('#main-menu', { state: 'visible', timeout: 5000 });
  await page.click('#btn-start');
  await page.waitForSelector('#game-hud', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(2500);
  
  // Close-up of launch control
  await page.screenshot({ path: '/tmp/ss_lc_zoom.png', clip: { x: 0, y: 270, width: 420, height: 445 } });
  
  // HUD top close-up
  await page.screenshot({ path: '/tmp/ss_hud_top.png', clip: { x: 430, y: 0, width: 430, height: 115 } });
  
  // HUD bottom close-up  
  await page.screenshot({ path: '/tmp/ss_hud_bottom.png', clip: { x: 430, y: 510, width: 430, height: 120 } });
  
  // Right half of game view (unobstructed terrain)
  await page.screenshot({ path: '/tmp/ss_terrain.png', clip: { x: 410, y: 0, width: 870, height: 720 } });

  console.log('Done');
} catch (e) {
  console.error('Error:', e.message);
}
await browser.close();
