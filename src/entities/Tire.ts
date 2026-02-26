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
  private trailColors: BABYLON.Color4[] = [];
  private trail?: BABYLON.LinesMesh;

  // Optional effect dependencies (injected after construction when available)
  private particleManager?: ParticleManager;
  private screenEffects?: ScreenEffects;

  // Collision handling
  private collisionHandler?: (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => void;
  private lastImpactTime: number = 0;

  // Squash-and-stretch scale animation
  private targetScale: BABYLON.Vector3 = new BABYLON.Vector3(1, 1, 1);
  private currentScale: BABYLON.Vector3 = new BABYLON.Vector3(1, 1, 1);
  private readonly SCALE_SPRING = 8; // spring constant, units per second

  // Advanced vertex deformation system
  private originalPositions?: Float32Array;
  private deformedPositions?: Float32Array;
  private vertexRestoreProgress: number = 1.0; // 0 = fully deformed, 1 = fully restored
  private readonly VERTEX_RESTORE_SPEED = 1 / 0.3; // restore over 0.3 seconds

  // Inertial wobble system
  private wobbleTime: number = 0;
  private wobbleAmplitude: number = 0;

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
   * Apply contact patch deformation - flatten the tire at the contact point
   * @param contactPointLocal - Contact point in local mesh space
   * @param depth - Deformation depth (0-1 range)
   */
  private applyContactPatch(contactPointLocal: BABYLON.Vector3, depth: number): void {
    if (!this.originalPositions || !this.deformedPositions) return;

    const radius = this.config.properties.radius;
    const falloffRadius = radius * 1.5;
    const positions = this.deformedPositions;

    // For each vertex, compute distance to contact point and displace
    for (let i = 0; i < positions.length; i += 3) {
      const vx = positions[i];
      const vy = positions[i + 1];
      const vz = positions[i + 2];

      // Distance from vertex to contact point
      const dx = vx - contactPointLocal.x;
      const dy = vy - contactPointLocal.y;
      const dz = vz - contactPointLocal.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < falloffRadius) {
        // Gaussian falloff
        const falloff = Math.exp(-(dist * dist) / (falloffRadius * falloffRadius * 0.5));
        const displacement = depth * falloff;

        // Direction from contact point to vertex (push inward toward tire center)
        // Tire center is at origin in local space
        const toCenter = new BABYLON.Vector3(-vx, -vy, -vz).normalize();

        // Apply displacement
        positions[i] += toCenter.x * displacement;
        positions[i + 1] += toCenter.y * displacement;
        positions[i + 2] += toCenter.z * displacement;
      }
    }

    // Update mesh with deformed vertices
    this.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);
    this.vertexRestoreProgress = 0; // Start restoration process
  }

  /**
   * Restore vertices back to original positions over time
   * @param deltaTime - Time elapsed since last frame
   */
  private restoreVertices(deltaTime: number): void {
    if (!this.originalPositions || !this.deformedPositions) return;
    if (this.vertexRestoreProgress >= 1.0) return;

    this.vertexRestoreProgress += this.VERTEX_RESTORE_SPEED * deltaTime;
    this.vertexRestoreProgress = Math.min(this.vertexRestoreProgress, 1.0);

    // Lerp deformed positions back to original
    const t = this.vertexRestoreProgress;
    for (let i = 0; i < this.deformedPositions.length; i++) {
      this.deformedPositions[i] =
        this.deformedPositions[i] * (1 - t) + this.originalPositions[i] * t;
    }

    // Update mesh
    this.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, this.deformedPositions, true);

    // When fully restored, trigger wobble
    if (this.vertexRestoreProgress >= 1.0 && this.wobbleAmplitude > 0) {
      // Wobble is triggered by having amplitude, time will increment in update()
    }
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

      // Log significant terrain hits — useful for debugging and e2e tests.
      if (isGround) {
        const p = this.body.position;
        const { restitution, friction } = this.config.properties;
        console.log(
          `🌍 terrain-hit [${this.config.type}] speed=${speed.toFixed(1)} m/s ` +
            `restitution=${restitution} friction=${friction} ` +
            `pos=(${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)})`,
        );
      }

      // Trigger particle effect
      if (this.particleManager) {
        this.particleManager.createImpactParticles(contactPoint, speed, isGround);
      }

      // === Advanced deformation system ===
      const intensity = Math.min(speed / 20, 1.0);

      // 1. CONTACT PATCH VERTEX DEFORMATION
      if (this.originalPositions && this.deformedPositions) {
        // Convert contact point to local mesh space
        const worldMatrix = this.mesh.getWorldMatrix();
        const invWorldMatrix = worldMatrix.clone();
        invWorldMatrix.invert();

        const contactPointLocal = BABYLON.Vector3.TransformCoordinates(
          contactPoint,
          invWorldMatrix,
        );

        // Convert contact normal to local space
        const worldNormal = new BABYLON.Vector3(
          event.contact.ni.x,
          event.contact.ni.y,
          event.contact.ni.z,
        );
        const localNormal = BABYLON.Vector3.TransformNormal(worldNormal, invWorldMatrix);

        // Apply contact patch deformation (depth based on speed)
        const deformDepth = Math.min(speed / 30, 0.5) * this.config.properties.radius;
        this.applyContactPatch(contactPointLocal, deformDepth);
      }

      // 2. VELOCITY-CORRECTED SQUASH-AND-STRETCH
      // Get velocity direction (where the tire is moving)
      const velocity = this.body.velocity;
      const velMag = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);

      if (velMag > 0.1) {
        // Normalize velocity to get flight direction
        const velDir = new BABYLON.Vector3(
          velocity.x / velMag,
          velocity.y / velMag,
          velocity.z / velMag,
        );

        // Squash along velocity axis, stretch perpendicular
        const squashAmount = 1 - 0.2 * intensity; // compress
        const stretchAmount = 1 + 0.15 * intensity; // expand

        // Compute stretch factors for each axis based on velocity alignment
        const vx = Math.abs(velDir.x);
        const vy = Math.abs(velDir.y);
        const vz = Math.abs(velDir.z);

        // Blend between squash and stretch based on velocity alignment
        this.targetScale.set(
          1 + (squashAmount - 1) * vx + (stretchAmount - 1) * (1 - vx),
          1 + (squashAmount - 1) * vy + (stretchAmount - 1) * (1 - vy),
          1 + (squashAmount - 1) * vz + (stretchAmount - 1) * (1 - vz),
        );
      } else {
        // Fallback: use contact normal (original behavior)
        const nx = event.contact.ni.x;
        const ny = event.contact.ni.y;
        const nz = event.contact.ni.z;

        const squashScale = 1 + intensity * 0.4;
        const stretchScale = 1 - intensity * 0.2;

        const absNx = Math.abs(nx);
        const absNy = Math.abs(ny);
        const absNz = Math.abs(nz);

        if (absNy >= absNx && absNy >= absNz) {
          this.targetScale.set(squashScale, stretchScale, squashScale);
        } else if (absNx >= absNy && absNx >= absNz) {
          this.targetScale.set(stretchScale, squashScale, squashScale);
        } else {
          this.targetScale.set(squashScale, squashScale, stretchScale);
        }
      }

      // Reset target back to (1,1,1) after 80ms
      setTimeout(() => {
        this.targetScale.set(1, 1, 1);
      }, 80);

      // 3. TRIGGER INERTIAL WOBBLE
      this.wobbleAmplitude = intensity * 0.12;
      this.wobbleTime = 0;

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

    // Create tire geometry (cylinder) - MUST be updatable for vertex deformation
    const mesh = BABYLON.MeshBuilder.CreateCylinder(
      `tire_${Date.now()}`,
      {
        height: width,
        diameter: radius * 2,
        tessellation: 32,
        updatable: true, // Enable vertex manipulation
      },
      this.scene,
    );

    // Capture original vertex positions for deformation system
    // Safely handle test environments where VertexBuffer might not be available
    try {
      if (BABYLON.VertexBuffer && BABYLON.VertexBuffer.PositionKind) {
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        if (positions) {
          // Ensure Float32Array type
          const posArray = positions instanceof Float32Array ? positions : new Float32Array(positions);
          this.originalPositions = posArray.slice(); // deep copy
          this.deformedPositions = posArray.slice();
        }
      }
    } catch (error) {
      // Gracefully fallback if vertex data unavailable (test environment)
      console.warn('Vertex deformation system unavailable, using scale-only deformation');
    }

    // Orient tire so its axle points along Z (disk visible from +Z camera).
    // Rotating a Y-axis cylinder 90° around X makes the axis point along +Z,
    // so the tire stands upright and rolls in the X direction (downhill).
    mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
      new BABYLON.Vector3(1, 0, 0),
      Math.PI / 2,
    );

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
   * Uses a per-type material name so PhysicsManager can apply per-type restitution.
   */
  private createPhysicsBody(): CANNON.Body {
    const { radius, width, mass } = this.config.properties;
    // Use the shared material instance from PhysicsManager so the pre-registered
    // contact material pairs (tire_X ↔ ground) are actually matched by cannon-es.
    const tireMaterial = this.physicsManager.getTireMaterial(`tire_${this.config.type}`);

    const body = this.physicsManager.addTireBody(this.mesh, radius, width, mass, tireMaterial);

    // Apply per-type damping from TIRE_CONFIGS (addTireBody uses generic defaults).
    body.linearDamping  = this.config.properties.linearDamping;
    body.angularDamping = this.config.properties.angularDamping;

    // Never sleep: a tire rolling slowly down a gentle slope should not freeze.
    body.allowSleep = false;

    return body;
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

    // Rolling-without-slip angular velocity for a tire with axle along Z.
    // For motion in direction (vx, 0, vz): omega = (vz/r, 0, -vx/r)
    // This satisfies v_contact = v_center + omega × (-r_y) = 0 at the ground.
    const radius = this.config.properties.radius;
    this.body.angularVelocity.set(
      velocity.z / radius,
      0,
      -velocity.x / radius,
    );

    this.isLaunched = true;
    this.launchTime = performance.now();

    console.log(`🚀 Tire launched with velocity: ${velocity.length().toFixed(2)} m/s`);
  }

  /**
   * Map a normalised speed value (0–1) to a Color4 trail hue.
   * Slow  → cool steel blue  (0.3, 0.6, 1.0)
   * Mid   → lime green       (0.3, 1.0, 0.3)
   * Fast  → hot orange/red   (1.0, 0.35, 0.0)
   * Alpha fades from 0 at the tail to 0.75 at the head.
   */
  private speedToTrailColor(speedNorm: number, alpha: number): BABYLON.Color4 {
    // Two-stop gradient: blue → orange
    const r = Math.min(1.0, speedNorm * 2.0);           // 0→0, 0.5→1, 1→1
    const g = speedNorm < 0.5
      ? speedNorm * 2.0                                   // 0→0, 0.5→1
      : 1.0 - (speedNorm - 0.5) * 2.0;                  // 0.5→1, 1→0
    const b = Math.max(0.0, 1.0 - speedNorm * 2.5);     // 0→1, 0.4→0
    return new BABYLON.Color4(r, g, b, alpha);
  }

  /**
   * Update trail effect with speed-based color gradient.
   */
  private updateTrail(): void {
    if (!this.isLaunched) return;

    const MAX_TRAIL = 50;
    const speed = this.getSpeed();
    const speedNorm = Math.min(speed / 22, 1.0); // 22 m/s ≈ full saturation

    this.trailPoints.push(this.mesh.position.clone());
    this.trailColors.push(this.speedToTrailColor(speedNorm, 0.8)); // head is opaque

    if (this.trailPoints.length > MAX_TRAIL) {
      this.trailPoints.shift();
      this.trailColors.shift();
    }

    if (this.trailPoints.length < 2) return;

    // Re-compute alpha gradient so the tail fades to transparent each frame
    const n = this.trailColors.length;
    const colorsCopy = this.trailColors.map((c, i) => {
      const alpha = (i / (n - 1)) * 0.75; // 0 at tail, 0.75 at head
      return new BABYLON.Color4(c.r, c.g, c.b, alpha);
    });

    if (!this.trail) {
      // First creation — must supply colors array and mark updatable
      this.trail = BABYLON.MeshBuilder.CreateLines(
        'trail',
        { points: this.trailPoints, colors: colorsCopy, updatable: true },
        this.scene,
      );
      this.trail.useVertexColors = true;
      this.trail.alpha = 1.0; // per-vertex alpha handles fade
    } else {
      BABYLON.MeshBuilder.CreateLines(
        'trail',
        { points: this.trailPoints, colors: colorsCopy, instance: this.trail },
        this.scene,
      );
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
  public update(deltaTime: number): void {
    if (!this.isLaunched) return;

    // Update trail
    this.updateTrail();

    // Check if tire has fallen off the map
    if (this.mesh.position.y < -50) {
      console.log('🌊 Tire fell off the map!');
      this.destroy();
    }

    // --- Rolling-without-slip maintenance ---
    // At launch the angular velocity satisfies omega = v/r exactly, but after the
    // first bounce or terrain irregularity cannon-es friction alone cannot maintain
    // the constraint.  Apply a soft per-frame correction (blend factor 0.2) that
    // steers omega toward the no-slip target without fighting the solver abruptly.
    // The tire axle is along world Z (rotationQuaternion = Rx(PI/2)), so:
    //   omega_x = vz / r   (rolling in Z direction)
    //   omega_z = -vx / r  (rolling in X direction)
    if (this.isLaunched) {
      const radius = this.config.properties.radius;
      const vx = this.body.velocity.x;
      const vz = this.body.velocity.z;
      const blend = 0.2; // soft correction — doesn't fight the solver
      this.body.angularVelocity.x += (vz / radius - this.body.angularVelocity.x) * blend;
      this.body.angularVelocity.z += (-vx / radius - this.body.angularVelocity.z) * blend;
      // Lateral yaw damping: suppress spinning around the vertical axis (tire drifting
      // sideways like a coin wobbling).  0.85 per frame ≈ 97% removed per second at 60fps.
      this.body.angularVelocity.y *= 0.85;
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

    // Squash-and-stretch: spring currentScale toward targetScale each frame
    const lerpFactor = Math.min(this.SCALE_SPRING * deltaTime, 1);
    this.currentScale.x = this.currentScale.x * (1 - lerpFactor) + this.targetScale.x * lerpFactor;
    this.currentScale.y = this.currentScale.y * (1 - lerpFactor) + this.targetScale.y * lerpFactor;
    this.currentScale.z = this.currentScale.z * (1 - lerpFactor) + this.targetScale.z * lerpFactor;

    // Apply inertial wobble (jello-jiggle after impact)
    let wobbleScale = 1.0;
    if (this.wobbleAmplitude > 0.002) {
      this.wobbleTime += deltaTime;
      const decay = Math.exp(-this.wobbleTime * 4);
      wobbleScale = 1 + Math.sin(this.wobbleTime * 18) * this.wobbleAmplitude * decay;

      // Reset wobble when amplitude becomes negligible
      if (this.wobbleAmplitude * decay < 0.002) {
        this.wobbleAmplitude = 0;
        this.wobbleTime = 0;
      }
    }

    // Combine base scale with wobble
    this.mesh.scaling.set(
      this.currentScale.x * wobbleScale,
      this.currentScale.y * wobbleScale,
      this.currentScale.z * wobbleScale,
    );

    // Restore vertex deformation back to original shape
    this.restoreVertices(deltaTime);
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
    this.trailPoints = [];
    this.trailColors = [];

    console.log('🗑️ Tire destroyed');
  }
}
