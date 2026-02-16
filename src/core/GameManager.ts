import * as BABYLON from '@babylonjs/core';
import { PhysicsManager } from '../systems/PhysicsManager';
import { CameraDirector } from '../systems/CameraDirector';
import { ScoringSystem } from '../systems/ScoringSystem';
import { InputHandler } from '../systems/InputHandler';
import { Tire } from '../entities/Tire';
import { GameState, TireType, LevelConfig, DEFAULT_POSTPROCESSING_CONFIG } from '../types';

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

  // Game systems
  public physicsManager: PhysicsManager;
  public cameraDirector: CameraDirector;
  public scoringSystem: ScoringSystem;
  public inputHandler: InputHandler;

  // Rendering pipeline
  private defaultPipeline?: BABYLON.DefaultRenderingPipeline;
  private shadowGenerator?: BABYLON.ShadowGenerator;

  // Game state
  public gameState: GameState;
  public currentLevel: LevelConfig | null = null;
  public activeTires: Tire[] = [];

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

    // Enable physics (Cannon.js)
    this.scene.enablePhysics(
      new BABYLON.Vector3(0, -9.82, 0),
      new BABYLON.CannonJSPlugin()
    );

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

    // Initialize game systems
    this.physicsManager = new PhysicsManager();
    this.cameraDirector = new CameraDirector(this.camera, this.scene);
    this.scoringSystem = new ScoringSystem();
    this.inputHandler = new InputHandler(this);

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

    // UI button handlers
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetLevel());
    }

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

    // Create test level
    this.createTestLevel();

    // Hide loading, show UI
    const loading = document.getElementById('loading');
    const hud = document.getElementById('hud');
    const controls = document.getElementById('controls');

    if (loading) loading.classList.add('hidden');
    if (hud) hud.classList.remove('hidden');
    if (controls) controls.classList.remove('hidden');

    // Start render loop
    this.start();

    console.log('✅ Game initialized successfully with Babylon.js!');
    console.log('🎨 PBR materials, advanced lighting, and post-processing active!');
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

    // Create some destructible objects
    this.createDestructibleObjects();

    console.log('🏔️ Test level created with PBR materials');
  }

  /**
   * Create destructible objects with PBR materials
   */
  private createDestructibleObjects(): void {
    const colors = [
      BABYLON.Color3.FromHexString('#ff6b35'), // Orange
      BABYLON.Color3.FromHexString('#00d9ff'), // Cyan
      BABYLON.Color3.FromHexString('#b7ce63'), // Lime
    ];

    for (let i = 0; i < 10; i++) {
      const box = BABYLON.MeshBuilder.CreateBox(
        `box_${i}`,
        { size: 1 },
        this.scene
      );

      // Position objects down the hill
      box.position = new BABYLON.Vector3(
        (Math.random() - 0.5) * 10,
        -3 + Math.random() * 2,
        (Math.random() - 0.5) * 8
      );

      // PBR material
      const material = new BABYLON.PBRMetallicRoughnessMaterial(`boxMat_${i}`, this.scene);
      material.baseColor = colors[i % colors.length];
      material.metallic = 0.1;
      material.roughness = 0.7;
      box.material = material;

      // Enable shadows
      box.receiveShadows = true;
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(box);
      }

      this.physicsManager.addDestructibleObject(box, {
        mass: 5,
        health: 100,
        points: 50,
      });
    }
  }

  /**
   * Launch a tire with given power and angle
   */
  public launchTire(power: number, angle: number, tireType: TireType = TireType.STANDARD): void {
    if (this.gameState.tiresRemaining <= 0) {
      console.log('No tires remaining!');
      return;
    }

    const tire = new Tire(tireType, this.scene, this.physicsManager);

    // Set launch position
    tire.setPosition(new BABYLON.Vector3(-15, 2, 0));

    // Calculate launch velocity
    const launchSpeed = power * 30;
    const angleRad = (angle * Math.PI) / 180;

    const velocity = new BABYLON.Vector3(
      Math.cos(angleRad) * launchSpeed,
      Math.sin(angleRad) * launchSpeed,
      0
    );

    tire.launch(velocity);

    // Add to shadow casters
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(tire.mesh);
    }

    this.activeTires.push(tire);
    this.gameState.tiresRemaining--;

    // Update camera to follow tire
    this.cameraDirector.setFollowTarget(tire.mesh);

    this.updateUI();
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
   * Add score with combo multiplier
   */
  public addScore(points: number, isCombo: boolean = false): void {
    if (isCombo) {
      this.gameState.combo++;
    } else {
      this.gameState.combo = 0;
    }

    const multiplier = Math.max(1, this.gameState.combo);
    const finalPoints = points * multiplier;

    this.gameState.score += finalPoints;
    this.scoringSystem.addScore(finalPoints);

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

    // Clear and recreate level
    this.clearScene();
    this.createTestLevel();

    // Reset camera
    this.camera.position = new BABYLON.Vector3(0, 10, 20);
    this.camera.setTarget(BABYLON.Vector3.Zero());

    this.updateUI();
  }

  /**
   * Clear all objects from scene
   */
  private clearScene(): void {
    // Dispose all meshes except camera
    this.scene.meshes.forEach((mesh) => {
      if (mesh !== this.camera as any) {
        mesh.dispose();
      }
    });

    this.physicsManager.clear();
  }

  /**
   * Main render function
   */
  private render(): void {
    if (this.gameState.isPaused) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

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
   * Clean up resources
   */
  public destroy(): void {
    this.engine.stopRenderLoop();
    this.clearScene();
    this.scene.dispose();
    this.engine.dispose();
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
   * Get current FPS
   */
  public getFPS(): number {
    return this._fps;
  }
}
