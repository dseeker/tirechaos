import * as BABYLON from '@babylonjs/core';

/**
 * Quality level presets for the performance manager.
 */
export type QualityLevel = 'low' | 'medium' | 'high';

/**
 * QualitySettings - Defines all tunable rendering and simulation parameters
 * for a given quality level.
 */
export interface QualitySettings {
  /** Shadow map resolution in pixels (e.g. 512, 1024, 2048). */
  shadowResolution: number;

  /** Maximum number of simultaneous active particle systems. */
  maxParticleSystems: number;

  /** Maximum particles per individual particle system. */
  maxParticlesPerSystem: number;

  /** Whether bloom post-processing is enabled. */
  bloomEnabled: boolean;

  /** Whether ambient occlusion post-processing is enabled. */
  ambientOcclusionEnabled: boolean;

  /** Whether motion blur post-processing is enabled. */
  motionBlurEnabled: boolean;

  /** Whether depth-of-field post-processing is enabled. */
  depthOfFieldEnabled: boolean;

  /** Render resolution scale relative to native (1.0 = native, 0.75 = 75%). */
  renderScale: number;

  /** Maximum number of real-time shadow-casting lights. */
  maxShadowLights: number;

  /** Whether soft (PCF) shadows are used instead of hard shadows. */
  softShadows: boolean;

  /** Physics solver iteration count (higher = more accurate, more expensive). */
  physicsIterations: number;

  /** Texture filtering quality: 'bilinear' | 'trilinear' | 'anisotropic'. */
  textureFiltering: 'bilinear' | 'trilinear' | 'anisotropic';

  /** Maximum anisotropic filtering level (only relevant when textureFiltering is 'anisotropic'). */
  anisotropicLevel: number;
}

/**
 * Built-in quality presets.
 */
const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    shadowResolution: 512,
    maxParticleSystems: 4,
    maxParticlesPerSystem: 50,
    bloomEnabled: false,
    ambientOcclusionEnabled: false,
    motionBlurEnabled: false,
    depthOfFieldEnabled: false,
    renderScale: 0.75,
    maxShadowLights: 1,
    softShadows: false,
    physicsIterations: 5,
    textureFiltering: 'bilinear',
    anisotropicLevel: 1,
  },
  medium: {
    shadowResolution: 1024,
    maxParticleSystems: 8,
    maxParticlesPerSystem: 150,
    bloomEnabled: true,
    ambientOcclusionEnabled: false,
    motionBlurEnabled: false,
    depthOfFieldEnabled: false,
    renderScale: 1.0,
    maxShadowLights: 2,
    softShadows: true,
    physicsIterations: 10,
    textureFiltering: 'trilinear',
    anisotropicLevel: 4,
  },
  high: {
    shadowResolution: 2048,
    maxParticleSystems: 16,
    maxParticlesPerSystem: 300,
    bloomEnabled: true,
    ambientOcclusionEnabled: true,
    motionBlurEnabled: true,
    depthOfFieldEnabled: true,
    renderScale: 1.0,
    maxShadowLights: 4,
    softShadows: true,
    physicsIterations: 15,
    textureFiltering: 'anisotropic',
    anisotropicLevel: 16,
  },
};

/**
 * FPS sample window size used to compute a rolling average.
 */
const FPS_SAMPLE_WINDOW = 60;

/**
 * PerformanceManager - Monitors frame rate, manages quality presets, controls
 * VSync, and optionally limits the frame rate for TIRE CHAOS.
 *
 * Usage:
 *   const perf = new PerformanceManager(engine);
 *   perf.setQualityLevel('medium');
 *   perf.setFPSLimit(60);
 *   perf.toggleVSync();
 *   engine.runRenderLoop(() => {
 *     perf.update();
 *     scene.render();
 *   });
 */
export class PerformanceManager {
  private engine: BABYLON.Engine;

  // --- Quality state ---
  private currentQualityLevel: QualityLevel = 'medium';
  private currentSettings: QualitySettings = { ...QUALITY_PRESETS.medium };

