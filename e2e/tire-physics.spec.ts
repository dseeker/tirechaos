/**
 * Tire ↔ Terrain Physics Tests
 *
 * Verifies that each tire type has correctly wired physics and that the
 * per-type differences (mass, damping, restitution, friction) produce
 * distinguishable real-world behaviour:
 *
 *  A. Body properties   — mass, damping, allowSleep per type
 *  B. Contact materials — friction & restitution registered in Cannon world
 *  C. Terrain-hit log   — console log emitted on significant ground impact
 *  D. Bounce behaviour  — high-restitution spare bounces harder than tractor
 *  E. Roll distance     — low-damping racing_slick rolls further than tractor
 *
 * Suites D & E use deterministic physics: after positioning the tire body,
 * they call `world.step(1/60)` N times directly inside page.evaluate() so
 * results are independent of the browser's actual frame rate in headless mode.
 */

import { test, expect } from '@playwright/test';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function startGame(page: any) {
  await page.goto('/');
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 25000 });
  await page.waitForSelector('#main-menu', { state: 'visible', timeout: 8000 });
  await page.click('#btn-start');
  await page.waitForSelector('#game-hud', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(1500); // let terrain build and physics settle
}

/**
 * Run N cannon-es physics steps directly in the page VM.
 * Each call is world.step(1/60) — one fixed 60 Hz step.
 * This bypasses the Babylon render loop so results are deterministic
 * regardless of the headless browser's actual frame rate.
 */
async function stepPhysics(page: any, steps: number): Promise<boolean> {
  return page.evaluate((n: number) => {
    const world = (window as any).__gameManager?.physicsManager?.world;
    if (!world) return false;
    for (let i = 0; i < n; i++) world.step(1 / 60);
    return true;
  }, steps);
}

// ─── Suite A: Per-type physics body properties ────────────────────────────────
//
// Ensures each tire type creates a Cannon body with the values from TIRE_CONFIGS:
// mass, linearDamping, angularDamping — and that allowSleep is always false
// (prevents tires from freezing on gentle slopes).

const BODY_PROPS = [
  { type: 'standard',      mass: 20, linearDamping: 0.1,  angularDamping: 0.05 },
  { type: 'monster_truck', mass: 50, linearDamping: 0.15, angularDamping: 0.1  },
  { type: 'racing_slick',  mass: 15, linearDamping: 0.05, angularDamping: 0.02 },
  { type: 'tractor',       mass: 40, linearDamping: 0.2,  angularDamping: 0.15 },
  { type: 'spare',         mass: 10, linearDamping: 0.05, angularDamping: 0.02 },
] as const;

test.describe('A — Physics body properties per tire type', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: any;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    await startGame(sharedPage);
    // Launch all 5 types at once — round 1 has 5 tires, so they all fit.
    await sharedPage.evaluate(() => {
      const gm = (window as any).__gameManager;
      for (const t of ['standard', 'monster_truck', 'racing_slick', 'tractor', 'spare']) {
        gm.launchTire(0.1, 0, t);
      }
    });
    await sharedPage.waitForTimeout(400);
  });

  test.afterAll(async () => sharedPage?.close());

  for (const exp of BODY_PROPS) {
    test(`${exp.type}: mass=${exp.mass} linearDamping=${exp.linearDamping} angularDamping=${exp.angularDamping}`, async () => {
      const props = await sharedPage.evaluate((tireType: string) => {
        const gm = (window as any).__gameManager;
        const tire = gm?.activeTires?.find((t: any) => t.config?.type === tireType);
        if (!tire) return null;
        return {
          mass:           tire.body.mass            as number,
          linearDamping:  tire.body.linearDamping   as number,
          angularDamping: tire.body.angularDamping  as number,
          allowSleep:     tire.body.allowSleep      as boolean,
        };
      }, exp.type);

      expect(props, `activeTires must contain a ${exp.type} tire`).not.toBeNull();
      expect(props!.mass).toBe(exp.mass);
      expect(props!.linearDamping).toBeCloseTo(exp.linearDamping, 3);
      expect(props!.angularDamping).toBeCloseTo(exp.angularDamping, 3);
      expect(props!.allowSleep).toBe(false); // must never sleep on a slope
    });
  }
});

