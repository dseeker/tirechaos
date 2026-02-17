import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';
import { TireType, TIRE_CONFIGS, TireConfig } from '../types';
import { PhysicsManager } from '../systems/PhysicsManager';
import { ParticleManager } from '../systems/ParticleManager';
import { ScreenEffects } from '../systems/ScreenEffects';

// Minimum speed (m/s) below which collisions are ignored for effects
const IMPACT_THRESHOLD = 1.5;
// Speed (m/s) above which a "hard" impact screen shake is triggered
const HARD_IMPACT_THRESHOLD = 8.0;
// Minimum milliseconds between consecutive impact effects (debounce)
const IMPACT_DEBOUNCE_MS = 150;

/**
 * Tire - Main game entity representing a rollable tire
 * Now with stunning PBR materials!
 */
export class Tire {
  public mesh: BABYLON.Mesh;
  public body: CANNON.Body;
  public config: TireConfig;
  public isLaunched: boolean = false;
  public launchTime: number = 0;

  private scene: BABYLON.Scene;
  private physicsManager: PhysicsManager;
  private trailPoints: BABYLON.Vector3[] = [];
  private trail?: BABYLON.LinesMesh;

  // Optional effect dependencies (injected after construction when available)
  private particleManager?: ParticleManager;
  private screenEffects?: ScreenEffects;

  // Collision handling
  private collisionHandler?: (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => void;
  private lastImpactTime: number = 0;

  constructor(
    type: TireType,
    scene: BABYLON.Scene,
    physicsManager: PhysicsManager,
    particleManager?: ParticleManager,
    screenEffects?: ScreenEffects,
  ) {
    this.config = TIRE_CONFIGS[type];
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.particleManager = particleManager;
    this.screenEffects = screenEffects;

    // Create visual mesh
    this.mesh = this.createMesh();
    // Babylon meshes are auto-added to scene

    // Create physics body
    this.body = this.createPhysicsBody();

    // Create trail effect
    this.createTrail();

    // Register collision listener (requires particleManager to be set)
    this.registerCollisionListener();

    console.log(`🛞 Tire created: ${type}`);
  }

  /**
   * Register a Cannon.js collide listener on the tire's physics body.
   * Fires impact particles and optional screen shake on significant hits.
   */
  private registerCollisionListener(): void {
    this.collisionHandler = (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
      const now = performance.now();
      if (now - this.lastImpactTime < IMPACT_DEBOUNCE_MS) return;

      // Relative velocity at contact point
      const relVel = event.contact.getImpactVelocityAlongNormal();
      const speed = Math.abs(relVel);

      if (speed < IMPACT_THRESHOLD) return;

      this.lastImpactTime = now;

      // Determine collision point from the contact equation
      // ri is the vector from body A's center to the contact point
      const contactPoint = new BABYLON.Vector3(
        this.body.position.x + event.contact.ri.x,
        this.body.position.y + event.contact.ri.y,
        this.body.position.z + event.contact.ri.z,
      );

      // Determine whether the other body is a "ground" body by checking if
      // it is static (mass === 0). Ground planes and the hill are mass=0.
      const otherBody = event.body;
      const isGround = otherBody.mass === 0;

      // Trigger particle effect
      if (this.particleManager) {
        this.particleManager.createImpactParticles(contactPoint, speed, isGround);
      }

      // Trigger screen shake on hard impacts
      if (this.screenEffects && speed >= HARD_IMPACT_THRESHOLD) {
        // Scale shake intensity between 0.1 and 0.6 depending on speed
        const shakeIntensity = Math.min(0.1 + (speed - HARD_IMPACT_THRESHOLD) * 0.03, 0.6);
        const shakeDuration = isGround ? 180 : 250;
        this.screenEffects.shake(shakeIntensity, shakeDuration);
      }
    };

    // Cannon-es uses addEventListener with the event name 'collide'
    this.body.addEventListener('collide', this.collisionHandler as any);
  }

  /**
   * Create visual mesh for tire with PBR materials
   */
  private createMesh(): BABYLON.Mesh {
    const { radius, width } = this.config.properties;

    // Create tire geometry (cylinder)
    const mesh = BABYLON.MeshBuilder.CreateCylinder(
      `tire_${Date.now()}`,
      {
        height: width,
        diameter: radius * 2,
        tessellation: 32,
      },
      this.scene,
    );

    // Rotate to be wheel-like (around Z axis)
    mesh.rotation.z = Math.PI / 2;

    // Create PBR material for realistic tire look
    const material = new BABYLON.PBRMetallicRoughnessMaterial(
      `tireMat_${Date.now()}`,
      this.scene,
    );
    material.baseColor = this.config.materialConfig.baseColor;
    material.metallic = this.config.materialConfig.metallic;
    material.roughness = this.config.materialConfig.roughness;

    // Add tread pattern texture
    const treadTexture = this.createTreadTexture();
    material.baseTexture = treadTexture;

    // Enable emissive for slight self-illumination
    if (this.config.materialConfig.emissiveColor) {
      material.emissiveColor = this.config.materialConfig.emissiveColor;
    }

    mesh.material = material;
    mesh.receiveShadows = true;

    return mesh;
  }

  /**
   * Create simple tread texture for tire
   */
  private createTreadTexture(): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Base color (convert Color3 to hex)
    const color = this.config.materialConfig.baseColor;
    const r = Math.floor(color.r * 255);
    const g = Math.floor(color.g * 255);
    const b = Math.floor(color.b * 255);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, 256, 256);