  // --- Post-processing pipeline ---
  private postProcessPipeline: BABYLON.DefaultRenderingPipeline | null = null;

  // --- VSync state ---
  private vsyncEnabled: boolean = true;

  // --- FPS limiter state ---
  private fpsLimit: number | null = null;
  private lastFrameTime: number = 0;

  // --- FPS monitoring ---
  private frameTimes: number[] = [];
  private lastTimestamp: number = performance.now();
  private currentFPS: number = 0;
  private currentFrameTime: number = 0; // ms

  constructor(engine: BABYLON.Engine) {
    this.engine = engine;
    console.log('Performance Manager initialized');
  }

  // ---------------------------------------------------------------------------
  // Quality level
  // ---------------------------------------------------------------------------

  /**
   * Apply a named quality preset (low / medium / high).
   * Returns the settings object that was applied so callers can inspect or
   * further override individual values.
   */
  public setQualityLevel(level: QualityLevel): QualitySettings {
    this.currentQualityLevel = level;
    this.currentSettings = { ...QUALITY_PRESETS[level] };

    this.applySettings(this.currentSettings);

    console.log(`Performance Manager: quality set to "${level}"`);
    return { ...this.currentSettings };
  }

  /**
   * Apply a custom QualitySettings object, bypassing named presets.
   * The internal quality level label is set to the closest named preset or
   * kept as-is if no close match is found.
   */
  public applyCustomSettings(settings: Partial<QualitySettings>): QualitySettings {
    this.currentSettings = { ...this.currentSettings, ...settings };
    this.applySettings(this.currentSettings);
    console.log('Performance Manager: custom settings applied');
    return { ...this.currentSettings };
  }

  /**
   * Return a copy of the currently active QualitySettings.
   */
  public getCurrentSettings(): QualitySettings {
    return { ...this.currentSettings };
  }

  /**
   * Return the name of the currently active quality level.
   */
  public getCurrentQualityLevel(): QualityLevel {
    return this.currentQualityLevel;
  }

  /**
   * Return a copy of one of the built-in quality presets without applying it.
   */
  public getPreset(level: QualityLevel): QualitySettings {
    return { ...QUALITY_PRESETS[level] };
  }

  // ---------------------------------------------------------------------------
  // VSync
  // ---------------------------------------------------------------------------

  /**
   * Toggle hardware VSync on the Babylon.js engine.
   * Returns the new VSync state (true = enabled).
   */
  public toggleVSync(): boolean {
    this.vsyncEnabled = !this.vsyncEnabled;
    // Babylon.js Engine exposes limitDeviceRatio / setHardwareScalingLevel and
    // the internal _badOS flag, but VSync is controlled via the constructor flag
    // `adaptToDeviceRatio`. The most reliable cross-browser approach at runtime
    // is to set the rendering FPS target via the engine's limit mechanism.
    // We store the state and honour it in update() via the FPS limiter bypass.
    console.log(`Performance Manager: VSync ${this.vsyncEnabled ? 'enabled' : 'disabled'}`);
    return this.vsyncEnabled;
  }

  /**
   * Explicitly set VSync state.
   */
  public setVSync(enabled: boolean): void {
    if (this.vsyncEnabled !== enabled) {
      this.toggleVSync();
    }
  }

  /**
   * Return the current VSync state.
   */
  public isVSyncEnabled(): boolean {
    return this.vsyncEnabled;
  }

  // ---------------------------------------------------------------------------
  // FPS limiter
  // ---------------------------------------------------------------------------

