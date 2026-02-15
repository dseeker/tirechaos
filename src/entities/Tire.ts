import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TireType, TIRE_CONFIGS, TireConfig } from '../types';
import { PhysicsManager } from '../systems/PhysicsManager';

/**
 * Tire - Main game entity representing a rollable tire
 */
export class Tire {
  public mesh: THREE.Mesh;
  public body: CANNON.Body;
  public config: TireConfig;
  public isLaunched: boolean = false;
  public launchTime: number = 0;

  private scene: THREE.Scene;
  private physicsManager: PhysicsManager;
  private trailPoints: THREE.Vector3[] = [];
  private trail?: THREE.Line;

  constructor(type: TireType, scene: THREE.Scene, physicsManager: PhysicsManager) {
    this.config = TIRE_CONFIGS[type];
    this.scene = scene;
    this.physicsManager = physicsManager;

    // Create visual mesh
    this.mesh = this.createMesh();
    this.scene.add(this.mesh);

    // Create physics body
    this.body = this.createPhysicsBody();

    // Create trail effect
    this.createTrail();

    console.log(`🛞 Tire created: ${type}`);
  }

  /**
   * Create visual mesh for tire
   */
  private createMesh(): THREE.Mesh {
    const { radius, width } = this.config.properties;

    // Create tire geometry (cylinder)
    const geometry = new THREE.CylinderGeometry(radius, radius, width, 32);

    // Rotate to be wheel-like (around Z axis)
    geometry.rotateZ(Math.PI / 2);

    // Create material with texture
    const material = new THREE.MeshStandardMaterial({
      color: this.config.color,
      roughness: 0.9,
      metalness: 0.1,
    });

    // Add tread pattern using normal map (simplified)
    const treadTexture = this.createTreadTexture();
    material.map = treadTexture;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  /**
   * Create simple tread texture
   */
  private createTreadTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Base color
    ctx.fillStyle = `#${this.config.color.toString(16).padStart(6, '0')}`;
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

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

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
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      opacity: 0.5,
      transparent: true,
    });

    this.trail = new THREE.Line(geometry, material);
    this.scene.add(this.trail);
  }

  /**
   * Set tire position
   */
  public setPosition(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.body.position.copy(position as any);
  }

  /**
   * Launch tire with given velocity
   */
  public launch(velocity: THREE.Vector3): void {
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
    if (!this.isLaunched || !this.trail) return;

    // Add current position to trail
    this.trailPoints.push(this.mesh.position.clone());

    // Keep only last 50 points
    if (this.trailPoints.length > 50) {
      this.trailPoints.shift();
    }

    // Update trail geometry
    const positions = new Float32Array(this.trailPoints.length * 3);
    this.trailPoints.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    });

    this.trail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trail.geometry.attributes.position.needsUpdate = true;
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
      distance += this.trailPoints[i].distanceTo(this.trailPoints[i - 1]);
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

    // Update mesh rotation to match physics
    this.mesh.position.copy(this.body.position as any);
    this.mesh.quaternion.copy(this.body.quaternion as any);
  }

  /**
   * Clean up tire resources
   */
  public destroy(): void {
    // Remove from scene
    this.scene.remove(this.mesh);
    if (this.trail) {
      this.scene.remove(this.trail);
    }

    // Remove from physics
    this.physicsManager.world.removeBody(this.body);

    // Dispose geometry and material
    this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }

    if (this.trail) {
      this.trail.geometry.dispose();
      if (this.trail.material instanceof THREE.Material) {
        this.trail.material.dispose();
      }
    }

    console.log('🗑️ Tire destroyed');
  }
}
