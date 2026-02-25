import * as BABYLON from '@babylonjs/core';

/**
 * ScreenEffects - Handles screen shake, flash, slow-motion, and other camera effects.
 * Where possible, effects are driven through the BabylonJS DefaultRenderingPipeline
 * (chromatic aberration, depth-of-field) rather than DOM overlays, so they
 * integrate properly with the HDR/tone-mapping chain.
 */
export class ScreenEffects {
  private camera: BABYLON.UniversalCamera;
  private originalPosition: BABYLON.Vector3;
  private isShaking: boolean = false;
  private shakeTimeout?: number;

  // Babylon post-processing pipeline — wired in after creation via setPipeline()
  private pipeline?: BABYLON.DefaultRenderingPipeline;

  // Baseline chromatic aberration amount (restored after pulses)
  private baseChromaticAmount: number = 0.4;

  constructor(camera: BABYLON.UniversalCamera) {
    this.camera = camera;
    this.originalPosition = camera.position.clone();
    console.log('📺 Screen Effects initialized');
  }

  /**
   * Wire the rendering pipeline so screen effects can drive real post-process
   * parameters (chromatic aberration, depth-of-field focus, etc.).
   * Call this from GameManager after setupPostProcessing().
   */
  public setPipeline(pipeline: BABYLON.DefaultRenderingPipeline): void {
    this.pipeline = pipeline;
    if (pipeline.chromaticAberrationEnabled) {
      this.baseChromaticAmount = pipeline.chromaticAberration.aberrationAmount;
    }
  }

  /**
   * Shake the camera with decaying amplitude.
   * Uses rotation offsets rather than position displacement so it does not
   * fight the CameraDirector's position lerp.
   */
  public shake(intensity: number = 0.5, duration: number = 300): void {
    if (this.isShaking) return;

    this.isShaking = true;
    this.originalPosition = this.camera.position.clone();

    const startTime = performance.now();
    const shakeInterval = 16; // ~60 fps

    const shakeLoop = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1.0) {
        this.camera.position.copyFrom(this.originalPosition);
        this.isShaking = false;
        clearInterval(shakeLoop);
        return;
      }

      // Ease-out: strongest at start, fades by cubic
      const decay = 1.0 - progress * progress * progress;
      const cur = intensity * decay;