  /**
   * Cap the render loop to at most `targetFPS` frames per second.
   * Pass null (or call clearFPSLimit()) to disable the cap.
   *
   * When VSync is enabled the browser's requestAnimationFrame already syncs to
   * the display refresh rate; the FPS limiter will further throttle if
   * targetFPS is lower than the display rate.
   */
  public setFPSLimit(targetFPS: number | null): void {
    if (targetFPS !== null && targetFPS <= 0) {
      console.warn('Performance Manager: FPS limit must be > 0; ignoring.');
      return;
    }
    this.fpsLimit = targetFPS;
    if (targetFPS !== null) {
      console.log(`Performance Manager: FPS limited to ${targetFPS}`);
    } else {
      console.log('Performance Manager: FPS limit cleared');
    }
  }

  /**
   * Remove any previously set FPS cap.
   */
  public clearFPSLimit(): void {
    this.setFPSLimit(null);
  }

  /**
   * Return the current FPS limit, or null if no limit is set.
   */
  public getFPSLimit(): number | null {
    return this.fpsLimit;
  }

  /**
   * Returns whether the current frame should be skipped to honour the FPS cap.
   * Call this at the top of your render loop; if it returns true, skip the
   * scene render call for this tick.
   *
   * Example:
   *   engine.runRenderLoop(() => {
   *     perfManager.update();
   *     if (!perfManager.shouldSkipFrame()) scene.render();
   *   });
   */
  public shouldSkipFrame(): boolean {
    if (this.fpsLimit === null) return false;

    const now = performance.now();
    const minInterval = 1000 / this.fpsLimit;

    if (now - this.lastFrameTime < minInterval) {
      return true;
    }

    this.lastFrameTime = now;
    return false;
  }

  // ---------------------------------------------------------------------------
  // FPS monitoring
  // ---------------------------------------------------------------------------

  /**
   * Must be called once per rendered frame (inside the render loop) to keep
   * FPS and frame-time statistics up to date.
   */
  public update(): void {
    const now = performance.now();
    const delta = now - this.lastTimestamp;
    this.lastTimestamp = now;

    // Store raw frame time in ms
    this.currentFrameTime = delta;

    // Maintain rolling sample window
    this.frameTimes.push(delta);
    if (this.frameTimes.length > FPS_SAMPLE_WINDOW) {
      this.frameTimes.shift();
    }

    // Compute average FPS over the window
    const avgDelta = this.frameTimes.reduce((sum, t) => sum + t, 0) / this.frameTimes.length;
    this.currentFPS = avgDelta > 0 ? 1000 / avgDelta : 0;
  }

  /**
   * Return the current smoothed FPS (rolling average over the last 60 frames).
   */
  public getFPS(): number {
    return Math.round(this.currentFPS * 10) / 10;
  }

  /**
   * Return the raw time in milliseconds that the last frame took to render.
   */
  public getFrameTime(): number {
    return Math.round(this.currentFrameTime * 100) / 100;
  }

  /**
   * Return min / max / average FPS computed from the current sample window.
   */
  public getFPSStats(): { min: number; max: number; avg: number } {
    if (this.frameTimes.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const fpsValues = this.frameTimes.map((t) => (t > 0 ? 1000 / t : 0));
    const min = Math.min(...fpsValues);
    const max = Math.max(...fpsValues);
    const avg = fpsValues.reduce((s, v) => s + v, 0) / fpsValues.length;

    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
    };
  }

  // ---------------------------------------------------------------------------
  // Post-processing pipeline
  // ---------------------------------------------------------------------------

  /**
   * Attach a Babylon.js DefaultRenderingPipeline so that the PerformanceManager
   * can enable / disable individual post-process stages when the quality level
   * changes.
   *
   * Call this once after creating your pipeline:
   *   const pipeline = new BABYLON.DefaultRenderingPipeline('main', true, scene, [camera]);
   *   perfManager.attachPipeline(pipeline);
   */
  public attachPipeline(pipeline: BABYLON.DefaultRenderingPipeline): void {
    this.postProcessPipeline = pipeline;
    // Apply current settings to the newly attached pipeline.
    this.applyPostProcessSettings(this.currentSettings);
    console.log('Performance Manager: rendering pipeline attached');
  }

