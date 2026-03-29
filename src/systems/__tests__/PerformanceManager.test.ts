import { PerformanceManager } from '../PerformanceManager';
import { Engine } from '@babylonjs/core';

describe('PerformanceManager', () => {
  let manager: PerformanceManager;
  let mockEngine: Engine;
  let nowValue: number;

  beforeEach(() => {
    nowValue = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => nowValue);
    mockEngine = new Engine(null);
    manager = new PerformanceManager(mockEngine);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    manager.destroy();
  });

  // ---------------------------------------------------------------------------
  // FPS limiter / shouldSkipFrame
  // ---------------------------------------------------------------------------

  describe('FPS limiter', () => {
    it('should not skip frames when no limit is set', () => {
      expect(manager.shouldSkipFrame()).toBe(false);
    });

    it('should not skip the first frame after the target interval has passed', () => {
      manager.setFPSLimit(60);
      // lastFrameTime starts at 0; advance past the 16.67 ms 60fps interval
      nowValue = 17;
      expect(manager.shouldSkipFrame()).toBe(false);
    });

    it('should skip a frame that arrives too early', () => {
      manager.setFPSLimit(60);
      // First call: allowed (lastFrameTime set to nowValue = 0)
      manager.shouldSkipFrame();

      // Advance time by only 8 ms (less than the 16.67 ms interval for 60 fps)
      nowValue = 8;
      expect(manager.shouldSkipFrame()).toBe(true);
    });

    it('should allow a frame after the target interval has elapsed', () => {
      manager.setFPSLimit(60);
      manager.shouldSkipFrame(); // first call sets lastFrameTime

      // Advance time by 17 ms – just past the 60 fps interval
      nowValue = 17;
      expect(manager.shouldSkipFrame()).toBe(false);
    });

    it('should enforce a 30 fps cap correctly', () => {
      manager.setFPSLimit(30); // interval = 33.33 ms
      manager.shouldSkipFrame(); // initialise

      nowValue = 20;
      expect(manager.shouldSkipFrame()).toBe(true);

      nowValue = 34;
      expect(manager.shouldSkipFrame()).toBe(false);
    });

    it('should not skip frames after FPS limit is cleared', () => {
      manager.setFPSLimit(60);
      manager.shouldSkipFrame();
      nowValue = 1;

      manager.clearFPSLimit();
      expect(manager.shouldSkipFrame()).toBe(false);
    });

    it('should ignore invalid FPS limits (<= 0)', () => {
      manager.setFPSLimit(0);
      expect(manager.getFPSLimit()).toBeNull();

      manager.setFPSLimit(-10);
      expect(manager.getFPSLimit()).toBeNull();
    });

    it('should return the configured FPS limit', () => {
      expect(manager.getFPSLimit()).toBeNull();
      manager.setFPSLimit(120);
      expect(manager.getFPSLimit()).toBe(120);
    });
  });

  // ---------------------------------------------------------------------------
  // FPS monitoring via update()
  // ---------------------------------------------------------------------------

  describe('FPS monitoring', () => {
    it('should report 0 fps before any update calls', () => {
      expect(manager.getFPS()).toBe(0);
    });

    it('should compute FPS from update() call deltas', () => {
      nowValue = 0;
      manager.update();

      // Simulate 60 fps: call update() 60 times, each 16.67 ms apart
      for (let i = 1; i <= 60; i++) {
        nowValue = i * (1000 / 60);
        manager.update();
      }

      // Should be close to 60 fps (allow ±2 fps)
      expect(manager.getFPS()).toBeGreaterThan(58);
      expect(manager.getFPS()).toBeLessThan(62);
    });

    it('should compute FPS from update() call deltas at 30 fps', () => {
      nowValue = 0;
      manager.update();

      for (let i = 1; i <= 60; i++) {
        nowValue = i * (1000 / 30);
        manager.update();
      }

      expect(manager.getFPS()).toBeGreaterThan(28);
      expect(manager.getFPS()).toBeLessThan(32);
    });

    it('should provide min/max/avg FPS stats', () => {
      // Drive at a steady 60 fps to fill the window
      nowValue = 0;
      manager.update();
      for (let i = 1; i <= 60; i++) {
        nowValue = i * (1000 / 60);
        manager.update();
      }

      const stats = manager.getFPSStats();
      expect(stats.avg).toBeGreaterThan(58);
      expect(stats.avg).toBeLessThan(62);
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThan(0);
    });

    it('should return zeroed stats when no frames have been recorded', () => {
      const stats = manager.getFPSStats();
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.avg).toBe(0);
    });

    it('should report frame time in milliseconds', () => {
      nowValue = 0;
      manager.update();

      nowValue = 16;
      manager.update();

      expect(manager.getFrameTime()).toBeCloseTo(16, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // VSync
  // ---------------------------------------------------------------------------

  describe('VSync', () => {
    it('should be enabled by default', () => {
      expect(manager.isVSyncEnabled()).toBe(true);
    });

    it('should toggle VSync off and back on', () => {
      manager.toggleVSync();
      expect(manager.isVSyncEnabled()).toBe(false);

      manager.toggleVSync();
      expect(manager.isVSyncEnabled()).toBe(true);
    });

    it('should set VSync explicitly', () => {
      manager.setVSync(false);
      expect(manager.isVSyncEnabled()).toBe(false);

      manager.setVSync(true);
      expect(manager.isVSyncEnabled()).toBe(true);
    });

    it('should not toggle when setVSync is called with the current state', () => {
      expect(manager.isVSyncEnabled()).toBe(true);
      manager.setVSync(true);
      expect(manager.isVSyncEnabled()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Quality levels
  // ---------------------------------------------------------------------------

  describe('Quality levels', () => {
    it('should default to medium quality', () => {
      expect(manager.getCurrentQualityLevel()).toBe('medium');
    });

    it('should apply low quality preset', () => {
      const settings = manager.setQualityLevel('low');
      expect(settings.bloomEnabled).toBe(false);
      expect(settings.renderScale).toBe(0.75);
      expect(manager.getCurrentQualityLevel()).toBe('low');
    });

    it('should apply high quality preset', () => {
      const settings = manager.setQualityLevel('high');
      expect(settings.bloomEnabled).toBe(true);
      expect(settings.depthOfFieldEnabled).toBe(true);
      expect(settings.renderScale).toBe(1.0);
      expect(manager.getCurrentQualityLevel()).toBe('high');
    });

    it('should return a copy of preset settings via getPreset()', () => {
      const preset = manager.getPreset('low');
      expect(preset.renderScale).toBe(0.75);

      // Mutating the returned object must not affect internal state
      preset.renderScale = 9999;
      expect(manager.getPreset('low').renderScale).toBe(0.75);
    });

    it('should apply custom settings without changing quality label', () => {
      manager.setQualityLevel('medium');
      const settings = manager.applyCustomSettings({ bloomEnabled: false });
      expect(settings.bloomEnabled).toBe(false);
    });

    it('should call setHardwareScalingLevel on the engine when quality changes', () => {
      const spy = jest.spyOn(mockEngine, 'setHardwareScalingLevel');

      manager.setQualityLevel('low'); // renderScale 0.75 → scalingLevel ~1.333
      expect(spy).toHaveBeenCalled();

      const callArg = spy.mock.calls[0][0];
      expect(callArg).toBeCloseTo(1 / 0.75, 3);
    });
  });

  // ---------------------------------------------------------------------------
  // Post-processing pipeline
  // ---------------------------------------------------------------------------

  describe('Pipeline attachment', () => {
    it('should attach and detach a pipeline without throwing', () => {
      const { DefaultRenderingPipeline } = require('@babylonjs/core');
      const pipeline = new DefaultRenderingPipeline('test', false, null);

      expect(() => manager.attachPipeline(pipeline)).not.toThrow();
      expect(() => manager.detachPipeline()).not.toThrow();
    });

    it('should apply bloom setting to attached pipeline', () => {
      const { DefaultRenderingPipeline } = require('@babylonjs/core');
      const pipeline = new DefaultRenderingPipeline('test', false, null);

      manager.setQualityLevel('high');
      manager.attachPipeline(pipeline);

      expect(pipeline.bloomEnabled).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Debug info
  // ---------------------------------------------------------------------------

  describe('Debug info', () => {
    it('should return a non-empty debug string', () => {
      const info = manager.getDebugInfo();
      expect(typeof info).toBe('string');
      expect(info.length).toBeGreaterThan(0);
      expect(info).toContain('Quality');
      expect(info).toContain('FPS');
      expect(info).toContain('VSync');
    });
  });

  // ---------------------------------------------------------------------------
  // Destroy
  // ---------------------------------------------------------------------------

  describe('Destroy', () => {
    it('should clear frame times on destroy', () => {
      nowValue = 0;
      manager.update();
      nowValue = 16;
      manager.update();

      manager.destroy();

      const stats = manager.getFPSStats();
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.avg).toBe(0);
    });
  });
});
