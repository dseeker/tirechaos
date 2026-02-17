/**
 * LaunchControlUI - Interactive UI component for controlling tire launch parameters.
 * Provides sliders for power and angle, a LAUNCH button, and keyboard shortcuts.
 */
export class LaunchControlUI {
  private container: HTMLElement | null = null;

  // Current values
  private power: number = 0.5;
  private angle: number = 45;

  // Step sizes for keyboard adjustment
  private readonly POWER_STEP = 0.05;
  private readonly ANGLE_STEP = 5;

  // Clamp limits
  private readonly POWER_MIN = 0;
  private readonly POWER_MAX = 1;
  private readonly ANGLE_MIN = 0;
  private readonly ANGLE_MAX = 90;

  // Keyboard event handler references (for cleanup)
  private keydownHandler: (e: KeyboardEvent) => void;

  // Launch callback
  private onLaunch: (power: number, angle: number) => void;

  constructor(onLaunch: (power: number, angle: number) => void) {
    this.onLaunch = onLaunch;
    this.keydownHandler = this.handleKeydown.bind(this);
    this.createElement();
    this.setupKeyboardShortcuts();
    console.log('Launch Control UI initialized');
  }

  /**
   * Build the DOM structure for the launch control panel.
   */
  private createElement(): void {
    const existing = document.getElementById('launch-control-ui');
    if (existing) {
      this.container = existing;
      return;
    }

    const el = document.createElement('div');
    el.id = 'launch-control-ui';
    el.className = 'launch-control hidden';
    el.innerHTML = `
      <div class="launch-control__header">
        <span class="launch-control__title">LAUNCH CONTROL</span>
        <span class="launch-control__hint">ARROW KEYS &bull; SPACE</span>
      </div>

      <div class="launch-control__body">

        <!-- Power slider -->
        <div class="launch-control__row">
          <label class="launch-control__label" for="lc-power-slider">
            <span class="launch-control__label-text">POWER</span>
            <span id="lc-power-value" class="launch-control__value launch-control__value--power">50%</span>
          </label>
          <div class="launch-control__slider-track">
            <div id="lc-power-fill" class="launch-control__slider-fill launch-control__slider-fill--power" style="width:50%"></div>
            <input
              id="lc-power-slider"
              class="launch-control__slider"
              type="range"
              min="0" max="100" step="1"
              value="50"
              aria-label="Launch power"
            />
          </div>
          <div class="launch-control__ticks">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>MAX</span>
          </div>
        </div>

        <!-- Angle slider -->
        <div class="launch-control__row">
          <label class="launch-control__label" for="lc-angle-slider">
            <span class="launch-control__label-text">ANGLE</span>
            <span id="lc-angle-value" class="launch-control__value launch-control__value--angle">45&deg;</span>
          </label>
          <div class="launch-control__slider-track">
            <div id="lc-angle-fill" class="launch-control__slider-fill launch-control__slider-fill--angle" style="width:50%"></div>
            <input
              id="lc-angle-slider"
              class="launch-control__slider"
              type="range"
              min="0" max="90" step="1"
              value="45"
              aria-label="Launch angle"
            />
          </div>
          <div class="launch-control__ticks">
            <span>0&deg;</span><span>22&deg;</span><span>45&deg;</span><span>67&deg;</span><span>90&deg;</span>
          </div>
        </div>

        <!-- Trajectory preview arc -->
        <div class="launch-control__preview" aria-hidden="true">
          <svg
            id="lc-arc-svg"
            class="launch-control__arc-svg"
            viewBox="0 0 200 100"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Background grid lines -->
            <line x1="0" y1="100" x2="200" y2="100" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
            <line x1="0" y1="75"  x2="200" y2="75"  stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
            <line x1="0" y1="50"  x2="200" y2="50"  stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
            <line x1="0" y1="25"  x2="200" y2="25"  stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>

            <!-- Trajectory arc (dynamically updated) -->
            <path
              id="lc-arc-path"
              fill="none"
              stroke="url(#lc-arc-gradient)"
              stroke-width="2.5"
              stroke-linecap="round"
              d="M10,90 Q105,10 190,90"
            />

            <!-- Launch origin dot -->
            <circle cx="10" cy="90" r="4" fill="var(--lc-power-color, #ff6b35)"/>

            <!-- Landing dot (dynamically updated) -->
            <circle id="lc-arc-landing" cx="190" cy="90" r="4" fill="var(--lc-angle-color, #00d9ff)"/>

            <!-- Arrow at peak (dynamically updated) -->
            <polygon
              id="lc-arc-arrow"
              points="100,20 96,28 104,28"
              fill="var(--lc-angle-color, #00d9ff)"
              opacity="0.8"
            />

            <defs>
              <linearGradient id="lc-arc-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stop-color="#ff6b35"/>
                <stop offset="100%" stop-color="#00d9ff"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

      </div>

      <!-- Launch button -->
      <button id="lc-launch-btn" class="launch-control__launch-btn" type="button">
        <span class="launch-control__btn-icon">&#9654;</span>
        LAUNCH
      </button>
    `;

    document.body.appendChild(el);
    this.container = el;

    // Bind slider interactions
    this.bindSliders();
  }

