import * as BABYLON from '@babylonjs/core';
import { PhysicsManager } from '../systems/PhysicsManager';
import { CameraDirector } from '../systems/CameraDirector';
import { ScoringSystem } from '../systems/ScoringSystem';
import { InputHandler } from '../systems/InputHandler';
import { UIManager } from '../systems/UIManager';
import { RoundManager } from '../systems/RoundManager';
import { KeyboardManager } from '../systems/KeyboardManager';
import { ParticleManager } from '../systems/ParticleManager';
import { ScreenEffects } from '../systems/ScreenEffects';
import { DestructibleObjectFactory } from '../systems/DestructibleObjectFactory';
import { EnvironmentManager } from '../systems/EnvironmentManager';
import { PerformanceManager } from '../systems/PerformanceManager';
import { BrowserManager } from '../systems/BrowserManager';
import { SoundManager } from '../systems/SoundManager';
import { LaunchControlUI } from '../systems/LaunchControlUI';
import { TouchControlManager } from '../systems/TouchControlManager';
import { Tire } from '../entities/Tire';
import { GameState, TireType, LevelConfig, DEFAULT_POSTPROCESSING_CONFIG, CameraType, TIRE_CONFIGS } from '../types';
import { DestructibleMaterial } from '../systems/DestructibleObjectFactory';
import { LevelGenerator, getLevelLayout } from '../levels/LevelGenerator';
import { AchievementManager, GameEvent } from '../systems/AchievementManager';
import { SlowMotionManager } from '../systems/SlowMotionManager';
import { LeaderboardManager, LeaderboardEntry } from '../systems/LeaderboardManager';

/**
 * GameManager - Central game controller (Singleton pattern)
 * Manages game state, scene, and coordinates all subsystems
 * NOW POWERED BY BABYLON.JS! 🎨
 */
export class GameManager {
  private static instance: GameManager;

  // Core Babylon.js components
  public engine: BABYLON.Engine;
  public scene: BABYLON.Scene;
  public camera: BABYLON.UniversalCamera;

  // Core game systems
  public physicsManager: PhysicsManager;
  public cameraDirector: CameraDirector;
  public scoringSystem: ScoringSystem;
  public inputHandler: InputHandler;

  // New enhanced systems
  public uiManager: UIManager;
  public roundManager: RoundManager;
  public keyboardManager: KeyboardManager;
  public particleManager: ParticleManager;
  public screenEffects: ScreenEffects;
  public performanceManager: PerformanceManager;
  public browserManager: BrowserManager;
  public soundManager: SoundManager;

  // Launch control
  public launchControlUI: LaunchControlUI;

  // Mobile touch controls
  public touchControlManager: TouchControlManager;

  // Factories and managers
  public destructibleFactory: DestructibleObjectFactory;
  public environmentManager: EnvironmentManager;

  // Level generator
  private levelGenerator: LevelGenerator;

  // Achievement system
  public achievementManager: AchievementManager;

  // Slow-motion instant replay
  public slowMotionManager: SlowMotionManager;

  // Leaderboard persistence
  public leaderboardManager: LeaderboardManager;

  // Rendering pipeline
  private defaultPipeline?: BABYLON.DefaultRenderingPipeline;
  private shadowGenerator?: BABYLON.ShadowGenerator;

  // Game state
  public gameState: GameState;
  public currentLevel: LevelConfig | null = null;
  public activeTires: Tire[] = [];

  // Launch position set by the current level layout
  private _currentLaunchPosition: BABYLON.Vector3 = new BABYLON.Vector3(-15, 2, 0);
  /** Terrain surface Y at the launch XZ position, set by loadLevelForRound(). */
  private _launchTerrainSurfaceY: number = 0;

  // Performance tracking
  private lastTime: number = 0;
  private frameCount: number = 0;
  private _fps: number = 60;