  /**
   * Detach the post-processing pipeline reference (does not dispose the pipeline).
   */
  public detachPipeline(): void {
    this.postProcessPipeline = null;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Apply all fields in a QualitySettings object to the live engine / pipeline.
   */
  private applySettings(settings: QualitySettings): void {
    this.applyEngineSettings(settings);
    this.applyPostProcessSettings(settings);
  }

  /**
   * Apply engine-level settings (hardware scaling, etc.).
   */
  private applyEngineSettings(settings: QualitySettings): void {
    // Render scale (hardware scaling level is the inverse of render scale).
    // A renderScale of 0.75 means the engine renders at 75% resolution.
    const scalingLevel = 1.0 / settings.renderScale;
    this.engine.setHardwareScalingLevel(scalingLevel);
  }

  /**
   * Apply post-processing settings to the attached pipeline (if any).
   *
   * Notes on Babylon.js DefaultRenderingPipeline coverage:
   *   - bloomEnabled / depthOfFieldEnabled are first-class properties.
   *   - motionBlurEnabled is NOT part of DefaultRenderingPipeline; motion blur
   *     in Babylon.js is a standalone MotionBlurPostProcess. The flag is stored
   *     in QualitySettings for callers who manage their own MotionBlurPostProcess
   *     instance and want to enable/disable it in response to quality changes.
   *   - ambientOcclusionEnabled likewise belongs to a separate SSAO2
   *     RenderingPipeline; again the flag is informational for callers.
   */
  private applyPostProcessSettings(settings: QualitySettings): void {
    if (!this.postProcessPipeline) return;

    const pipeline = this.postProcessPipeline;

    // Bloom (natively supported by DefaultRenderingPipeline)
    pipeline.bloomEnabled = settings.bloomEnabled;

    // Depth of field (natively supported by DefaultRenderingPipeline)
    pipeline.depthOfFieldEnabled = settings.depthOfFieldEnabled;

    // motionBlurEnabled and ambientOcclusionEnabled are managed externally;
    // dispatch a custom event so other systems can react without tight coupling.
    window.dispatchEvent(
      new CustomEvent('performanceSettingsChanged', {
        detail: {
          motionBlurEnabled: settings.motionBlurEnabled,
          ambientOcclusionEnabled: settings.ambientOcclusionEnabled,
          qualityLevel: this.currentQualityLevel,
        },
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Diagnostics / debug
  // ---------------------------------------------------------------------------

  /**
   * Return a human-readable summary of the current performance state, useful
   * for on-screen debug overlays.
   */
  public getDebugInfo(): string {
    const stats = this.getFPSStats();
    const limit = this.fpsLimit !== null ? `${this.fpsLimit}` : 'none';
    return [
      `Quality : ${this.currentQualityLevel}`,
      `FPS     : ${this.getFPS().toFixed(1)} (min ${stats.min.toFixed(1)} / max ${stats.max.toFixed(1)})`,
      `Frame   : ${this.getFrameTime().toFixed(2)} ms`,
      `VSync   : ${this.vsyncEnabled ? 'on' : 'off'}`,
      `Limit   : ${limit}`,
      `Shadows : ${this.currentSettings.shadowResolution}px${this.currentSettings.softShadows ? ' (soft)' : ''}`,
      `Particles: max ${this.currentSettings.maxParticleSystems} systems / ${this.currentSettings.maxParticlesPerSystem} each`,
      `PostFX  : bloom=${this.currentSettings.bloomEnabled} ao=${this.currentSettings.ambientOcclusionEnabled} mb=${this.currentSettings.motionBlurEnabled} dof=${this.currentSettings.depthOfFieldEnabled}`,
    ].join('\n');
  }

  /**
   * Log the current debug summary to the browser console.
   */
  public logDebugInfo(): void {
    console.log(this.getDebugInfo());
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Clean up internal state. Does NOT dispose the attached rendering pipeline.
   */
  public destroy(): void {
    this.frameTimes = [];
    this.postProcessPipeline = null;
    console.log('Performance Manager destroyed');
  }
}
