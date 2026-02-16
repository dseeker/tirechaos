import * as BABYLON from '@babylonjs/core';

/**
 * ScreenEffects - Handles screen shake, flash, slow-motion, and other camera effects
 */
export class ScreenEffects {
  private camera: BABYLON.UniversalCamera;
  private originalPosition: BABYLON.Vector3;
  private isShaking: boolean = false;
  private shakeTimeout?: number;

  constructor(camera: BABYLON.UniversalCamera) {
    this.camera = camera;
    this.originalPosition = camera.position.clone();
    console.log('📺 Screen Effects initialized');
  }

  /**
   * Shake the screen/camera
   */
  public shake(intensity: number = 0.5, duration: number = 300): void {
    if (this.isShaking) return;

    this.isShaking = true;
    this.originalPosition = this.camera.position.clone();

    const startTime = performance.now();
    const shakeInterval = 16; // ~60fps

    const shakeLoop = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1.0) {
        // Restore original position
        this.camera.position.copyFrom(this.originalPosition);
        this.isShaking = false;
        clearInterval(shakeLoop);
        return;
      }

      // Decay intensity over time
      const currentIntensity = intensity * (1.0 - progress);

      // Random shake offset
      const offsetX = (Math.random() - 0.5) * currentIntensity;
      const offsetY = (Math.random() - 0.5) * currentIntensity;
      const offsetZ = (Math.random() - 0.5) * currentIntensity;

      this.camera.position.set(
        this.originalPosition.x + offsetX,
        this.originalPosition.y + offsetY,
        this.originalPosition.z + offsetZ
      );
    }, shakeInterval);

    // Safety timeout
    this.shakeTimeout = window.setTimeout(() => {
      this.camera.position.copyFrom(this.originalPosition);
      this.isShaking = false;
      clearInterval(shakeLoop);
    }, duration + 100);
  }

  /**
   * Flash the screen
   */
  public flash(color: BABYLON.Color3 = new BABYLON.Color3(1, 1, 1), duration: number = 100): void {
    // Create a flash overlay
    const flashOverlay = document.createElement('div');
    flashOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255});
      opacity: 0.8;
      pointer-events: none;
      z-index: 9999;
      transition: opacity ${duration}ms ease-out;
    `;
    document.body.appendChild(flashOverlay);

    // Fade out
    setTimeout(() => {
      flashOverlay.style.opacity = '0';
    }, 10);

    // Remove
    setTimeout(() => {
      flashOverlay.remove();
    }, duration + 50);
  }

  /**
   * Create vignette effect (darken edges)
   */
  public vignette(intensity: number = 0.5, duration: number = 1000): void {
    const vignette = document.createElement('div');
    vignette.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, transparent 20%, rgba(0,0,0,${intensity}) 100%);
      pointer-events: none;
      z-index: 9998;
      opacity: 0;
      transition: opacity ${duration}ms ease-in-out;
    `;
    document.body.appendChild(vignette);

    // Fade in
    setTimeout(() => {
      vignette.style.opacity = '1';
    }, 10);

    // Fade out and remove
    setTimeout(() => {
      vignette.style.opacity = '0';
      setTimeout(() => vignette.remove(), duration);
    }, duration);
  }

  /**
   * Chromatic aberration pulse (screen distortion)
   */
  public chromaticPulse(intensity: number = 2.0, duration: number = 200): void {
    // This requires access to the post-processing pipeline
    // For now, we'll create a visual pulse effect
    const pulse = document.createElement('div');
    pulse.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      width: 200%;
      height: 200%;
      border: 5px solid rgba(0, 255, 255, 0.5);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9997;
      animation: chromatic-pulse ${duration}ms ease-out;
    `;

    // Add keyframe animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes chromatic-pulse {
        0% {
          transform: translate(-50%, -50%) scale(0);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(${intensity});
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(pulse);

    // Remove after animation
    setTimeout(() => {
      pulse.remove();
      style.remove();
    }, duration);
  }

  /**
   * Impact effect (combination of shake + flash)
   */
  public impact(intensity: number = 0.7): void {
    this.shake(intensity, 200);
    this.flash(new BABYLON.Color3(1, 0.8, 0.5), 100);
  }

  /**
   * Heavy impact (stronger version)
   */
  public heavyImpact(): void {
    this.shake(1.5, 400);
    this.flash(new BABYLON.Color3(1, 0.5, 0), 150);
    this.chromaticPulse(1.5, 300);
  }

  /**
   * Combo celebration effect
   */
  public comboEffect(level: number): void {
    const colors = [
      new BABYLON.Color3(0, 1, 1), // Cyan
      new BABYLON.Color3(0, 1, 0), // Green
      new BABYLON.Color3(1, 1, 0), // Yellow
      new BABYLON.Color3(1, 0.5, 0), // Orange
    ];
    const color = colors[Math.min(level - 2, colors.length - 1)];

    this.flash(color, 150);
    this.chromaticPulse(1.2, 250);
  }

  /**
   * Time warning effect (for low time remaining)
   */
  public timeWarning(): void {
    this.flash(new BABYLON.Color3(1, 0, 0), 200);
  }

  /**
   * Victory celebration
   */
  public victory(): void {
    // Rainbow flash sequence
    const colors = [
      new BABYLON.Color3(1, 0, 0), // Red
      new BABYLON.Color3(1, 1, 0), // Yellow
      new BABYLON.Color3(0, 1, 0), // Green
      new BABYLON.Color3(0, 1, 1), // Cyan
    ];

    colors.forEach((color, index) => {
      setTimeout(() => {
        this.flash(color, 150);
      }, index * 100);
    });
  }

  /**
   * Game over effect
   */
  public gameOver(): void {
    this.vignette(0.8, 2000);
    this.shake(0.3, 500);
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.shakeTimeout) {
      clearTimeout(this.shakeTimeout);
    }
    this.isShaking = false;
  }
}
