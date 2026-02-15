import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { DEFAULT_PHYSICS_CONFIG, PhysicsConfig } from '../types';

/**
 * PhysicsManager - Handles all physics simulation using Cannon.js
 */
export class PhysicsManager {
  public world: CANNON.World;
  private config: PhysicsConfig;
  private bodies: Map<THREE.Mesh, CANNON.Body> = new Map();
  private destructibleObjects: Map<
    CANNON.Body,
    { mesh: THREE.Mesh; health: number; points: number }
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

    // Tire material
    const tireMaterial = new CANNON.Material('tire');

    // Ground material
    const groundMaterial = new CANNON.Material('ground');

    // Tire-Ground contact
    const tireGroundContact = new CANNON.ContactMaterial(tireMaterial, groundMaterial, {
      friction: 0.8,
      restitution: 0.3,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
    });
    this.world.addContactMaterial(tireGroundContact);

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
  public addGroundPlane(mesh: THREE.Mesh): CANNON.Body {
    const shape = new CANNON.Box(
      new CANNON.Vec3(
        (mesh.geometry as THREE.BoxGeometry).parameters.width / 2,
        (mesh.geometry as THREE.BoxGeometry).parameters.height / 2,
        (mesh.geometry as THREE.BoxGeometry).parameters.depth / 2,
      ),
    );

    const body = new CANNON.Body({
      mass: 0, // Static body
      shape: shape,
      material: new CANNON.Material('ground'),
    });

    // Match mesh position and rotation
    body.position.copy(mesh.position as any);
    body.quaternion.copy(mesh.quaternion as any);

    this.world.addBody(body);
    this.bodies.set(mesh, body);

    return body;
  }

  /**
   * Add a destructible object to physics world
   */
  public addDestructibleObject(
    mesh: THREE.Mesh,
    config: { mass: number; health: number; points: number },
  ): CANNON.Body {
    const geometry = mesh.geometry as THREE.BoxGeometry;
    const shape = new CANNON.Box(
      new CANNON.Vec3(
        geometry.parameters.width / 2,
        geometry.parameters.height / 2,
        geometry.parameters.depth / 2,
      ),
    );

    const body = new CANNON.Body({
      mass: config.mass,
      shape: shape,
      linearDamping: 0.3,
      angularDamping: 0.3,
    });

    body.position.copy(mesh.position as any);
    body.quaternion.copy(mesh.quaternion as any);

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
    mesh: THREE.Mesh,
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

    body.position.copy(mesh.position as any);
    body.quaternion.copy(mesh.quaternion as any);

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
  private destroyObject(body: CANNON.Body, mesh: THREE.Mesh): void {
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
    mesh.visible = false;

    console.log(`💥 Object destroyed! +${obj.points} points`);
  }

  /**
   * Get physics body for a mesh
   */
  public getBody(mesh: THREE.Mesh): CANNON.Body | undefined {
    return this.bodies.get(mesh);
  }

  /**
   * Sync all physics bodies with their meshes
   */
  private syncBodies(): void {
    this.bodies.forEach((body, mesh) => {
      // Copy position from physics to mesh
      mesh.position.copy(body.position as any);
      mesh.quaternion.copy(body.quaternion as any);
    });
  }

  /**
   * Update physics simulation
   */
  public update(deltaTime: number): void {
    // Step physics simulation
    const timeStep = Math.min(deltaTime, this.config.timeStep);
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
  public getDestructibleObjects(): Array<{ mesh: THREE.Mesh; health: number; points: number }> {
    return Array.from(this.destructibleObjects.values());
  }

  /**
   * Apply force to a body
   */
  public applyForce(mesh: THREE.Mesh, force: CANNON.Vec3, worldPoint?: CANNON.Vec3): void {
    const body = this.bodies.get(mesh);
    if (body) {
      body.applyForce(force, worldPoint || body.position);
    }
  }

  /**
   * Apply impulse to a body
   */
  public applyImpulse(mesh: THREE.Mesh, impulse: CANNON.Vec3, worldPoint?: CANNON.Vec3): void {
    const body = this.bodies.get(mesh);
    if (body) {
      body.applyImpulse(impulse, worldPoint || body.position);
    }
  }

  /**
   * Set velocity of a body
   */
  public setVelocity(mesh: THREE.Mesh, velocity: CANNON.Vec3): void {
    const body = this.bodies.get(mesh);
    if (body) {
      body.velocity.copy(velocity);
    }
  }
}