  /**
   * Attach change / input listeners to the sliders.
   */
  private bindSliders(): void {
    const powerSlider = document.getElementById('lc-power-slider') as HTMLInputElement | null;
    const angleSlider = document.getElementById('lc-angle-slider') as HTMLInputElement | null;
    const launchBtn   = document.getElementById('lc-launch-btn');

    powerSlider?.addEventListener('input', () => {
      this.power = parseInt(powerSlider.value, 10) / 100;
      this.refreshDisplay();
    });

    angleSlider?.addEventListener('input', () => {
      this.angle = parseInt(angleSlider.value, 10);
      this.refreshDisplay();
    });

    launchBtn?.addEventListener('click', () => {
      this.triggerLaunch();
    });
  }

  /**
   * Register arrow-key shortcuts for fine-tuning and SPACE for launching.
   * Only acts when the UI is visible to avoid conflicts with other shortcuts.
   */
  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Handle keyboard events for launch control.
   */
  private handleKeydown(e: KeyboardEvent): void {
    if (!this.container || this.container.classList.contains('hidden')) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.adjustPower(this.POWER_STEP);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.adjustPower(-this.POWER_STEP);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.adjustAngle(this.ANGLE_STEP);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.adjustAngle(-this.ANGLE_STEP);
        break;
      case ' ':
        // SPACE is also registered in KeyboardManager for quick launch.
        // The LaunchControlUI launch uses the current slider values, so we
        // only intercept here; KeyboardManager's callback still fires with
        // its own hardcoded values unless the consumer wires them together.
        e.preventDefault();
        this.triggerLaunch();
        break;
    }
  }

  /**
   * Adjust power by delta, clamped to [POWER_MIN, POWER_MAX].
   */
  private adjustPower(delta: number): void {
    this.power = Math.min(this.POWER_MAX, Math.max(this.POWER_MIN, this.power + delta));
    this.refreshDisplay();
    this.flashControl('power');
  }

  /**
   * Adjust angle by delta, clamped to [ANGLE_MIN, ANGLE_MAX].
   */
  private adjustAngle(delta: number): void {
    this.angle = Math.min(this.ANGLE_MAX, Math.max(this.ANGLE_MIN, this.angle + delta));
    this.refreshDisplay();
    this.flashControl('angle');
  }

  /**
   * Trigger the launch callback and play a brief button-press animation.
   */
  private triggerLaunch(): void {
    this.onLaunch(this.power, this.angle);

    // Visual feedback: briefly scale the button
    const btn = document.getElementById('lc-launch-btn');
    if (btn) {
      btn.classList.add('launch-control__launch-btn--fired');
      setTimeout(() => btn.classList.remove('launch-control__launch-btn--fired'), 250);
    }
  }

  /**
   * Briefly highlight the changed control to give tactile feedback.
   */
  private flashControl(type: 'power' | 'angle'): void {
    const id = type === 'power' ? 'lc-power-value' : 'lc-angle-value';
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('launch-control__value--flash');
    setTimeout(() => el.classList.remove('launch-control__value--flash'), 200);
  }

  /**
   * Update all visual elements to reflect the current power/angle values.
   */
  private refreshDisplay(): void {
    // ---- Power ----
    const powerPct = Math.round(this.power * 100);

    const powerSlider = document.getElementById('lc-power-slider') as HTMLInputElement | null;
    if (powerSlider) powerSlider.value = powerPct.toString();

    const powerFill = document.getElementById('lc-power-fill');
    if (powerFill) powerFill.style.width = `${powerPct}%`;

    const powerValue = document.getElementById('lc-power-value');
    if (powerValue) powerValue.textContent = `${powerPct}%`;

    // Colour the fill based on power intensity
    if (powerFill) {
      if (this.power < 0.33) {
        powerFill.style.background = 'linear-gradient(90deg, #00ff88, #00d9ff)';
      } else if (this.power < 0.67) {
        powerFill.style.background = 'linear-gradient(90deg, #00d9ff, #ffcc00)';
      } else {
        powerFill.style.background = 'linear-gradient(90deg, #ffcc00, #ff6b35)';
      }
    }

    // ---- Angle ----
    const anglePct = (this.angle / 90) * 100;

    const angleSlider = document.getElementById('lc-angle-slider') as HTMLInputElement | null;
    if (angleSlider) angleSlider.value = this.angle.toString();

    const angleFill = document.getElementById('lc-angle-fill');
    if (angleFill) angleFill.style.width = `${anglePct}%`;

    const angleValue = document.getElementById('lc-angle-value');
    if (angleValue) angleValue.textContent = `${Math.round(this.angle)}\u00b0`;

    // ---- SVG arc preview ----
    this.updateArc();
  }

  /**
   * Recalculate and repaint the parabolic trajectory arc in the SVG preview.
   * Uses a simplified projectile model in SVG coordinate space.
   */
  private updateArc(): void {
    const svg = document.getElementById('lc-arc-svg') as SVGSVGElement | null;
    const arcPath   = document.getElementById('lc-arc-path')    as SVGPathElement | null;
    const arcLanding = document.getElementById('lc-arc-landing') as SVGCircleElement | null;
    const arcArrow  = document.getElementById('lc-arc-arrow')   as SVGPolygonElement | null;

    if (!svg || !arcPath) return;

    // SVG canvas dimensions (see viewBox)
    const W = 200;
    const H = 100;
    const groundY = 90;   // Y position of the "ground" line
    const originX = 10;
    const originY = groundY;

    const angleRad = (this.angle * Math.PI) / 180;
    const speed = 0.5 + this.power * 1.5; // Normalised speed in SVG units

    const vx = Math.cos(angleRad) * speed;
    const vy = -Math.sin(angleRad) * speed; // Negative = upward in SVG coords
    const gravity = 0.018; // Normalised gravity

    // Sample trajectory points
    const points: Array<[number, number]> = [];
    let t = 0;
    let px = originX;
    let py = originY;
    let landingX = originX;

    const maxT = 300; // Safety cap
    while (t < maxT) {
      px = originX + vx * t;
      py = originY + vy * t + 0.5 * gravity * t * t;

      if (py > groundY && t > 0) {
        // Linearly interpolate to exact ground crossing
        const prevPy = originY + vy * (t - 1) + 0.5 * gravity * (t - 1) * (t - 1);
        const frac = (groundY - prevPy) / (py - prevPy);
        landingX = originX + vx * (t - 1 + frac);
        landingX = Math.min(landingX, W - 10);
        break;
      }

      points.push([Math.min(px, W - 10), py]);
      t++;
    }

    if (points.length < 2) {
      // Degenerate case (power = 0 or angle = 0): draw a flat line
      arcPath.setAttribute('d', `M${originX},${groundY} L${originX + 5},${groundY}`);
      return;
    }

    // Build smooth SVG path using cubic bezier
    const d = this.buildSmoothPath(points);
    arcPath.setAttribute('d', d);

    // Update landing dot
    if (arcLanding) {
      arcLanding.setAttribute('cx', landingX.toString());
      arcLanding.setAttribute('cy', groundY.toString());
    }

    // Update peak arrow: find highest (smallest Y) point
    let peakX = originX;
    let peakY = groundY;
    for (const [x, y] of points) {
      if (y < peakY) {
        peakY = y;
        peakX = x;
      }
    }

    if (arcArrow) {
      // Translate the arrow polygon to the peak
      const size = 5;
      const pts = `${peakX},${peakY - size} ${peakX - size},${peakY + size} ${peakX + size},${peakY + size}`;
      arcArrow.setAttribute('points', pts);
    }
  }

  /**
   * Build a smooth SVG path string through an array of [x, y] points using
   * Catmull-Rom converted to cubic bezier control points.
   */
  private buildSmoothPath(pts: Array<[number, number]>): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;

    // Subsample to keep path manageable
    const step = Math.max(1, Math.floor(pts.length / 30));
    const sampled: Array<[number, number]> = pts.filter((_, i) => i % step === 0);
    if (sampled[sampled.length - 1] !== pts[pts.length - 1]) {
      sampled.push(pts[pts.length - 1]);
    }

    let d = `M${sampled[0][0].toFixed(1)},${sampled[0][1].toFixed(1)}`;

    for (let i = 1; i < sampled.length; i++) {
      const [x0, y0] = sampled[i - 1];
      const [x1, y1] = sampled[i];
      const cpX = (x0 + x1) / 2;
      d += ` Q${cpX.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }

    return d;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Show the launch control panel (e.g. when gameplay begins).
   */
  public show(): void {
    if (this.container) {
      this.container.classList.remove('hidden');
    }
  }

  /**
   * Hide the launch control panel (e.g. during menus or after tires run out).
   */
  public hide(): void {
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  /**
   * Returns true when the panel is currently visible.
   */
  public isVisible(): boolean {
    return !this.container?.classList.contains('hidden');
  }

  /**
   * Enable or disable the LAUNCH button (e.g. disable while a tire is in flight).
   */
  public setLaunchEnabled(enabled: boolean): void {
    const btn = document.getElementById('lc-launch-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = !enabled;
      btn.classList.toggle('launch-control__launch-btn--disabled', !enabled);
    }
  }

  /**
   * Programmatically set power value (0–1).
   */
  public setPower(value: number): void {
    this.power = Math.min(this.POWER_MAX, Math.max(this.POWER_MIN, value));
    this.refreshDisplay();
  }

  /**
   * Programmatically set angle value (0–90 degrees).
   */
  public setAngle(value: number): void {
    this.angle = Math.min(this.ANGLE_MAX, Math.max(this.ANGLE_MIN, value));
    this.refreshDisplay();
  }

  /**
   * Get current power value (0–1).
   */
  public getPower(): number {
    return this.power;
  }

  /**
   * Get current angle value (0–90 degrees).
   */
  public getAngle(): number {
    return this.angle;
  }

  /**
   * Remove the panel from the DOM and clean up event listeners.
   */
  public destroy(): void {
    window.removeEventListener('keydown', this.keydownHandler);
    document.getElementById('launch-control-ui')?.remove();
    this.container = null;
  }
}