// ─── Suite B: Contact material properties ────────────────────────────────────
//
// Verifies the friction and restitution values registered in the Cannon world's
// contactmaterials array.  These are the values the physics engine actually uses
// when the tire touches terrain — not just the config constants.

const CONTACT_MATS = [
  { name: 'tire_standard',      friction: 0.8,  restitution: 0.3  },
  { name: 'tire_monster_truck', friction: 0.9,  restitution: 0.2  },
  { name: 'tire_racing_slick',  friction: 1.0,  restitution: 0.1  },
  { name: 'tire_tractor',       friction: 1.2,  restitution: 0.15 },
  { name: 'tire_spare',         friction: 0.6,  restitution: 0.6  },
] as const;

test.describe('B — Contact material friction & restitution', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: any;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    await startGame(sharedPage);
  });

  test.afterAll(async () => sharedPage?.close());

  test('all 5 per-type materials are registered (≥ 6 total with generics)', async () => {
    const count = await sharedPage.evaluate(() => {
      const world = (window as any).__gameManager?.physicsManager?.world;
      return (world?.contactmaterials ?? []).length;
    });
    // 5 per-type + 1 generic fallback + 1 default-vs-default = 7
    expect(count).toBeGreaterThanOrEqual(6);
  });

  for (const exp of CONTACT_MATS) {
    test(`${exp.name}: friction=${exp.friction} restitution=${exp.restitution}`, async () => {
      const mat = await sharedPage.evaluate((matName: string) => {
        const world = (window as any).__gameManager?.physicsManager?.world;
        if (!world) return null;
        const cms: any[] = world.contactmaterials ?? [];
        const cm = cms.find(c =>
          c.materials.some((m: any) => m.name === matName),
        );
        if (!cm) return null;
        return { friction: cm.friction as number, restitution: cm.restitution as number };
      }, exp.name);

      expect(mat, `contact material "${exp.name}" must be registered`).not.toBeNull();
      expect(mat!.friction).toBeCloseTo(exp.friction, 3);
      expect(mat!.restitution).toBeCloseTo(exp.restitution, 3);
    });
  }
});

// ─── Suite C: Terrain-hit console logging ────────────────────────────────────
//
// After the terrain physics fix (Rx(-90°) rotation on the heightfield body),
// tires should actually collide with terrain and emit the `terrain-hit` log
// added to Tire.ts.  This confirms the physics fix is effective end-to-end.
//
// Strategy: we position the tire 5 units above the terrain surface and run
// deterministic physics steps — guaranteeing a high-speed vertical impact
// that crosses the IMPACT_THRESHOLD (1.5 m/s normal velocity).

