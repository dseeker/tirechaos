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
  
  // Full screenshot - before launch
  await page.screenshot({ path: '/tmp/ss_idle.png' });
  
  // Launch tire
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/ss_launched.png' });
  
  // Check for overlapping elements
  const overlaps = await page.evaluate(() => {
    function getBR(id) {
      const el = document.getElementById(id) || document.querySelector(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) };
    }
    function overlaps(a, b) {
      if (!a || !b) return false;
      return !(a.right < b.x || b.right < a.x || a.bottom < b.y || b.bottom < a.y);
    }
    const lc = getBR('#launch-control-ui');
    const ht = getBR('.hud-top');
    const hb = getBR('.hud-bottom');
    return {
      launchControl: lc,
      hudTop: ht,
      hudBottom: hb,
      lcOverlapsHudTop: overlaps(lc, ht),
      lcOverlapsHudBottom: overlaps(lc, hb),
      powerMeterExists: !!document.querySelector('.power-meter-container'),
    };
  });
  console.log('Layout analysis:', JSON.stringify(overlaps, null, 2));

} catch (e) {
  console.error('Error:', e.message);
  await page.screenshot({ path: '/tmp/ss_error.png' });
}
await browser.close();
