import { PhysicsManager } from './PhysicsManager';
import { CameraDirector } from './CameraDirector';
import { UIManager } from './UIManager';
import { CameraType } from '../types';

/**
 * SlowMotionManager - Triggers satisfying slow-motion instant replays.
 * When the player lands a triple (or higher) combo the game slows to
 * 25 % speed for 2 seconds and the camera zooms in on the tire.
 */
export class SlowMotionManager {
  private physicsManager: PhysicsManager;
  private cameraDirector: CameraDirector;
  private uiManager: UIManager;

  private isActive: boolean = false;
  private slowFactor: number = 0.25;
  private slowTimer: number = 0;
  private slowDuration: number = 0;

  // The camera type that was active before slow-mo so we can restore it
  private previousCameraType: CameraType = CameraType.DRONE;

  // DOM overlay element — created lazily on first trigger
  private overlayEl: HTMLElement | null = null;

  constructor(
    physicsManager: PhysicsManager,
    cameraDirector: CameraDirector,
    uiManager: UIManager,
  ) {
    this.physicsManager = physicsManager;
    this.cameraDirector = cameraDirector;
    this.uiManager = uiManager;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Trigger a slow-motion replay.
   *
   * @param duration  How long the slow-mo lasts in milliseconds (default 2000).
   * @param factor    Physics time-scale during slow-mo, 0–1 (default 0.25).
   */
  public trigger(duration: number = 2000, factor: number = 0.25): void {
    // If already active just reset the timer — no stacking
    if (this.isActive) {
      this.slowTimer = duration;
      this.slowDuration = duration;
      return;
    }

    this.slowFactor = factor;
    this.slowDuration = duration;
    this.slowTimer = duration;
    this.isActive = true;

    // Remember the current camera so we can restore it when we stop
    this.previousCameraType = this.cameraDirector.getCurrentCameraType();

    // Slow down physics
    this.physicsManager.timeScale = factor;

    // Switch to the cinematic close-up hero shot
    this.cameraDirector.switchCamera(CameraType.HERO_TIRE);

    // Show the overlay
    this.showOverlay();

    console.log(`SlowMotionManager: slow-mo triggered (${factor * 100}% speed, ${duration}ms)`);
  }

  /**
   * Call this every frame from the render loop.
   *
   * @param deltaTime  Seconds since the last frame (real time, not scaled).
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Count down using real (unscaled) time
    this.slowTimer -= deltaTime * 1000;

    if (this.slowTimer <= 0) {
      this.stop();
    }
  }

  /** Returns true while slow-motion is active. */
  public isSlowMo(): boolean {
    return this.isActive;
  }

  /** Immediately end slow-motion and restore normal state. */
  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.slowTimer = 0;

    // Restore normal physics speed
    this.physicsManager.timeScale = 1.0;

    // Restore the camera we had before the effect
    this.cameraDirector.switchCamera(this.previousCameraType);

    // Hide the overlay
    this.hideOverlay();

    console.log('SlowMotionManager: slow-mo ended, normal speed restored');
  }

  // -------------------------------------------------------------------------
  // DOM overlay helpers
  // -------------------------------------------------------------------------

  private getOrCreateOverlay(): HTMLElement {
    if (this.overlayEl) return this.overlayEl;

    const el = document.createElement('div');
    el.id = 'slow-motion-overlay';
    el.className = 'slow-motion-overlay';
    el.textContent = 'SLOW MOTION';
    document.body.appendChild(el);
    this.overlayEl = el;
    return el;
  }

  private showOverlay(): void {
    const el = this.getOrCreateOverlay();
    el.style.display = 'block';
    // Force a reflow so the fade-in animation triggers cleanly
    void el.offsetWidth;
    el.classList.add('slow-motion-overlay--active');
  }

  private hideOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.classList.remove('slow-motion-overlay--active');
    // Wait for the fade-out transition before hiding
    const el = this.overlayEl;
    setTimeout(() => {
      el.style.display = 'none';
    }, 300);
  }
}
