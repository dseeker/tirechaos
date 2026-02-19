import { TireType } from '../types';

/**
 * LaunchControlUI – Release control panel for rolling tires downhill.
 *
 * Controls:
 *   SPEED     – how fast the tire starts rolling (0 = just gravity, 100% = full push)
 *   DIRECTION – steering angle from straight downhill; negative = left, positive = right
 *   RELEASE   – send the tire downhill
 *
 * Keyboard shortcuts while visible:
 *   Up / Down     → adjust speed
 *   Left / Right  → adjust direction
 *   Space         → release
 *   T             → cycle tire type (handled by KeyboardManager, shown for reference)
 */

const TIRE_LABELS: Record<TireType, string> = {
  [TireType.STANDARD]:     'STANDARD',
  [TireType.MONSTER_TRUCK]:'MONSTER',
  [TireType.RACING_SLICK]: 'RACING',
  [TireType.TRACTOR]:      'TRACTOR',
  [TireType.SPARE]:        'SPARE',
};

const TIRE_STATS: Record<TireType, { speed: number; mass: number; bounce: number }> = {
  [TireType.STANDARD]:     { speed: 3, mass: 2, bounce: 2 },
  [TireType.MONSTER_TRUCK]:{ speed: 2, mass: 5, bounce: 1 },
  [TireType.RACING_SLICK]: { speed: 5, mass: 1, bounce: 1 },
  [TireType.TRACTOR]:      { speed: 2, mass: 4, bounce: 1 },
  [TireType.SPARE]:        { speed: 4, mass: 1, bounce: 5 },
};

const TIRE_ORDER: TireType[] = [
  TireType.STANDARD,
  TireType.MONSTER_TRUCK,
  TireType.RACING_SLICK,
  TireType.TRACTOR,
  TireType.SPARE,
];

export class LaunchControlUI {
  private container: HTMLElement | null = null;

  // speed: 0–1  (normalised initial push speed)
  private power: number = 0.3;
  // direction: −45 to +45 degrees from straight downhill
  private angle: number = 0;

  private selectedTireType: TireType = TireType.STANDARD;

  private readonly POWER_STEP = 0.05;
  private readonly ANGLE_STEP = 5;

  private readonly POWER_MIN = 0;
  private readonly POWER_MAX = 1;
  private readonly ANGLE_MIN = -45;
  private readonly ANGLE_MAX =  45;

  private keydownHandler: (e: KeyboardEvent) => void;
  private onLaunch: (speed: number, direction: number) => void;

  constructor(onLaunch: (speed: number, direction: number) => void) {
    this.onLaunch = onLaunch;
    this.keydownHandler = this.handleKeydown.bind(this);
    this.createElement();
    this.setupKeyboardShortcuts();
    console.log('Release Control UI initialized');
  }

  // ─── DOM construction ──────────────────────────────────────────────────────

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
        <span class="launch-control__title">RELEASE CONTROL</span>
        <span class="launch-control__hint">ARROW KEYS &bull; SPACE</span>
      </div>

      <div class="launch-control__body">

        <!-- Speed slider -->
        <div class="launch-control__row">
          <label class="launch-control__label" for="lc-power-slider">
            <span class="launch-control__label-text">SPEED</span>
            <span id="lc-power-value" class="launch-control__value launch-control__value--power">30%</span>
          </label>
          <div class="launch-control__slider-track">
            <div id="lc-power-fill" class="launch-control__slider-fill launch-control__slider-fill--power" style="width:30%"></div>
            <input
              id="lc-power-slider"
              class="launch-control__slider"
              type="range"
              min="0" max="100" step="1"
              value="30"
              aria-label="Release speed"
            />
          </div>
          <div class="launch-control__ticks">
            <span>ROLL</span><span>25</span><span>50</span><span>75</span><span>PUSH</span>
          </div>
        </div>

        <!-- Direction slider -->
        <div class="launch-control__row">
          <label class="launch-control__label" for="lc-angle-slider">
            <span class="launch-control__label-text">DIRECTION</span>
            <span id="lc-angle-value" class="launch-control__value launch-control__value--angle">0&deg;</span>
          </label>
          <div class="launch-control__slider-track">
            <div id="lc-angle-fill" class="launch-control__slider-fill launch-control__slider-fill--angle" style="left:50%;width:0%"></div>
            <input
              id="lc-angle-slider"
              class="launch-control__slider"
              type="range"
              min="-45" max="45" step="1"
              value="0"
              aria-label="Release direction"
            />
          </div>
          <div class="launch-control__ticks">
            <span>LEFT</span><span>-22&deg;</span><span>STRAIGHT</span><span>+22&deg;</span><span>RIGHT</span>
          </div>
        </div>

