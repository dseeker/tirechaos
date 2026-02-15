import * as THREE from 'three';
import { PhysicsManager } from '../systems/PhysicsManager';
import { CameraDirector } from '../systems/CameraDirector';
import { ScoringSystem } from '../systems/ScoringSystem';
import { InputHandler } from '../systems/InputHandler';
import { Tire } from '../entities/Tire';
import { GameState, TireType, LevelConfig } from '../types';

/**
 * GameManager - Central game controller (Singleton pattern)
 * Manages game state, scene, and coordinates all subsystems
 */
export class GameManager {
  private static instance: GameManager;

  // Core Three.js components
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public camera: THREE.PerspectiveCamera;

  // Game systems
  public physicsManager: PhysicsManager;
  public cameraDirector: CameraDirector;
  public scoringSystem: ScoringSystem;
  public inputHandler: InputHandler;

  // Game state
  public gameState: GameState;
  public currentLevel: LevelConfig | null = null;
  public activeTires: Tire[] = [];

  // Performance tracking
  private lastTime: number = 0;
  private frameCount: number = 0;
  private _fps: number = 60;

  private constructor() {
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

    // Setup renderer
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

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
    this.setupEventListeners();
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
   * Setup scene lighting
   */
  private setupLights(): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light (sun) with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    this.scene.add(directionalLight);

    // Hemisphere light for sky/ground ambient
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x5d4e37, 0.4);
    this.scene.add(hemisphereLight);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // UI button handlers
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetLevel());
    }
  }

  /**
   * Handle window resize
   */
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Initialize and start the game
   */
  public async init(): Promise<void> {
    console.log('🎮 Initializing TIRE CHAOS...');

    // Create test level
    this.createTestLevel();

    // Hide loading, show UI
    const loading = document.getElementById('loading');
    const hud = document.getElementById('hud');
    const controls = document.getElementById('controls');

    if (loading) loading.classList.add('hidden');
    if (hud) hud.classList.remove('hidden');
    if (controls) controls.classList.remove('hidden');

    // Start game loop
    this.start();

    console.log('✅ Game initialized successfully!');
  }

  /**
   * Create a test level for development
   */
  private createTestLevel(): void {
    // Create ground/hill
    const hillGeometry = new THREE.BoxGeometry(50, 1, 20);
    const hillMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d8c3e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const hillMesh = new THREE.Mesh(hillGeometry, hillMaterial);
    hillMesh.position.set(0, -5, 0);
    hillMesh.rotation.z = -0.2; // Slight slope
    hillMesh.receiveShadow = true;
    this.scene.add(hillMesh);

    // Add to physics
    this.physicsManager.addGroundPlane(hillMesh);

    // Create some destructible objects
    this.createDestructibleObjects();
  }

  /**
   * Create destructible objects for testing
   */
  private createDestructibleObjects(): void {
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0xff6b35 }),
      new THREE.MeshStandardMaterial({ color: 0x00d9ff }),
      new THREE.MeshStandardMaterial({ color: 0xb7ce63 }),
    ];

    for (let i = 0; i < 10; i++) {
      const material = materials[i % materials.length];
      const mesh = new THREE.Mesh(boxGeometry, material);

      // Position objects down the hill
      mesh.position.set(
        (Math.random() - 0.5) * 10,
        -3 + Math.random() * 2,
        (Math.random() - 0.5) * 8,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.scene.add(mesh);
      this.physicsManager.addDestructibleObject(mesh, {
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
    tire.setPosition(new THREE.Vector3(-15, 2, 0));

    // Calculate launch velocity
    const launchSpeed = power * 30; // Max speed ~30 m/s
    const angleRad = (angle * Math.PI) / 180;

    const velocity = new THREE.Vector3(
      Math.cos(angleRad) * launchSpeed,
      Math.sin(angleRad) * launchSpeed,
      0,
    );

    tire.launch(velocity);

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
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

    this.updateUI();
  }

  /**
   * Clear all objects from scene
   */
  private clearScene(): void {
    const objectsToRemove: THREE.Object3D[] = [];

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry) {
        objectsToRemove.push(object);
      }
    });

    objectsToRemove.forEach((object) => {
      this.scene.remove(object);
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });

    this.physicsManager.clear();
  }

  /**
   * Main game loop
   */
  private animate(time: number): void {
    if (this.gameState.isPaused) {
      requestAnimationFrame(this.animate.bind(this));
      return;
    }

    // Calculate delta time
    const deltaTime = (time - this.lastTime) / 1000;
    this.lastTime = time;

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
    this.renderer.render(this.scene, this.camera);

    // Continue loop
    requestAnimationFrame(this.animate.bind(this));
  }

  /**
   * Start game loop
   */
  public start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame(this.animate.bind(this));
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
    this.clearScene();
    this.renderer.dispose();
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }
}
