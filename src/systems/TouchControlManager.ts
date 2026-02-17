/**
 * TouchControlManager - Mobile touch controls for launching tires
 *
 * Handles touchstart / touchmove / touchend on the game canvas and translates
 * drag gestures into (power, angle) values that are forwarded to the provided
 * onLaunch callback.  A lightweight DOM overlay shows a drag indicator while
 * the player is aiming.
 */
export class TouchControlManager {
  private canvas: HTMLCanvasElement | null = null;
  private onLaunch: ((power: number, angle: number) => void) | null = null;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private isDragging: boolean = false;
  private indicator?: HTMLDivElement;

  // Bound listener references so we can remove them in disable()
  private boundTouchStart?: (e: TouchEvent) => void;
  private boundTouchMove?: (e: TouchEvent) => void;
  private boundTouchEnd?: (e: TouchEvent) => void;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Attach touch listeners to the canvas and register the launch callback.
   * Safe to call multiple times — previous listeners are cleaned up first.
   */
  public init(canvas: HTMLCanvasElement, onLaunch: (power: number, angle: number) => void): void {
    // Remove any pre-existing listeners before re-initialising
    this.disable();

    this.canvas = canvas;
    this.onLaunch = onLaunch;

    // Ensure a shared indicator element exists in the DOM
    this.ensureIndicator();

    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove  = this.handleTouchMove.bind(this);
    this.boundTouchEnd   = this.handleTouchEnd.bind(this);

    canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  this.boundTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   this.boundTouchEnd,   { passive: false });
  }

  /**
   * Remove touch listeners and hide the indicator.
   * Called when returning to the menu or when the component is no longer needed.
   */
  public disable(): void {
    if (this.canvas) {
      if (this.boundTouchStart) this.canvas.removeEventListener('touchstart', this.boundTouchStart);
      if (this.boundTouchMove)  this.canvas.removeEventListener('touchmove',  this.boundTouchMove);
      if (this.boundTouchEnd)   this.canvas.removeEventListener('touchend',   this.boundTouchEnd);
    }

    this.hideIndicator();
    this.isDragging = false;
    this.canvas    = null;
    this.onLaunch  = null;
  }

  // -----------------------------------------------------------------------
  // Touch event handlers
  // -----------------------------------------------------------------------

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 0) return;

    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isDragging  = true;

    this.showIndicatorAt(touch.clientX, touch.clientY);
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging || e.touches.length === 0) return;

    const touch = e.touches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    const dragDistance = Math.sqrt(dx * dx + dy * dy);

    const power = Math.min(dragDistance / 150, 1.0);
    const rawAngle = Math.atan2(-dy, dx) * 180 / Math.PI;
    const angle = Math.max(15, Math.min(75, rawAngle));

    this.updateArrow(this.touchStartX, this.touchStartY, touch.clientX, touch.clientY, power, angle);
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging) return;

    // Calculate final power and angle from the last changed touch
    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - this.touchStartX;
      const dy = touch.clientY - this.touchStartY;
      const dragDistance = Math.sqrt(dx * dx + dy * dy);

      const power = Math.min(dragDistance / 150, 1.0);
      const rawAngle = Math.atan2(-dy, dx) * 180 / Math.PI;
      const angle = Math.max(15, Math.min(75, rawAngle));

      if (this.onLaunch && power > 0.02) {
        this.onLaunch(power, angle);
      }
    }

    this.isDragging = false;
    this.hideIndicator();
  }

  // -----------------------------------------------------------------------
  // Indicator helpers
  // -----------------------------------------------------------------------

  /**
   * Create the overlay container if it does not already exist and inject CSS.
   */
  private ensureIndicator(): void {
    if (this.indicator) return;

    // Inject CSS once
    if (!document.getElementById('touch-control-styles')) {
      const style = document.createElement('style');
      style.id = 'touch-control-styles';
      style.textContent = `
        .touch-indicator {
          position: fixed;
          pointer-events: none;
          z-index: 9999;
          display: none;
        }
        .touch-indicator .touch-circle {
          position: absolute;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid rgba(255, 255, 255, 0.85);
          background: rgba(255, 255, 255, 0.15);
          transform: translate(-50%, -50%);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.4);
        }
        .touch-indicator .touch-arrow {
          position: absolute;
          transform-origin: 0 50%;
          height: 3px;
          background: rgba(255, 255, 255, 0.85);
          border-radius: 2px;
          box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
          top: 0;
          left: 0;
        }
        .touch-indicator .touch-arrow::after {
          content: '';
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%);
          border-left: 10px solid rgba(255, 255, 255, 0.85);
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
        }
        .touch-indicator .touch-power-label {
          position: absolute;
          color: #fff;
          font-size: 13px;
          font-family: monospace;
          text-shadow: 0 1px 3px rgba(0,0,0,0.7);
          white-space: nowrap;
          transform: translate(-50%, 16px);
        }
      `;
      document.head.appendChild(style);
    }

    const container = document.createElement('div');
    container.className = 'touch-indicator';

    const circle = document.createElement('div');
    circle.className = 'touch-circle';

    const arrow = document.createElement('div');
    arrow.className = 'touch-arrow';

    const label = document.createElement('div');
    label.className = 'touch-power-label';

    container.appendChild(circle);
    container.appendChild(arrow);
    container.appendChild(label);
    document.body.appendChild(container);

    this.indicator = container;
  }

  private showIndicatorAt(x: number, y: number): void {
    if (!this.indicator) this.ensureIndicator();
    if (!this.indicator) return;

    this.indicator.style.display = 'block';
    this.indicator.style.left = `${x}px`;
    this.indicator.style.top  = `${y}px`;

    // Reset arrow to zero length
    const arrow = this.indicator.querySelector<HTMLElement>('.touch-arrow');
    if (arrow) {
      arrow.style.width     = '0px';
      arrow.style.transform = 'rotate(0deg)';
    }

    const label = this.indicator.querySelector<HTMLElement>('.touch-power-label');
    if (label) label.textContent = '';
  }

  private updateArrow(
    startX: number, startY: number,
    currentX: number, currentY: number,
    power: number, angle: number,
  ): void {
    if (!this.indicator) return;

    const dx = currentX - startX;
    const dy = currentY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

    const arrow = this.indicator.querySelector<HTMLElement>('.touch-arrow');
    if (arrow) {
      arrow.style.width     = `${Math.min(length, 150)}px`;
      arrow.style.transform = `rotate(${angleDeg}deg)`;
    }

    const label = this.indicator.querySelector<HTMLElement>('.touch-power-label');
    if (label) {
      label.textContent = `${Math.round(power * 100)}%  ${Math.round(angle)}°`;
    }
  }

  private hideIndicator(): void {
    if (this.indicator) {
      this.indicator.style.display = 'none';
    }
  }
}