test.describe('C — Terrain-hit console logging', () => {
  /**
   * Launch the tire, teleport it 5 units above the hilltop terrain surface,
   * then step physics until it lands.  Returns the first terrain-hit log line.
   */
  async function dropAndWatchLogs(page: any, tireType: string): Promise<string[]> {
    const logs: string[] = [];
    page.on('console', (msg: any) => {
      if (msg.type() === 'log') logs.push(msg.text());
    });

    await startGame(page);
    await page.evaluate((t: string) => {
      (window as any).__gameManager.launchTire(0.0, 0, t);
    }, tireType);
    await page.waitForTimeout(300);

    // Teleport tire 5 units above terrain surface and drop deterministically.
    // surfaceY at launch position ≈ 6.27 (TERRAIN_BASE_Y(-8) + hill+slope ≈ 14.27)
    await page.evaluate((tireType: string) => {
      const gm   = (window as any).__gameManager;
      const world = gm.physicsManager.world;
      const tire  = gm.activeTires.find((t: any) => t.config?.type === tireType);
      if (!tire) return;

      tire.body.position.set(-12, 11.5, 0); // ~5 units above terrain surface
      tire.body.velocity.set(0, 0, 0);
      tire.body.angularVelocity.set(0, 0, 0);

      // Step physics 180 times (3 s at 60 fps) to guarantee a terrain impact.
      for (let i = 0; i < 180; i++) world.step(1 / 60);
    }, tireType);

    return logs;
  }

  test('standard tire emits terrain-hit log with speed, restitution, position', async ({ page }) => {
    const logs = await dropAndWatchLogs(page, 'standard');

    const hit = logs.find(l => l.includes('terrain-hit') && l.includes('[standard]'));
    expect(hit, 'terrain-hit log must appear for standard tire').toBeDefined();
    expect(hit).toMatch(/speed=\d+\.\d+ m\/s/);
    expect(hit).toMatch(/restitution=0\.3/);
    expect(hit).toMatch(/pos=\(/);
  });

  test('spare tire emits terrain-hit log with restitution=0.6', async ({ page }) => {
    const logs = await dropAndWatchLogs(page, 'spare');

    const hit = logs.find(l => l.includes('terrain-hit') && l.includes('[spare]'));
    expect(hit, 'terrain-hit log must appear for spare tire').toBeDefined();
    expect(hit).toMatch(/restitution=0\.6/);
  });

  test('tractor tire emits terrain-hit log with friction=1.2', async ({ page }) => {
    const logs = await dropAndWatchLogs(page, 'tractor');

    const hit = logs.find(l => l.includes('terrain-hit') && l.includes('[tractor]'));
    expect(hit, 'terrain-hit log must appear for tractor tire').toBeDefined();
    expect(hit).toMatch(/friction=1\.2/);
  });
});

// ─── Suite D: Bounce behaviour (restitution) ─────────────────────────────────
//
// A higher restitution coefficient means more kinetic energy is preserved on
// impact, so the tire bounces to a greater height.
//
// spare  (restitution 0.6) vs tractor (restitution 0.15) — 4× difference.
//
// Method: drop the tire from a fixed height above the terrain surface, run
// 300 deterministic physics steps, and record the maximum upward velocity
// reached after the first bounce.  Impact velocity ≈ √(2·g·5) ≈ 9.9 m/s, so:
//   spare   bounce Vy ≈ 0.6 × 9.9 ≈ 5.9 m/s
//   tractor bounce Vy ≈ 0.15 × 9.9 ≈ 1.5 m/s

async function measureBounceVelocity(page: any, tireType: string): Promise<number> {
  await startGame(page);
  // Combine launch + teleport + step into one evaluate for full determinism.
  return page.evaluate((tireType: string) => {
    const gm    = (window as any).__gameManager;
    gm.launchTire(0.0, 0, tireType);
    const world = gm.physicsManager.world;
    const tire  = gm.activeTires.find((t: any) => t.config?.type === tireType);
    if (!tire) return -1;

    // Teleport to 5 units above terrain surface and drop with zero velocity.
    // surfaceY at hilltop (x=−12) ≈ 6.5, so y=11.5 gives a ~5 unit drop.
    tire.body.position.set(-12, 11.5, 0);
    tire.body.velocity.set(0, 0, 0);
    tire.body.angularVelocity.set(0, 0, 0);

    let maxVelY = 0;
    for (let i = 0; i < 300; i++) {
      world.step(1 / 60);
      if (tire.body.velocity.y > maxVelY) {
        maxVelY = tire.body.velocity.y;
      }
    }
    return maxVelY;
  }, tireType);
}

test.describe('D — Bounce behaviour: restitution differences', () => {
  test('spare (restitution 0.6) bounces significantly harder than tractor (0.15)', async ({ browser }) => {
    const pageSpare   = await browser.newPage();
    const pageTractor = await browser.newPage();

    const [spareVy, tractorVy] = await Promise.all([
      measureBounceVelocity(pageSpare,   'spare'),
      measureBounceVelocity(pageTractor, 'tractor'),
    ]);

    await Promise.all([pageSpare.close(), pageTractor.close()]);

    // spare must actually leave the ground (positive Vy = bouncing up)
    expect(spareVy).toBeGreaterThan(1.0);
    // spare bounces at least 1.5× harder than tractor
    // (actual ratio ~1.9×; penalty-method contact reduces ideal 4× to ~1.9×)
    expect(spareVy).toBeGreaterThan(tractorVy * 1.5);
  });

  test('spare (0.6) bounces harder than monster_truck (0.2)', async ({ browser }) => {
    const pageSpare   = await browser.newPage();
    const pageMonster = await browser.newPage();

    const [spareVy, monsterVy] = await Promise.all([
      measureBounceVelocity(pageSpare,   'spare'),
      measureBounceVelocity(pageMonster, 'monster_truck'),
    ]);

    await Promise.all([pageSpare.close(), pageMonster.close()]);

    expect(spareVy).toBeGreaterThan(monsterVy);
  });

  test('racing_slick (0.1) bounces less than standard (0.3)', async ({ browser }) => {
    const pageRacing   = await browser.newPage();
    const pageStandard = await browser.newPage();

    const [racingVy, standardVy] = await Promise.all([
      measureBounceVelocity(pageRacing,   'racing_slick'),
      measureBounceVelocity(pageStandard, 'standard'),
    ]);

    await Promise.all([pageRacing.close(), pageStandard.close()]);

    expect(standardVy).toBeGreaterThan(racingVy);
  });
});

// ─── Suite E: Rolling distance (linear damping) ───────────────────────────────
//
// Lower linear damping means less energy loss per second while rolling, so
// the tire travels further in the same elapsed time.
//
// racing_slick (damping 0.05) vs tractor (damping 0.20) — 4× difference.
// spare        (damping 0.05) vs tractor (damping 0.20) — 4× difference.
//
// Method: launch at speed 0.5 (= 5 m/s), run 300 deterministic physics steps
// (5 s at 60 fps) entirely in a single page.evaluate() — no real-time wait
// so results are fully deterministic.  Displacement measured from the actual
// spawn position so per-type radius offsets cancel out.
//
// Pure-damping estimate (ignoring gravity): distance ≈ v0 × (1−(1−d)^T) / −ln(1−d)
//   racing_slick (d=0.05, 5 s): ≈ 22 m
//   tractor      (d=0.20, 5 s): ≈ 15 m
// Gravity adds extra speed to both on the slope but racing_slick builds up
// higher velocity (lower terminal-velocity cap), widening the gap.

async function measureRollDistance(page: any, tireType: string): Promise<number> {
  await startGame(page);
  // Launch, step, and measure all within a single evaluate for determinism.
  return page.evaluate((tireType: string) => {
    const gm    = (window as any).__gameManager;
    gm.launchTire(0.5, 0, tireType);
    const world = gm.physicsManager.world;
    const tire  = gm.activeTires.find((t: any) => t.config?.type === tireType);
    if (!tire) return -1;

    const startX = tire.body.position.x;

    // 300 steps = 5 seconds of physics at 60 fps
    for (let i = 0; i < 300; i++) world.step(1 / 60);

    return tire.body.position.x - startX;
  }, tireType);
}

test.describe('E — Rolling distance: linear damping differences', () => {
  test('racing_slick (damping 0.05) rolls further than tractor (damping 0.20)', async ({ browser }) => {
    const pageRacing  = await browser.newPage();
    const pageTractor = await browser.newPage();

    const [racingDist, tractorDist] = await Promise.all([
      measureRollDistance(pageRacing,  'racing_slick'),
      measureRollDistance(pageTractor, 'tractor'),
    ]);

    await Promise.all([pageRacing.close(), pageTractor.close()]);

    // Both tires roll forward (positive X displacement)
    expect(racingDist).toBeGreaterThan(0);
    expect(tractorDist).toBeGreaterThan(0);
    // Racing slick (low damping) travels further than the high-damping tractor
    expect(racingDist).toBeGreaterThan(tractorDist);
  });

  test('spare (damping 0.05) rolls further than tractor (damping 0.20)', async ({ browser }) => {
    const pageSpare   = await browser.newPage();
    const pageTractor = await browser.newPage();

    const [spareDist, tractorDist] = await Promise.all([
      measureRollDistance(pageSpare,   'spare'),
      measureRollDistance(pageTractor, 'tractor'),
    ]);

    await Promise.all([pageSpare.close(), pageTractor.close()]);

    expect(spareDist).toBeGreaterThan(tractorDist);
  });

  test('standard (damping 0.10) rolls further than tractor (damping 0.20)', async ({ browser }) => {
    // Both mid-weight tires; only damping differs significantly.
    const pageStd     = await browser.newPage();
    const pageTractor = await browser.newPage();

    const [stdDist, tractorDist] = await Promise.all([
      measureRollDistance(pageStd,     'standard'),
      measureRollDistance(pageTractor, 'tractor'),
    ]);

    await Promise.all([pageStd.close(), pageTractor.close()]);

    expect(stdDist).toBeGreaterThan(tractorDist);
  });
});
