import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',
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
  await page.waitForTimeout(2000);
  
  // Launch a tire with space
  await page.keyboard.press('Space');
  await page.waitForTimeout(1000);
  
  console.log('After launch screenshot');
  await page.screenshot({ path: '/tmp/screenshot_after_launch.png' });
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/screenshot_rolling.png' });
  
  // Check tire position via JS
  const tireInfo = await page.evaluate(() => {
    const gm = window.__gameManager;
    if (!gm || !gm.activeTires || !gm.activeTires[0]) return null;
    const t = gm.activeTires[0];
    return {
      posX: t.body.position.x.toFixed(2),
      posY: t.body.position.y.toFixed(2), 
      posZ: t.body.position.z.toFixed(2),
      isLaunched: t.isLaunched,
      launchSurfaceY: gm._launchTerrainSurfaceY ? gm._launchTerrainSurfaceY.toFixed(2) : 'N/A'
    };
  });
  console.log('Tire info:', JSON.stringify(tireInfo));

  // Also get the UI layout info
  const uiInfo = await page.evaluate(() => {
    const lc = document.getElementById('launch-control-ui');
    const hudTop = document.querySelector('.hud-top');
    const hudBottom = document.querySelector('.hud-bottom');
    const powerMeter = document.querySelector('.power-meter-container');
    const r = (el) => el ? JSON.stringify(el.getBoundingClientRect()) : 'null';
    return {
      launchControl: r(lc),
      hudTop: r(hudTop),
      hudBottom: r(hudBottom),
      powerMeter: r(powerMeter),
    };
  });
  console.log('UI bounding rects:', JSON.stringify(uiInfo, null, 2));

} catch (e) {
  console.error('Error:', e.message);
  await page.screenshot({ path: '/tmp/screenshot_error2.png' });
}

await browser.close();
