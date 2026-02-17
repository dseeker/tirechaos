import * as CANNON from 'cannon-es';
import * as BABYLON from '@babylonjs/core';
import { DEFAULT_PHYSICS_CONFIG, PhysicsConfig } from '../types';

/**
 * PhysicsManager - Handles all physics simulation using Cannon.js
 * Now compatible with Babylon.js meshes
 */
export class PhysicsManager {
  public world: CANNON.World;
  public timeScale: number = 1.0;
  private config: PhysicsConfig;
  private bodies: Map<BABYLON.Mesh, CANNON.Body> = new Map();
  private destructibleObjects: Map<
    CANNON.Body,
    { mesh: BABYLON.Mesh; health: number; points: number }
  > = new Map();

  constructor(config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG) {
    this.config = config;

    // Initialize Cannon.js world
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, config.gravity, 0),
    });

    // Configure solver for better performance
    // @ts-ignore - iterations property exists at runtime
    this.world.solver.iterations = config.solverIterations;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    // Setup default contact materials
    this.setupContactMaterials();

    console.log('⚙️ Physics engine initialized');
  }

  /**
   * Setup contact materials for different surface interactions
   */
  private setupContactMaterials(): void {
    // Default material
    const defaultMaterial = new CANNON.Material('default');

    // Ground material (shared reference used for all tire-ground contacts)
    const groundMaterial = new CANNON.Material('ground');

    // Generic fallback tire material
    const tireMaterial = new CANNON.Material('tire');
    const tireGroundContact = new CANNON.ContactMaterial(tireMaterial, groundMaterial, {
      friction: 0.8,
      restitution: 0.3,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
    });
    this.world.addContactMaterial(tireGroundContact);

    // Per-tire-type contact materials with distinct restitution values.
    // Material names match the `tire_${TireType}` pattern used in Tire.createPhysicsBody().
    const perTypeMaterials: Array<{ name: string; friction: number; restitution: number }> = [
      { name: 'tire_standard',      friction: 0.8,  restitution: 0.4  },
      { name: 'tire_monster_truck', friction: 0.9,  restitution: 0.2  },
      { name: 'tire_racing_slick',  friction: 0.95, restitution: 0.35 },
      { name: 'tire_tractor',       friction: 1.0,  restitution: 0.15 },
      { name: 'tire_spare',         friction: 0.6,  restitution: 0.8  },
    ];

    perTypeMaterials.forEach(({ name, friction, restitution }) => {
      const mat = new CANNON.Material(name);
      const contact = new CANNON.ContactMaterial(mat, groundMaterial, {
        friction,
        restitution,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3,
      });
      this.world.addContactMaterial(contact);
    });

    // Default contact
    const defaultContact = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
      friction: 0.5,
      restitution: 0.3,
    });
    this.world.addContactMaterial(defaultContact);
  }

  /**
   * Add a ground plane to the physics world
   */
  public addGroundPlane(mesh: BABYLON.Mesh): CANNON.Body {
    // Get dimensions from bounding box
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.boundingBox.extendSize;

    const shape = new CANNON.Box(
      new CANNON.Vec3(
        size.x * Math.abs(mesh.scaling.x),
        size.y * Math.abs(mesh.scaling.y),
        size.z * Math.abs(mesh.scaling.z),
      ),
    );

    const body = new CANNON.Body({
      mass: 0, // Static body
      shape: shape,
      material: new CANNON.Material('ground'),
    });

    // Match mesh position and rotation (Babylon uses same format)
    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(
      mesh.rotationQuaternion?.x || 0,
      mesh.rotationQuaternion?.y || 0,
      mesh.rotationQuaternion?.z || 0,
      mesh.rotationQuaternion?.w || 1,
    );

    this.world.addBody(body);
    this.bodies.set(mesh, body);

    return body;
  }

  /**
   * Add a destructible object to physics world
   */
  public addDestructibleObject(
    mesh: BABYLON.Mesh,
    config: { mass: number; health: number; points: number },
  ): CANNON.Body {
    // Get dimensions from bounding box
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.boundingBox.extendSize;

    const shape = new CANNON.Box(
      new CANNON.Vec3(
        size.x * Math.abs(mesh.scaling.x),
        size.y * Math.abs(mesh.scaling.y),
        size.z * Math.abs(mesh.scaling.z),
      ),
    );

    const body = new CANNON.Body({
      mass: config.mass,
      shape: shape,
      linearDamping: 0.3,
      angularDamping: 0.3,
    });

    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(
      mesh.rotationQuaternion?.x || 0,
      mesh.rotationQuaternion?.y || 0,
      mesh.rotationQuaternion?.z || 0,
      mesh.rotationQuaternion?.w || 1,
    );

    this.world.addBody(body);
    this.bodies.set(mesh, body);
    this.destructibleObjects.set(body, {
      mesh: mesh,
      health: config.health,
      points: config.points,
    });

    return body;
  }

  /**
   * Add a tire body to physics world
   */
  public addTireBody(
    mesh: BABYLON.Mesh,
    radius: number,
    width: number,
    mass: number,
    material?: CANNON.Material,
  ): CANNON.Body {
    // Use cylinder shape for tire
    const shape = new CANNON.Cylinder(radius, radius, width, 16);

    const body = new CANNON.Body({
      mass: mass,
      shape: shape,
      material: material || new CANNON.Material('tire'),
      linearDamping: 0.1,
      angularDamping: 0.05,
    });

    // Rotate cylinder to be oriented like a wheel (around Z axis)
    const quaternion = new CANNON.Quaternion();
    quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
    shape.transformAllPoints(new CANNON.Vec3(), quaternion);

    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(
      mesh.rotationQuaternion?.x || 0,
      mesh.rotationQuaternion?.y || 0,
      mesh.rotationQuaternion?.z || 0,
      mesh.rotationQuaternion?.w || 1,
    );

    this.world.addBody(body);
    this.bodies.set(mesh, body);

    return body;
  }

  /**
   * Check for collisions and apply damage
   */
  private checkCollisions(): void {
    // Cannon.js handles collisions automatically
    // We can listen to collision events if needed
    this.world.bodies.forEach((body) => {
      if (body.sleepState === CANNON.Body.SLEEPING) {
        return;
      }

      // Check if body has high velocity collision
      const speed = body.velocity.length();
      if (speed > 5) {
        // High speed - potential for destruction
        const obj = this.destructibleObjects.get(body);
        if (obj) {
          // Damage calculation based on impact force
          const damage = speed * 2;
          obj.health -= damage;

          if (obj.health <= 0) {
            this.destroyObject(body, obj.mesh);
          }
        }
      }
    });
  }

  /**
   * Destroy an object (remove from physics and scene)
   */
  private destroyObject(body: CANNON.Body, mesh: BABYLON.Mesh): void {
    const obj = this.destructibleObjects.get(body);
    if (!obj) return;

    // Emit destruction event (GameManager will handle scoring)
    const event = new CustomEvent('objectDestroyed', {
      detail: { points: obj.points, position: mesh.position },
    });
    window.dispatchEvent(event);

    // Remove from physics
    this.world.removeBody(body);
    this.bodies.delete(mesh);
    this.destructibleObjects.delete(body);

    // Remove from scene (GameManager handles this)
    mesh.setEnabled(false);

    console.log(`💥 Object destroyed! +${obj.points} points`);
  }

  /**
   * Get physics body for a mesh
   */
  public getBody(mesh: BABYLON.Mesh): CANNON.Body | undefined {
    return this.bodies.get(mesh);
  }

  /**
   * Sync all physics bodies with their meshes
   */
  private syncBodies(): void {
    this.bodies.forEach((body, mesh) => {
      // Copy position from physics to mesh
      mesh.position.set(body.position.x, body.position.y, body.position.z);

      // Babylon uses rotationQuaternion for physics sync
      if (!mesh.rotationQuaternion) {
        mesh.rotationQuaternion = new BABYLON.Quaternion();
      }
      mesh.rotationQuaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      );
    });
  }

  /**
   * Update physics simulation
   */
  public update(deltaTime: number): void {
    // Step physics simulation — apply timeScale for slow-motion support
    const scaledDelta = deltaTime * this.timeScale;
    const timeStep = Math.min(scaledDelta, this.config.timeStep);
    this.world.step(this.config.timeStep, timeStep, this.config.maxSubSteps);

    // Sync visual meshes with physics bodies
    this.syncBodies();

    // Check for collisions/destruction
    this.checkCollisions();
  }

  /**
   * Clear all physics bodies
   */
  public clear(): void {
    // Remove all bodies
    const bodiesToRemove = [...this.world.bodies];
    bodiesToRemove.forEach((body) => {
      this.world.removeBody(body);
    });

    this.bodies.clear();
    this.destructibleObjects.clear();

    console.log('🧹 Physics world cleared');
  }

  /**
   * Get all destructible objects
   */
  public getDestructibleObjects(): Array<{ mesh: BABYLON.Mesh; health: number; points: number }> {
    return Array.from(this.destructibleObjects.values());
  }

  /**
   * Apply force to a body
   */
  public applyForce(mesh: BABYLON.Mesh, force: CANNON.Vec3, worldPoint?: CANNON.Vec3): void {
    const body = this.bodies.get(mesh);
    if (body) {
      body.applyForce(force, worldPoint || body.position);
    }
  }

  /**
   * Apply impulse to a body
   */
  public applyImpulse(mesh: BABYLON.Mesh, impulse: CANNON.Vec3, worldPoint?: CANNON.Vec3): void {
    const body = this.bodies.get(mesh);
    if (body) {
      body.applyImpulse(impulse, worldPoint || body.position);
    }
  }

  /**
   * Set velocity of a body
   */
  public setVelocity(mesh: BABYLON.Mesh, velocity: CANNON.Vec3): void {
    const body = this.bodies.get(mesh);
    if (body) {
      body.velocity.copy(velocity);
    }
  }
}