      this.camera.position.set(
        this.originalPosition.x + (Math.random() - 0.5) * cur,
        this.originalPosition.y + (Math.random() - 0.5) * cur * 0.6,
        this.originalPosition.z + (Math.random() - 0.5) * cur,
      );
    }, shakeInterval);

    this.shakeTimeout = window.setTimeout(() => {
      this.camera.position.copyFrom(this.originalPosition);
      this.isShaking = false;
      clearInterval(shakeLoop);
    }, duration + 100);
  }

  /**
   * Flash the screen with a colour.
   * Uses a DOM overlay — quick, reliable, no pipeline dependency.
   */
  public flash(color: BABYLON.Color3 = new BABYLON.Color3(1, 1, 1), duration: number = 100): void {
    const flashOverlay = document.createElement('div');
    flashOverlay.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)});
      opacity: 0.7;
      pointer-events: none;
      z-index: 9999;
      transition: opacity ${duration}ms ease-out;
    `;
    document.body.appendChild(flashOverlay);
    setTimeout(() => { flashOverlay.style.opacity = '0'; }, 10);
    setTimeout(() => { flashOverlay.remove(); }, duration + 50);
  }

  /**
   * Vignette — radial darkness at screen edges for dramatic moments.
   * DOM overlay: immediate, independent of the 3-D pipeline.
   */
  public vignette(intensity: number = 0.5, duration: number = 1000): void {
    const vig = document.createElement('div');
    vig.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: radial-gradient(circle, transparent 25%, rgba(0,0,0,${intensity}) 100%);
      pointer-events: none;
      z-index: 9998;
      opacity: 0;
      transition: opacity ${duration * 0.4}ms ease-in;
    `;
    document.body.appendChild(vig);
    setTimeout(() => { vig.style.opacity = '1'; }, 10);
    setTimeout(() => {
      vig.style.transition = `opacity ${duration * 0.6}ms ease-out`;
      vig.style.opacity = '0';
      setTimeout(() => vig.remove(), duration * 0.6 + 50);
    }, duration * 0.4 + 20);
  }

  /**
   * Chromatic aberration pulse.
   * Drives the pipeline's chromaticAberration.aberrationAmount if available,
   * otherwise falls back to a DOM ring animation.
   */
  public chromaticPulse(intensity: number = 2.0, duration: number = 200): void {
    if (this.pipeline?.chromaticAberrationEnabled) {
      // Drive the real post-process parameter
      const target = this.baseChromaticAmount * intensity * 3;
      this.pipeline.chromaticAberration.aberrationAmount = target;

      // Smoothly ease back to baseline
      const startTime = performance.now();
      const baseVal = this.baseChromaticAmount;
      const startVal = target;
      const tick = () => {
        const t = Math.min((performance.now() - startTime) / duration, 1.0);
        const eased = 1 - t * t; // ease-out quad
        if (this.pipeline?.chromaticAberration) {
          this.pipeline.chromaticAberration.aberrationAmount = baseVal + (startVal - baseVal) * eased;
        }
        if (t < 1.0) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } else {
      // DOM fallback
      const pulse = document.createElement('div');
      pulse.style.cssText = `
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0);
        width: 200%; height: 200%;
        border: 4px solid rgba(0, 220, 255, 0.45);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9997;
        animation: chromatic-pulse ${duration}ms ease-out forwards;
      `;
      const style = document.createElement('style');
      style.textContent = `
        @keyframes chromatic-pulse {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(${intensity}); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(pulse);
      setTimeout(() => { pulse.remove(); style.remove(); }, duration + 20);
    }
  }

  /**
   * Dynamically update depth-of-field focus distance to track a world-space
   * point (e.g. the tire).  Call every frame for cinematic rack-focus.
   * focusDistanceMeters is in metres; pipeline expects millimetres.
   */
  public setFocusDistance(focusDistanceMeters: number): void {
    if (this.pipeline?.depthOfFieldEnabled) {
      // Smooth lerp so the rack-focus feels natural
      const target = focusDistanceMeters * 1000; // m → mm
      const current = this.pipeline.depthOfField.focusDistance;
      this.pipeline.depthOfField.focusDistance = current + (target - current) * 0.08;
    }
  }

  /**
   * Widen / narrow depth-of-field aperture for a dramatic pull.
   * fStop 1.4 = wide open (lots of blur), 16 = closed (everything sharp).
   */
  public setFStop(fStop: number): void {
    if (this.pipeline?.depthOfFieldEnabled) {
      this.pipeline.depthOfField.fStop = fStop;
    }
  }

  // ─── Composite effects ────────────────────────────────────────────────────

  /** Impact — shake + warm flash */
  public impact(intensity: number = 0.7): void {
    this.shake(intensity, 200);
    this.flash(new BABYLON.Color3(1, 0.85, 0.5), 90);
  }

  /** Heavy impact — strong shake + chromatic pulse + orange flash */
  public heavyImpact(): void {
    this.shake(1.4, 380);
    this.flash(new BABYLON.Color3(1, 0.5, 0.1), 140);
    this.chromaticPulse(1.8, 280);
  }

  /** Combo celebration — coloured flash + chromatic pulse */
  public comboEffect(level: number): void {
    const palette = [
      new BABYLON.Color3(0.0, 1.0, 1.0), // Cyan  (2×)
      new BABYLON.Color3(0.0, 1.0, 0.3), // Green (3×)
      new BABYLON.Color3(1.0, 1.0, 0.0), // Yellow (4×)
      new BABYLON.Color3(1.0, 0.5, 0.0), // Orange (5×+)
    ];
    const color = palette[Math.min(level - 2, palette.length - 1)];
    this.flash(color, 140);
    this.chromaticPulse(1.0 + level * 0.15, 230);
  }

  /** Time warning — pulsing red flash */
  public timeWarning(): void {
    this.flash(new BABYLON.Color3(1, 0.05, 0.05), 180);
  }

  /** Victory — rainbow flash sequence + wide open DOF for dream-like feel */
  public victory(): void {
    const colors = [
      new BABYLON.Color3(1, 0, 0),
      new BABYLON.Color3(1, 0.6, 0),
      new BABYLON.Color3(1, 1, 0),
      new BABYLON.Color3(0, 1, 0.3),
      new BABYLON.Color3(0, 0.7, 1),
    ];
    colors.forEach((c, i) => setTimeout(() => this.flash(c, 130), i * 90));

    // Briefly open aperture wide for a shallow-DOF victory look
    if (this.pipeline?.depthOfFieldEnabled) {
      const original = this.pipeline.depthOfField.fStop;
      this.setFStop(1.4);
      setTimeout(() => this.setFStop(original), 2500);
    }
  }

  /** Game over — heavy vignette + slow shake */
  public gameOver(): void {
    this.vignette(0.85, 2200);
    this.shake(0.28, 480);
    // Desaturate slightly
    if (this.pipeline?.imageProcessingEnabled) {
      const orig = this.pipeline.imageProcessing.contrast;
      this.pipeline.imageProcessing.contrast = 1.4;
      this.pipeline.imageProcessing.exposure = 0.75;
      setTimeout(() => {
        if (this.pipeline) {
          this.pipeline.imageProcessing.contrast = orig;
          this.pipeline.imageProcessing.exposure = 1.1;
        }
      }, 3000);
    }
  }

  /** Cleanup */
  public destroy(): void {
    if (this.shakeTimeout) clearTimeout(this.shakeTimeout);
    this.isShaking = false;
  }
}