  private constructor() {
    // Initialize Babylon.js engine
    const canvas = document.getElementById('game-canvas') as unknown as HTMLCanvasElement;

    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      disableWebGL2Support: false,
      powerPreference: 'high-performance',
    });

    // Create scene
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.53, 0.81, 0.92, 1.0); // Sky blue

    // Setup camera
    this.camera = new BABYLON.UniversalCamera(
      'mainCamera',
      new BABYLON.Vector3(0, 10, 20),
      this.scene
    );
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.attachControl(canvas, false);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1000;
    this.camera.fov = 1.2; // ~75 degrees

    // Initialize core game systems
    this.physicsManager = new PhysicsManager();
    this.cameraDirector = new CameraDirector(this.camera, this.scene);
    this.scoringSystem = new ScoringSystem();
    this.inputHandler = new InputHandler(this);

    // Initialize enhanced systems
    this.uiManager = new UIManager();
    this.roundManager = new RoundManager();
    this.keyboardManager = new KeyboardManager();
    this.particleManager = new ParticleManager(this.scene);
    this.screenEffects = new ScreenEffects(this.camera);
    this.slowMotionManager = new SlowMotionManager(this.physicsManager, this.cameraDirector, this.uiManager);
    this.performanceManager = new PerformanceManager(this.engine);
    this.browserManager = new BrowserManager(canvas);
    this.soundManager = new SoundManager();
    this.achievementManager = new AchievementManager();
    this.leaderboardManager = new LeaderboardManager();

    // Initialize factories
    this.destructibleFactory = new DestructibleObjectFactory(this.scene, this.physicsManager);
    this.environmentManager = new EnvironmentManager(this.scene);

    // Initialize level generator
    this.levelGenerator = new LevelGenerator(
      this.scene,
      this.physicsManager,
      this.destructibleFactory,
      this.environmentManager,
      this.shadowGenerator,
    );

    // Initialize launch control UI (hidden until gameplay starts)
    this.launchControlUI = new LaunchControlUI((power, angle) => {
      this.launchTire(power, angle);
    });

    // Initialize mobile touch controls (wired up per-game in startNewGame)
    this.touchControlManager = new TouchControlManager();

    // Initialize game state
    this.gameState = {
      score: 0,
      combo: 0,
      tiresRemaining: 3,
      objectsDestroyed: 0,
      level: 1,
      isPaused: false,
      isGameOver: false,
    };

    this.setupLights();
    this.setupPostProcessing();
    this.setupEventListeners();

    console.log('🎨 Babylon.js GameManager initialized with PBR pipeline!');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  /**
   * Setup advanced lighting with PBR support
   */
  private setupLights(): void {
    // Ambient light for overall illumination
    const ambientLight = new BABYLON.HemisphericLight(
      'ambient',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    ambientLight.intensity = 0.6;
    ambientLight.groundColor = new BABYLON.Color3(0.36, 0.31, 0.22); // Brownish ground

    // Directional light (sun) with advanced shadows
    const sunLight = new BABYLON.DirectionalLight(
      'sun',
      new BABYLON.Vector3(-1, -2, -1),
      this.scene
    );
    sunLight.position = new BABYLON.Vector3(50, 50, 25);
    sunLight.intensity = 0.8;

    // Advanced shadow generator
    this.shadowGenerator = new BABYLON.ShadowGenerator(2048, sunLight);
    this.shadowGenerator.useExponentialShadowMap = true;
    this.shadowGenerator.usePoissonSampling = true;
    this.shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    this.shadowGenerator.darkness = 0.3;

    // Environment texture for PBR reflections
    const envTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
      'https://playground.babylonjs.com/textures/environment.env',
      this.scene
    );
    this.scene.environmentTexture = envTexture;
    this.scene.environmentIntensity = 0.5;

    console.log('✨ Advanced lighting setup complete (PBR + Shadows)');
  }

  /**
   * Setup post-processing pipeline for cinematic visuals
   */
  private setupPostProcessing(): void {
    const config = DEFAULT_POSTPROCESSING_CONFIG;

    // Default rendering pipeline (includes most effects)
    this.defaultPipeline = new BABYLON.DefaultRenderingPipeline(
      'defaultPipeline',
      true, // HDR
      this.scene,
      [this.camera]
    );

    // Anti-aliasing
    this.defaultPipeline.samples = 4;

    // Bloom effect
    if (config.bloom.enabled) {
      this.defaultPipeline.bloomEnabled = true;
      this.defaultPipeline.bloomThreshold = config.bloom.threshold;
      this.defaultPipeline.bloomWeight = config.bloom.weight;
      this.defaultPipeline.bloomKernel = config.bloom.kernel;
      this.defaultPipeline.bloomScale = 0.5;
    }

    // Image processing (tone mapping, contrast, exposure)
    this.defaultPipeline.imageProcessingEnabled = true;
    this.defaultPipeline.imageProcessing.toneMappingEnabled = true;
    this.defaultPipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.defaultPipeline.imageProcessing.contrast = 1.2;
    this.defaultPipeline.imageProcessing.exposure = 1.0;

    // Chromatic aberration
    if (config.chromaticAberration.enabled) {
      this.defaultPipeline.chromaticAberrationEnabled = true;
      this.defaultPipeline.chromaticAberration.aberrationAmount = config.chromaticAberration.aberrationAmount;
    }

    // Depth of Field (disabled by default, can enable for cinematic shots)
    if (config.depthOfField.enabled) {
      this.defaultPipeline.depthOfFieldEnabled = true;
      this.defaultPipeline.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
      this.defaultPipeline.depthOfField.focalLength = config.depthOfField.focalLength;
      this.defaultPipeline.depthOfField.fStop = config.depthOfField.fStop;
    }

    // Grain effect for film-like quality
    this.defaultPipeline.grainEnabled = true;
    this.defaultPipeline.grain.intensity = 5;
    this.defaultPipeline.grain.animated = true;

    console.log('🌟 Post-processing pipeline enabled (Bloom, HDR, Tone Mapping)');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // UI button handlers (old buttons - will be replaced by UIManager)
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetLevel());
    }

    // Setup keyboard shortcuts
    this.keyboardManager.setupDefaultShortcuts({
      onPause: () => this.togglePause(),
      onReset: () => this.resetLevel(),
      onCycleCamera: () => this.cycleCamera(),
      onSelectCamera: (cameraType) => this.cameraDirector.switchCamera(cameraType),
      onToggleFPS: () => this.toggleFPSDisplay(),
      onToggleFullscreen: () => this.browserManager.toggleFullscreen(),
      onCycleTire: () => {
        this.launchControlUI.cycleTireType();
        this.uiManager.showMessage(
          `Tire: ${this.launchControlUI.getSelectedTireType().toUpperCase()}`, 1000
        );
      },
      onQuickLaunch: () => {
        if (this.launchControlUI && this.launchControlUI.isVisible()) {
          this.launchTire(this.launchControlUI.getPower(), this.launchControlUI.getAngle());
        } else {
          // Default: moderate speed, straight downhill (0° direction)
          this.launchTire(0.6, 0);
        }
      },
    });

    // UI Manager event listeners
    window.addEventListener('start-game', () => this.startNewGame());
    window.addEventListener('resume-game', () => this.resume());
    window.addEventListener('restart-game', () => this.resetLevel());
    window.addEventListener('quit-to-menu', () => this.returnToMenu());
    window.addEventListener('next-round', () => {
      this.roundManager.nextRound();
      const nextRoundNum = this.roundManager.getCurrentRoundNumber();
      if (nextRoundNum > 0) {
        // Tear down old scene objects, then build the new level layout
        this.activeTires.forEach((tire) => tire.destroy());
        this.activeTires = [];
        this.clearScene();
        this.loadLevelForRound(nextRoundNum);
        this.resume();
      }
    });
    window.addEventListener('play-again', () => this.startNewGame());
    window.addEventListener('main-menu', () => this.returnToMenu());

    // Round Manager events
    window.addEventListener('round-complete', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { roundData, isLastRound } = customEvent.detail;
      this.uiManager.showRoundEnd(roundData, isLastRound);
      this.pause();
      // Achievement checks for round completion
      this.achievementManager.check(GameEvent.ROUND_COMPLETE, {
        roundNumber: roundData.roundNumber,
        tiresLeft: roundData.tiresAvailable,
        timeRemaining: roundData.timeRemaining,
      });
      this.achievementManager.check(GameEvent.ROUND_SCORE, {
        score: roundData.score,
        isLastTire: roundData.tiresAvailable === 0,
      });
      this.soundManager.playSFX('round_complete');
    });

    window.addEventListener('game-over', (e: Event) => {
      const customEvent = e as CustomEvent;
      this.showGameOver(customEvent.detail);
    });

    window.addEventListener('game-victory', (e: Event) => {
      const customEvent = e as CustomEvent;
      this.showVictory(customEvent.detail);
      this.achievementManager.check(GameEvent.GAME_VICTORY, {});
    });

    // Physics events
    window.addEventListener('objectDestroyed', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { points, position } = customEvent.detail;
      this.addScore(points, true, position); // isCombo = true for chaining
      this.achievementManager.check(GameEvent.OBJECT_DESTROYED, {
        totalDestroyed: this.gameState.objectsDestroyed,
      });
    });

    // Leaderboard events
    window.addEventListener('show-leaderboard', () => {
      this.uiManager.showLeaderboard(this.leaderboardManager.getEntries());
    });
    window.addEventListener('leaderboard-close', () => {
      this.uiManager.hideLeaderboard();
    });

    // Settings events
    window.addEventListener('settings-close', () => this.uiManager.hideSettings());
    window.addEventListener('music-volume-change', (e: Event) => {
      const { value } = (e as CustomEvent).detail;
      this.soundManager.setMusicVolume(value / 100);
    });
    window.addEventListener('sfx-volume-change', (e: Event) => {
      const { value } = (e as CustomEvent).detail;
      this.soundManager.setSFXVolume(value / 100);
    });
    window.addEventListener('quality-change', (e: Event) => {
      const { level } = (e as CustomEvent).detail as { level: 'low' | 'medium' | 'high' };
      this.performanceManager.setQualityLevel(level);
      this.uiManager.showMessage(`Quality: ${level.toUpperCase()}`, 1500);
    });
    window.addEventListener('mute-toggle', () => {
      const muted = this.soundManager.toggleMute();
      this.uiManager.showMessage(muted ? 'Sound Muted' : 'Sound On', 1200);
    });

    // Optimize engine on window blur
    window.addEventListener('blur', () => {
      this.engine.stopRenderLoop();
    });

    window.addEventListener('focus', () => {
      this.engine.runRenderLoop(() => this.render());
    });
  }

  /**
   * Handle window resize
   */
  private onWindowResize(): void {
    this.engine.resize();
  }

  /**
   * Initialize and start the game
   */
  public async init(): Promise<void> {
    console.log('🎮 Initializing TIRE CHAOS with Babylon.js...');

    // Setup performance settings
    this.performanceManager.setQualityLevel('high');
    this.performanceManager.attachPipeline(this.defaultPipeline!);

    // Setup browser features
    this.browserManager.applyGameRestrictions();

    // Create level 1 layout as the background scene on the main menu
    this.loadLevelForRound(1);

    // Hide loading screen, show main menu
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');

    // Show main menu
    this.uiManager.showMainMenu();

    // Start render loop
    this.start();

    console.log('✅ Game initialized successfully with Babylon.js!');
    console.log('🎨 PBR materials, advanced lighting, and post-processing active!');
    console.log('⌨️  Press SPACE or click START GAME to begin!');
  }

  /**
   * Create a test level for development
   */
  private createTestLevel(): void {
    // Create ground/hill with PBR material
    const ground = BABYLON.MeshBuilder.CreateBox(
      'ground',
      { width: 50, height: 1, depth: 20 },
      this.scene
    );
    ground.position = new BABYLON.Vector3(0, -5, 0);
    ground.rotation.z = -0.2; // Slight slope

    // PBR material for ground
    const groundMaterial = new BABYLON.PBRMetallicRoughnessMaterial('groundMat', this.scene);
    groundMaterial.baseColor = new BABYLON.Color3(0.36, 0.55, 0.24); // Grass green
    groundMaterial.metallic = 0.0;
    groundMaterial.roughness = 0.9;
    ground.material = groundMaterial;

    // Enable shadows
    ground.receiveShadows = true;

    // Add to physics
    this.physicsManager.addGroundPlane(ground);

    // Create destructible objects using factory
    this.createDestructibleObjects();

    // Add environment props
    this.environmentManager.spawnLevelProps();

    console.log('🏔️ Test level created with PBR materials, destructibles, and environment');
  }

  /**
   * Create destructible objects using factory
   */
  private createDestructibleObjects(): void {
    // Create variety of destructible objects
    const materials = [
      DestructibleMaterial.WOOD,
      DestructibleMaterial.METAL,
      DestructibleMaterial.GLASS,
      DestructibleMaterial.STONE,
      DestructibleMaterial.RUBBER,
      DestructibleMaterial.CRYSTAL,
    ];

    // Create clusters of objects
    for (let i = 0; i < 3; i++) {
      const clusterX = (i - 1) * 8;
      const clusterZ = (Math.random() - 0.5) * 6;
      const origin = new BABYLON.Vector3(clusterX, -3, clusterZ);

      // Create a cluster with random material
      const material = materials[Math.floor(Math.random() * materials.length)];
      const objects = this.destructibleFactory.createCluster(
        5,
        origin,
        3,
        { material }
      );

      // Add shadows
      objects.forEach((obj) => {
        if (this.shadowGenerator) {
          this.shadowGenerator.addShadowCaster(obj.mesh);
        }
      });
    }

    // Add a few showcase objects (one of each material)
    const showcaseOrigin = new BABYLON.Vector3(0, -2, -8);
    const showcaseObjects = this.destructibleFactory.createShowcase(
      showcaseOrigin,
      DestructibleMaterial.METAL,
      2
    );

    showcaseObjects.forEach((obj) => {
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(obj.mesh);
      }
    });

    console.log('🎯 Destructible objects created with factory');
  }

  /**
   * Release a tire from the hilltop.
   *
   * @param speed     Normalised initial speed (0–1).  Maps to 0–MAX_RELEASE_SPEED.
   * @param direction Azimuth in degrees from straight-downhill (+X).
   *                  Negative = left (−Z), positive = right (+Z).  Clamped to ±45°.
   * @param tireType  Optional explicit tire type override.
   */
  public launchTire(speed: number, direction: number, tireType?: TireType): void {
    // Maximum initial speed (m/s) the player can give the tire on release.
    // Gravity and the hillside do the rest of the work.
    const MAX_RELEASE_SPEED = 10;

    // Use selected tire type from launch control UI if not explicitly specified
    const selectedType = tireType ?? this.launchControlUI.getSelectedTireType();

    // Check round manager for tire availability
    const currentRound = this.roundManager.getCurrentRound();
    if (currentRound && !this.roundManager.useTire()) {
      console.log('No tires remaining!');
      this.uiManager.showMessage('No tires left!', 2000);
      // Hide launch control once all tires are exhausted
      this.launchControlUI.hide();
      return;
    }

    // Briefly disable the launch button while the tire is in flight
    this.launchControlUI.setLaunchEnabled(false);
    setTimeout(() => {
      // Re-enable after a short cooldown (allow camera to settle)
      const round = this.roundManager.getCurrentRound();
      if (round && round.tiresAvailable > 0) {
        this.launchControlUI.setLaunchEnabled(true);
      } else {
        // No tires left — hide the control
        this.launchControlUI.hide();
      }
    }, 1200);

    // Fire achievement check for first launch
    this.achievementManager.check(GameEvent.TIRE_LAUNCHED, {
      tireType: selectedType,
    });

    const tire = new Tire(selectedType, this.scene, this.physicsManager, this.particleManager, this.screenEffects);

    // Place tire on terrain surface using the correct radius for the selected type.
    // Using TIRE_CONFIGS here avoids spawning a monster truck (r=0.8) halfway inside
    // the terrain because loadLevelForRound() couldn't know the type in advance.
    const tireRadius = TIRE_CONFIGS[selectedType].properties.radius;
    const launchPos = new BABYLON.Vector3(
      this._currentLaunchPosition.x,
      this._launchTerrainSurfaceY + tireRadius + 0.1,
      this._currentLaunchPosition.z,
    );
    tire.setPosition(launchPos);

    // Compute release velocity: direction is azimuth from +X (downhill).
    // The tire rolls DOWNHILL (+X direction) with a small sideways deviation.
    // No upward velocity – gravity and terrain slope take over from here.
    const directionRad = (direction * Math.PI) / 180;
    const releaseSpeed = speed * MAX_RELEASE_SPEED;

    const velocity = new BABYLON.Vector3(
      Math.cos(directionRad) * releaseSpeed,  // downhill component
      0,                                        // no vertical throw
      Math.sin(directionRad) * releaseSpeed,   // side deviation
    );

    tire.launch(velocity);

    // Add to shadow casters
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(tire.mesh);
    }

    // Create smoke trail
    const smokeSystem = this.particleManager.createTireSmoke(tire.mesh.position);

    this.activeTires.push(tire);

    // Update camera to follow tire
    this.cameraDirector.setFollowTarget(tire.mesh);

    // Screen shake on launch
    this.screenEffects.shake(0.2, 150);

    // Play sound
    this.soundManager.playSFX('tire_launch', 0.7);

    console.log('🎯 Tire launched!');
  }

  /**
   * Update UI elements
   */
  public updateUI(): void {
    const scoreEl = document.getElementById('score');
    const comboEl = document.getElementById('combo');
    const tiresEl = document.getElementById('tires-remaining');

    if (scoreEl) scoreEl.textContent = `Score: ${this.gameState.score}`;
    if (comboEl) comboEl.textContent = `Combo: ${this.gameState.combo}x`;
    if (tiresEl) tiresEl.textContent = `Tires: ${this.gameState.tiresRemaining}`;
  }

  /**
   * Add score with combo multiplier and effects
   */
  public addScore(points: number, isCombo: boolean = false, position?: BABYLON.Vector3): void {
    if (isCombo) {
      this.gameState.combo++;
    } else {
      this.gameState.combo = 0;
    }

    const multiplier = Math.max(1, this.gameState.combo);
    const finalPoints = points * multiplier;

    this.gameState.score += finalPoints;
    this.scoringSystem.addScore(finalPoints);
    this.gameState.objectsDestroyed++;

    // Add to round manager
    this.roundManager.addScore(finalPoints);

    // Visual effects
    if (position) {
      // Explosion particles
      this.particleManager.createExplosion(position, 1.0);

      // Debris particles (random color based on object)
      const debrisColor = new BABYLON.Color3(
        Math.random() * 0.5 + 0.5,
        Math.random() * 0.5 + 0.5,
        Math.random() * 0.5 + 0.5
      );
      this.particleManager.createDebris(position, debrisColor);
    }

    // Combo effects
    if (this.gameState.combo >= 2) {
      if (position) {
        this.particleManager.createComboCelebration(position, this.gameState.combo);
      }
      this.screenEffects.comboEffect(this.gameState.combo);
      this.soundManager.playSFX('combo_hit');
      this.uiManager.showMessage(`${this.gameState.combo}x COMBO!`, 1500);
      this.achievementManager.check(GameEvent.COMBO_HIT, {
        comboCount: this.gameState.combo,
      });
    }

    // Slow-motion instant replay on triple (or higher) combo
    if (this.gameState.combo >= 3) {
      this.slowMotionManager.trigger(2000, 0.25);
    }

    // Screen shake based on impact
    const shakeIntensity = Math.min(points / 100, 1.0);
    this.screenEffects.shake(shakeIntensity * 0.5, 200);

    // Play destruction sound
    this.soundManager.playSFX('object_destroyed', 0.5);

    this.updateUI();
  }

  /**
   * Reset current level
   */
  public resetLevel(): void {
    console.log('🔄 Resetting level...');

    // Remove all active tires
    this.activeTires.forEach((tire) => tire.destroy());
    this.activeTires = [];

    // Reset game state
    this.gameState.score = 0;
    this.gameState.combo = 0;
    this.gameState.tiresRemaining = 3;
    this.gameState.objectsDestroyed = 0;

    // Clear and recreate level for current round
    this.clearScene();
    const roundNum = this.roundManager.getCurrentRoundNumber() || 1;
    this.loadLevelForRound(roundNum);

    // Camera is repositioned inside loadLevelForRound() once terrain is built

    this.updateUI();
  }

  /**
   * Clear all objects from scene
   */
  private clearScene(): void {
    // Use levelGenerator.clearLevel() to properly clean up destructible objects,
    // environment props, and physics bodies via their own managers.  This ensures
    // DestructibleObjectFactory.destroyAll() and EnvironmentManager.clear() are
    // called so their internal tracking arrays are reset and no stale references
    // cause console errors on the next level load.
    this.levelGenerator.clearLevel();

    // Dispose any remaining meshes not tracked by the level generator (e.g. tire
    // meshes created by launchTire()).  Slice to avoid iterating a mutating array.
    // isDisposed() guards against double-disposal of meshes already cleaned up
    // by clearLevel() above.
    // BABYLON.Camera is not in scene.meshes, so no camera guard is needed.
    this.scene.meshes.slice().forEach((mesh) => {
      if (!mesh.isDisposed()) {
        mesh.dispose();
      }
    });
  }

  /**
   * Main render function
   */
  private render(): void {
    if (this.gameState.isPaused) {
      // Still render the scene even when paused for menu backgrounds
      this.scene.render();
      return;
    }

    const currentTime = performance.now();
    // Cap deltaTime to 250 ms so a tab-switch or debugger pause doesn't cause
    // the physics world to jump forward by many seconds in a single step.
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
    this.lastTime = currentTime;

    // Update performance manager
    this.performanceManager.update();

    // Skip frame if needed for FPS limiting
    if (this.performanceManager.shouldSkipFrame()) {
      return;
    }

    // Update FPS counter
    this.frameCount++;
    if (this.frameCount % 60 === 0) {
      this._fps = Math.round(1 / deltaTime);
    }

    // Update systems
    this.physicsManager.update(deltaTime);
    this.cameraDirector.update(deltaTime);

    // Update active tires
    this.activeTires.forEach((tire) => {
      tire.update(deltaTime);
    });

    // Update UI
    const currentRound = this.roundManager.getCurrentRound();
    if (currentRound) {
      this.uiManager.updateScore(this.roundManager.getTotalScore());
      this.uiManager.updateRound(currentRound.roundNumber, this.roundManager.getTotalRounds());
      this.uiManager.updateTires(currentRound.tiresAvailable);
      this.uiManager.updateTime(currentRound.timeRemaining);
      this.uiManager.updateFPS(this.performanceManager.getFPS());

      // Update combo display
      const combo = this.scoringSystem.getComboCount();
      const multiplier = this.scoringSystem.getComboMultiplier();
      if (combo > 1) {
        this.uiManager.updateCombo(combo, multiplier);
      }
    }

    // Update slow-motion manager
    this.slowMotionManager.update(deltaTime);

    // Render scene
    this.scene.render();
  }

  /**
   * Start render loop
   */
  public start(): void {
    this.lastTime = performance.now();
    this.engine.runRenderLoop(() => this.render());
  }

  /**
   * Pause game
   */
  public pause(): void {
    this.gameState.isPaused = true;
  }

  /**
   * Resume game
   */
  public resume(): void {
    this.gameState.isPaused = false;
  }

  /**
   * Toggle pause state
   */
  private togglePause(): void {
    if (this.gameState.isPaused) {
      this.resume();
      this.uiManager.hidePauseMenu();
      // Restore launch control if there are tires remaining
      const round = this.roundManager.getCurrentRound();
      if (round && round.tiresAvailable > 0) {
        this.launchControlUI.show();
        this.launchControlUI.setLaunchEnabled(true);
      }
    } else {
      this.pause();
      this.uiManager.showPauseMenu();
      // Hide launch control while paused
      this.launchControlUI.hide();
    }
  }

  /**
   * Cycle through camera angles
   */
  private cycleCamera(): void {
    const cameras = [
      CameraType.LAUNCH,
      CameraType.DRONE,
      CameraType.GOPRO,
      CameraType.OVERHEAD,
      CameraType.HERO_TIRE,
    ];
    const currentIndex = cameras.indexOf(this.cameraDirector.getCurrentCameraType());
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    this.cameraDirector.switchCamera(nextCamera);

    // Show camera name briefly
    const cameraNames: Record<CameraType, string> = {
      [CameraType.LAUNCH]: 'Launch View',
      [CameraType.DRONE]: 'Drone View',
      [CameraType.GOPRO]: 'GoPro View',
      [CameraType.OVERHEAD]: 'Overhead View',
      [CameraType.HERO_TIRE]: 'Hero Tire View',
      [CameraType.REPLAY]: 'Replay View',
    };
    this.uiManager.showMessage(cameraNames[nextCamera], 1500);
  }

  /**
   * Toggle FPS display
   */
  private toggleFPSDisplay(): void {
    const fpsElement = document.getElementById('fps-display');
    if (fpsElement) {
      fpsElement.style.display = fpsElement.style.display === 'none' ? 'block' : 'none';
    }
  }

  /**
   * Start a new game
   */
  private startNewGame(): void {
    console.log('🎮 Starting new game...');

    // Clear existing game state
    this.activeTires.forEach((tire) => tire.destroy());
    this.activeTires = [];
    this.clearScene();

    // Start round manager first so we know which round we're on
    this.roundManager.startNewGame();

    // Build level 1 layout
    this.loadLevelForRound(1);

    // Show game HUD
    this.uiManager.showGameHUD();

    // Show launch control
    this.launchControlUI.show();
    this.launchControlUI.setLaunchEnabled(true);

    // Wire up mobile touch controls for this game session
    const gameCanvas = this.engine.getRenderingCanvas() as HTMLCanvasElement;
    if (gameCanvas) {
      this.touchControlManager.init(gameCanvas, (p, a) => this.launchTire(p, a));
    }

    // Initialize sound
    this.soundManager.init().catch(err => console.warn('Sound init failed:', err));
    this.soundManager.playMusic('game_music', true);

    // Resume game
    this.resume();

    console.log('✅ Game started!');
  }

  /**
   * Return to main menu
   */
  private returnToMenu(): void {
    console.log('🏠 Returning to main menu...');

    // Stop music
    this.soundManager.stopMusic(1000);

    // Clear game state
    this.activeTires.forEach((tire) => tire.destroy());
    this.activeTires = [];
    this.clearScene();

    // Reset managers
    this.roundManager = new RoundManager();
    this.particleManager.stopAll();

    // Recreate level 1 as the background
    this.loadLevelForRound(1);

    // Show main menu
    this.uiManager.showMainMenu();

    // Hide launch control on menu
    this.launchControlUI.hide();

    // Disable touch controls when returning to menu
    this.touchControlManager.disable();

    // Pause game
    this.pause();
  }

  /**
   * Show game over screen
   */
  private showGameOver(detail: any): void {
    console.log('💀 Game Over!');

    // Hide launch control
    this.launchControlUI.hide();

    // Stop music
    this.soundManager.stopMusic(500);
    this.soundManager.playSFX('game_over');

    // Show screen effects
    this.screenEffects.gameOver();

    // Get stats
    const stats = this.scoringSystem.getStatistics();
    const totalScore = detail.totalScore || 0;
    const isNewHighScore = totalScore > this.scoringSystem.getHighScore();

    // Show UI
    this.uiManager.showGameOver(
      totalScore,
      detail.roundsCompleted || 0,
      detail.objectsDestroyed || 0,
      stats.maxCombo || 0,
      this.scoringSystem.getHighScore(),
      isNewHighScore
    );

    // Pause game
    this.pause();

    // Prompt for name if score qualifies for leaderboard
    if (totalScore > 0 && this.leaderboardManager.isTopScore(totalScore)) {
      setTimeout(() => {
        this.uiManager.showNameEntry(totalScore, (name: string) => {
          const entry: LeaderboardEntry = {
            name,
            score: totalScore,
            rounds: detail.roundsCompleted || 0,
            combo: stats.maxCombo || 0,
            date: new Date().toISOString(),
          };
          this.leaderboardManager.addEntry(entry);
        });
      }, 1500);
    }
  }

  /**
   * Show victory screen
   */
  private showVictory(detail: any): void {
    console.log('🏆 Victory!');

    // Hide launch control
    this.launchControlUI.hide();

    // Stop music
    this.soundManager.stopMusic(500);
    this.soundManager.playSFX('round_complete');

    // Show screen effects
    this.screenEffects.victory();

    // Get stats
    const stats = this.scoringSystem.getStatistics();
    const totalScore = detail.totalScore || 0;
    const isNewHighScore = totalScore > this.scoringSystem.getHighScore();

    // Show UI (victory uses same screen, just different title)
    this.uiManager.showGameOver(
      totalScore,
      detail.roundsCompleted || 5, // Victory means all 5 rounds complete
      detail.objectsDestroyed || 0,
      stats.maxCombo || 0,
      this.scoringSystem.getHighScore(),
      isNewHighScore
    );

    // Pause game
    this.pause();

    // Prompt for name if score qualifies for leaderboard
    if (totalScore > 0 && this.leaderboardManager.isTopScore(totalScore)) {
      setTimeout(() => {
        this.uiManager.showNameEntry(totalScore, (name: string) => {
          const entry: LeaderboardEntry = {
            name,
            score: totalScore,
            rounds: detail.roundsCompleted || 5,
            combo: stats.maxCombo || 0,
            date: new Date().toISOString(),
          };
          this.leaderboardManager.addEntry(entry);
        });
      }, 1500);
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.engine.stopRenderLoop();
    this.clearScene();
    this.scene.dispose();
    this.engine.dispose();
    this.launchControlUI.destroy();
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * Enable SSAO post-processing effect
   */
  public enableSSAO(): void {
    if (this.defaultPipeline) {
      const ssaoRatio = {
        ssaoRatio: 0.5, // Lower for better performance
        combineRatio: 1.0,
      };

      const ssao = new BABYLON.SSAORenderingPipeline(
        'ssao',
        this.scene,
        ssaoRatio,
        [this.camera]
      );

      ssao.fallOff = 0.000001;
      ssao.area = 0.5;
      ssao.radius = 2.0;
      ssao.totalStrength = 1.3;
      ssao.base = 0.5;

      console.log('🌑 SSAO enabled for enhanced depth');
    }
  }

  /**
   * Trigger a screen shake proportional to impact velocity.
   * Called by tires (or any system) when a hard collision occurs.
   *
   * @param speed      Impact speed in m/s
   * @param isGround   Whether the collision was with the ground (softer shake)
   */
  public triggerImpactShake(speed: number, isGround: boolean): void {
    // Scale shake between 0.1 and 0.6; ground impacts are a bit softer
    const maxIntensity = isGround ? 0.45 : 0.6;
    const shakeIntensity = Math.min(0.1 + speed * 0.025, maxIntensity);
    const shakeDuration = isGround ? 180 : 250;
    this.screenEffects.shake(shakeIntensity, shakeDuration);
  }

  /**
   * Build the scene for a given round number using LevelGenerator.
   * Updates the HUD level name, launch position (terrain-aware), and camera.
   */
  private loadLevelForRound(roundNumber: number): void {
    const layout = getLevelLayout(roundNumber);

    // Apply sky colour
    this.scene.clearColor = layout.skyColor;

    // Re-create the levelGenerator each time so it can shadow-register correctly
    this.levelGenerator = new LevelGenerator(
      this.scene,
      this.physicsManager,
      this.destructibleFactory,
      this.environmentManager,
      this.shadowGenerator,
    );

    this.levelGenerator.buildLevel(layout);

    // Compute the tire's release position on the terrain surface.
    // layout.launchPosition.x/z give the hilltop XZ; Y comes from terrain.
    const lx = layout.launchPosition.x;
    const lz = layout.launchPosition.z;
    const surfaceY = this.levelGenerator.getTerrainSurfaceY(lx, lz);
    // Store terrain surface Y; the actual tire Y is computed per-type in launchTire().
    this._launchTerrainSurfaceY = surfaceY;
    this._currentLaunchPosition = new BABYLON.Vector3(lx, surfaceY, lz);

    // Position camera behind the hilltop, looking downhill (+X direction)
    this.positionCameraForHill(lx, lz, surfaceY);

    // Announce the level name in the HUD
    this.uiManager.showMessage(
      `Round ${layout.roundNumber}: ${layout.name}`,
      3000,
    );

    console.log(
      `GameManager: loaded level ${layout.roundNumber} "${layout.name}" – ` +
      `${layout.objects.length} objects, ${layout.props.length} props – ` +
      `launch XZ (${lx}, ${lz}) surfaceY=${surfaceY.toFixed(1)}`,
    );
  }

  /**
   * Position the main camera behind the hilltop, looking downhill.
   * Called after terrain is built so the exact surface height is known.
   */
  private positionCameraForHill(hillX: number, hillZ: number, surfaceY: number): void {
    // Place camera behind (west of) the hilltop, elevated above it
    const camX = hillX - 18;
    const camY = surfaceY + 12;
    const camZ = hillZ;

    // Look toward the downhill play area
    const targetX = hillX + 20;
    const targetY = surfaceY - 3;
    const targetZ = hillZ;

    this.camera.position  = new BABYLON.Vector3(camX, camY, camZ);
    this.camera.setTarget(new BABYLON.Vector3(targetX, targetY, targetZ));
  }

  /**
   * Get current FPS
   */
  public getFPS(): number {
    return this._fps;
  }
}