    // Add tread lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;

    for (let i = 0; i < 256; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }

    // Create Babylon texture from canvas
    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene);
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

    return texture;
  }

  /**
   * Create physics body for tire
   */
  private createPhysicsBody(): CANNON.Body {
    const { radius, width, mass } = this.config.properties;
    const tireMaterial = new CANNON.Material('tire');

    return this.physicsManager.addTireBody(this.mesh, radius, width, mass, tireMaterial);
  }

  /**
   * Create trail effect
   */
  private createTrail(): void {
    // Babylon LinesMesh will be created when we have points
    // For now, just initialize trail points array
    this.trailPoints = [];
  }

  /**
   * Set tire position
   */
  public setPosition(position: BABYLON.Vector3): void {
    this.mesh.position.copyFrom(position);
    this.body.position.set(position.x, position.y, position.z);
  }

  /**
   * Launch tire with given velocity
   */
  public launch(velocity: BABYLON.Vector3): void {
    this.body.velocity.set(velocity.x, velocity.y, velocity.z);

    // Add some initial spin
    this.body.angularVelocity.set(0, 0, -velocity.x / this.config.properties.radius);

    this.isLaunched = true;
    this.launchTime = performance.now();

    console.log(`🚀 Tire launched with velocity: ${velocity.length().toFixed(2)} m/s`);
  }

  /**
   * Update trail effect
   */
  private updateTrail(): void {
    if (!this.isLaunched) return;

    // Add current position to trail
    this.trailPoints.push(this.mesh.position.clone());

    // Keep only last 50 points
    if (this.trailPoints.length > 50) {
      this.trailPoints.shift();
    }

    // Update or create trail mesh
    if (this.trailPoints.length >= 2) {
      // Dispose old trail
      if (this.trail) {
        this.trail.dispose();
      }

      // Create new trail line
      this.trail = BABYLON.MeshBuilder.CreateLines(
        `trail_${Date.now()}`,
        {
          points: this.trailPoints,
          updatable: true,
        },
        this.scene,
      );

      // Set trail appearance
      this.trail.color = new BABYLON.Color3(1, 1, 1);
      this.trail.alpha = 0.5;
    }
  }

  /**
   * Get current speed
   */
  public getSpeed(): number {
    return this.body.velocity.length();
  }

  /**
   * Get distance traveled
   */
  public getDistanceTraveled(): number {
    let distance = 0;
    for (let i = 1; i < this.trailPoints.length; i++) {
      distance += BABYLON.Vector3.Distance(this.trailPoints[i], this.trailPoints[i - 1]);
    }
    return distance;
  }

  /**
   * Check if tire is at rest
   */
  public isAtRest(): boolean {
    return this.body.sleepState === CANNON.Body.SLEEPING || this.getSpeed() < 0.1;
  }

  /**
   * Update tire state
   */
  public update(_deltaTime: number): void {
    if (!this.isLaunched) return;

    // Update trail
    this.updateTrail();

    // Check if tire has fallen off the map
    if (this.mesh.position.y < -50) {
      console.log('🌊 Tire fell off the map!');
      this.destroy();
    }

    // Update mesh position and rotation to match physics
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z);

    // Babylon uses rotationQuaternion for physics sync
    if (!this.mesh.rotationQuaternion) {
      this.mesh.rotationQuaternion = new BABYLON.Quaternion();
    }
    this.mesh.rotationQuaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w,
    );
  }

  /**
   * Clean up tire resources
   */
  public destroy(): void {
    // Remove the Cannon.js collision listener before removing the body
    if (this.collisionHandler) {
      this.body.removeEventListener('collide', this.collisionHandler as any);
      this.collisionHandler = undefined;
    }

    // Remove from physics
    this.physicsManager.world.removeBody(this.body);

    // Dispose mesh and material (Babylon handles geometry internally)
    if (this.mesh.material) {
      this.mesh.material.dispose();
    }
    this.mesh.dispose();

    // Dispose trail
    if (this.trail) {
      this.trail.dispose();
    }

    console.log('🗑️ Tire destroyed');
  }
}
