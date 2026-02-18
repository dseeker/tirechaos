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

  // Shared material instances — contact materials are matched by object identity,
  // so all bodies that should interact must reference the same instances.
  private groundMaterial!: CANNON.Material;
  private tireMaterialMap: Map<string, CANNON.Material> = new Map();

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
    // Store on class so all bodies can reference the SAME instances.
    // cannon-es matches ContactMaterial pairs by material.id (object identity),
    // NOT by the name string.
    this.groundMaterial = new CANNON.Material('ground');

    // Generic fallback tire material
    const tireMaterial = new CANNON.Material('tire');
    this.tireMaterialMap.set('tire', tireMaterial);
    this.world.addContactMaterial(new CANNON.ContactMaterial(tireMaterial, this.groundMaterial, {
      friction: 0.8,
      restitution: 0.3,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
    }));

    // Per-tire-type contact materials.
    // Values must match TIRE_CONFIGS in src/types/index.ts — friction and
    // restitution are the single source of truth for each tire type.
    const perTypeMaterials: Array<{ name: string; friction: number; restitution: number }> = [
      { name: 'tire_standard',      friction: 0.8,  restitution: 0.3  },
      { name: 'tire_monster_truck', friction: 0.9,  restitution: 0.2  },
      { name: 'tire_racing_slick',  friction: 1.0,  restitution: 0.1  },
      { name: 'tire_tractor',       friction: 1.2,  restitution: 0.15 },
      { name: 'tire_spare',         friction: 0.6,  restitution: 0.6  },
    ];

    perTypeMaterials.forEach(({ name, friction, restitution }) => {
      const mat = new CANNON.Material(name);
      this.tireMaterialMap.set(name, mat);
      this.world.addContactMaterial(new CANNON.ContactMaterial(mat, this.groundMaterial, {
        friction,
        restitution,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3,
      }));
    });

    // Default contact
    const defaultMaterial = new CANNON.Material('default');
    this.world.addContactMaterial(new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
      friction: 0.5,
      restitution: 0.3,
    }));
  }

  /**
   * Return the shared CANNON.Material for a given tire type name (e.g. 'tire_standard').
   * Falls back to the generic 'tire' material if the type isn't registered.
   * Tire bodies MUST use these instances so that contact materials fire correctly.
   */
  public getTireMaterial(name: string): CANNON.Material {
    return this.tireMaterialMap.get(name) ?? this.tireMaterialMap.get('tire')!;
  }

  /**
   * Add a heightfield terrain body to the physics world.
   * @param heights 2D array [xi][zi] of Y values
   * @param elementSize World-unit spacing between height samples
   * @param offsetX World X position of the first column (xi=0)
   * @param offsetZ World Z position of the first row   (zi=0)
   */
  public addTerrainBody(
    heights: number[][],
    elementSize: number,
    offsetX: number,
    offsetZ: number,
    baseY: number = 0,
  ): CANNON.Body {
    const shape = new CANNON.Heightfield(heights, { elementSize });

    const body = new CANNON.Body({ mass: 0, material: this.groundMaterial });
    body.addShape(shape);

    // Heightfield local origin is at its first sample (xi=0, zi=0).
    // Translate by the world offset + baseY so it aligns with the Babylon mesh.
    body.position.set(offsetX, baseY, offsetZ);

    // CANNON.Heightfield is oriented in the local XZ plane but Cannon's Y is up.
    // A 90° rotation around the X axis is NOT needed — the shape already uses
    // X for columns and Z for rows.  We only need the body to sit at the right Y.
    this.world.addBody(body);
    return body;
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
      material: this.groundMaterial,
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
    // 20 segments gives a much smoother cylinder than 16, reducing the "ticking"
    // artefact on flat terrain caused by flat polygon faces contacting the surface.
    const shape = new CANNON.Cylinder(radius, radius, width, 20);

    const body = new CANNON.Body({
      mass: mass,
      shape: shape,
      material: material || this.tireMaterialMap.get('tire')!,
      linearDamping: 0.1,
      angularDamping: 0.05,
    });

    // Do NOT bake the rotation into the shape vertices.
    // Instead, set the body's initial quaternion to Rx(90°) so the Y-axis
    // cylinder is rotated to have its axis along Z in world space.
    // This matches the Babylon mesh which also uses rotationQuaternion Rx(90°).
    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(
      mesh.rotationQuaternion?.x ?? 0,
      mesh.rotationQuaternion?.y ?? 0,
      mesh.rotationQuaternion?.z ?? 0,
      mesh.rotationQuaternion?.w ?? 1,
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
    // Pass scaledDelta (uncapped) as timeSinceLastCall so cannon-es can subdivide
    // slow frames into multiple sub-steps.  Capping it was causing physics to run
    // in slow motion at <60fps.  maxSubSteps caps the total work per frame.
    this.world.step(this.config.timeStep, scaledDelta, this.config.maxSubSteps);

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