        <!-- Tire Type Selector -->
        <div class="tire-selector">
          <div class="launch-control__label" style="margin-bottom:8px;">
            <span class="launch-control__label-text">TIRE TYPE</span>
            <span class="launch-control__hint">T KEY</span>
          </div>
          <div class="tire-selector__buttons" id="lc-tire-buttons">
            ${TIRE_ORDER.map(t =>
              `<button class="tire-btn${t === TireType.STANDARD ? ' active' : ''}" data-tire="${t}" type="button">${TIRE_LABELS[t]}</button>`
            ).join('')}
          </div>
          <div id="lc-tire-stats" class="tire-stats"></div>
        </div>

        <!-- Direction preview (top-down bird's-eye) -->
        <div class="launch-control__preview" aria-hidden="true">
          <svg
            id="lc-arc-svg"
            class="launch-control__arc-svg"
            viewBox="0 0 200 100"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Hill representation (left side) -->
            <polygon points="10,90 40,10 70,90" fill="rgba(80,140,60,0.5)" stroke="rgba(80,200,60,0.5)" stroke-width="1"/>
            <text x="40" y="55" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="8">HILL</text>

            <!-- Terrain (right side) -->
            <rect x="70" y="80" width="120" height="10" fill="rgba(60,100,40,0.4)" rx="2"/>
            <text x="130" y="76" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="7">TARGETS</text>

            <!-- Direction arrow (dynamically updated) -->
            <line
              id="lc-dir-line"
              x1="40" y1="50"
              x2="130" y2="50"
              stroke="url(#lc-arc-gradient)"
              stroke-width="2.5"
              stroke-linecap="round"
              marker-end="url(#lc-arrowhead)"
            />

            <!-- Side-deviation indicator -->
            <line
              id="lc-center-line"
              x1="40" y1="50" x2="190" y2="50"
              stroke="rgba(255,255,255,0.12)"
              stroke-width="1"
              stroke-dasharray="4 3"
            />

            <defs>
              <linearGradient id="lc-arc-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stop-color="#ff6b35"/>
                <stop offset="100%" stop-color="#00d9ff"/>
              </linearGradient>
              <marker id="lc-arrowhead" markerWidth="6" markerHeight="6"
                      refX="3" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#00d9ff"/>
              </marker>
            </defs>
          </svg>
        </div>

      </div>

      <!-- Release button -->
      <button id="lc-launch-btn" class="launch-control__launch-btn" type="button">
        <span class="launch-control__btn-icon">&#9654;</span>
        RELEASE
      </button>
    `;

    document.body.appendChild(el);
    this.container = el;

    this.bindSliders();
  }

  // ─── Event binding ─────────────────────────────────────────────────────────

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

    this.bindTireSelector();
  }

  private bindTireSelector(): void {
    const container = document.getElementById('lc-tire-buttons');
    if (!container) return;
    container.querySelectorAll<HTMLButtonElement>('.tire-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tireValue = btn.dataset.tire as TireType;
        if (tireValue) {
          this.selectedTireType = tireValue;
          this.refreshTireSelector();
        }
      });
    });
    this.refreshTireSelector();
  }

  private refreshTireSelector(): void {
    const container = document.getElementById('lc-tire-buttons');
    if (container) {
      container.querySelectorAll<HTMLButtonElement>('.tire-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tire === this.selectedTireType);
      });
    }

    const statsEl = document.getElementById('lc-tire-stats');
    if (statsEl) {
      const s = TIRE_STATS[this.selectedTireType];
      const dot = (filled: number) => '●'.repeat(filled) + '○'.repeat(5 - filled);
      statsEl.textContent = `Speed: ${dot(s.speed)}  Mass: ${dot(s.mass)}  Bounce: ${dot(s.bounce)}`;
    }
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', this.keydownHandler);
  }

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
        e.preventDefault();
        this.triggerLaunch();
        break;
    }
  }

  private adjustPower(delta: number): void {
    this.power = Math.min(this.POWER_MAX, Math.max(this.POWER_MIN, this.power + delta));
    this.refreshDisplay();
    this.flashControl('power');
  }

  private adjustAngle(delta: number): void {
    this.angle = Math.min(this.ANGLE_MAX, Math.max(this.ANGLE_MIN, this.angle + delta));
    this.refreshDisplay();
    this.flashControl('angle');
  }

  private triggerLaunch(): void {
    this.onLaunch(this.power, this.angle);

    const btn = document.getElementById('lc-launch-btn');
    if (btn) {
      btn.classList.add('launch-control__launch-btn--fired');
      setTimeout(() => btn.classList.remove('launch-control__launch-btn--fired'), 250);
    }
  }

  private flashControl(type: 'power' | 'angle'): void {
    const id = type === 'power' ? 'lc-power-value' : 'lc-angle-value';
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('launch-control__value--flash');
    setTimeout(() => el.classList.remove('launch-control__value--flash'), 200);
  }

  // ─── Display refresh ───────────────────────────────────────────────────────

  private refreshDisplay(): void {
    // ---- Speed ----
    const powerPct = Math.round(this.power * 100);

    const powerSlider = document.getElementById('lc-power-slider') as HTMLInputElement | null;
    if (powerSlider) powerSlider.value = powerPct.toString();

    const powerFill = document.getElementById('lc-power-fill');
    if (powerFill) powerFill.style.width = `${powerPct}%`;

    const powerValue = document.getElementById('lc-power-value');
    if (powerValue) powerValue.textContent = `${powerPct}%`;

    if (powerFill) {
      if (this.power < 0.33) {
        powerFill.style.background = 'linear-gradient(90deg, #00ff88, #00d9ff)';
      } else if (this.power < 0.67) {
        powerFill.style.background = 'linear-gradient(90deg, #00d9ff, #ffcc00)';
      } else {
        powerFill.style.background = 'linear-gradient(90deg, #ffcc00, #ff6b35)';
      }
    }

    // ---- Direction ----
    const angleSlider = document.getElementById('lc-angle-slider') as HTMLInputElement | null;
    if (angleSlider) angleSlider.value = this.angle.toString();

    // For the direction fill, show deviation from centre (50%)
    const angleFill = document.getElementById('lc-angle-fill');
    if (angleFill) {
      const pct = (this.angle / 90) * 100; // ±50% of slider width
      if (pct >= 0) {
        angleFill.style.left  = '50%';
        angleFill.style.width = `${pct}%`;
      } else {
        angleFill.style.left  = `${50 + pct}%`;
        angleFill.style.width = `${-pct}%`;
      }
    }

    const angleValue = document.getElementById('lc-angle-value');
    if (angleValue) {
      const sign = this.angle > 0 ? '+' : '';
      angleValue.textContent = `${sign}${Math.round(this.angle)}\u00b0`;
    }

    // ---- Direction preview arrow ----
    this.updateDirectionPreview();
  }

  /**
   * Update the bird's-eye direction arrow in the SVG preview.
   * The arrow rotates around the hilltop origin to show where the tire will head.
   */
  private updateDirectionPreview(): void {
    const dirLine = document.getElementById('lc-dir-line');
    if (!dirLine) return;

    // SVG origin of the arrow (hilltop)
    const ox = 40;
    const oy = 50;
    const arrowLen = 90; // pixels in SVG viewBox

    // direction angle: 0 = straight right (+X), positive = downward in SVG (+Z = right in game)
    // In SVG, y increases downward; we want positive direction to go toward bottom (right side of terrain)
    const rad = (this.angle * Math.PI) / 180;
    const tx = ox + Math.cos(rad) * arrowLen;
    const ty = oy + Math.sin(rad) * arrowLen;

    dirLine.setAttribute('x1', ox.toString());
    dirLine.setAttribute('y1', oy.toString());
    dirLine.setAttribute('x2', tx.toFixed(1));
    dirLine.setAttribute('y2', ty.toFixed(1));
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  public show(): void {
    if (this.container) this.container.classList.remove('hidden');
  }

  public hide(): void {
    if (this.container) this.container.classList.add('hidden');
  }

  public isVisible(): boolean {
    return !this.container?.classList.contains('hidden');
  }

  public setLaunchEnabled(enabled: boolean): void {
    const btn = document.getElementById('lc-launch-btn') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = !enabled;
      btn.classList.toggle('launch-control__launch-btn--disabled', !enabled);
    }
  }

  /** Set speed value (0–1). */
  public setPower(value: number): void {
    this.power = Math.min(this.POWER_MAX, Math.max(this.POWER_MIN, value));
    this.refreshDisplay();
  }

  /** Set direction value (−45 to +45 degrees). */
  public setAngle(value: number): void {
    this.angle = Math.min(this.ANGLE_MAX, Math.max(this.ANGLE_MIN, value));
    this.refreshDisplay();
  }

  /** Get current speed (0–1). */
  public getPower(): number {
    return this.power;
  }

  /** Get current direction (−45 to +45 degrees). */
  public getAngle(): number {
    return this.angle;
  }

  public getSelectedTireType(): TireType {
    return this.selectedTireType;
  }

  public cycleTireType(): void {
    const idx = TIRE_ORDER.indexOf(this.selectedTireType);
    this.selectedTireType = TIRE_ORDER[(idx + 1) % TIRE_ORDER.length];
    this.refreshTireSelector();
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.keydownHandler);
    document.getElementById('launch-control-ui')?.remove();
    this.container = null;
  }
}
