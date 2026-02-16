import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';
import { PhysicsManager } from './PhysicsManager';

/**
 * Supported shape types for destructible objects.
 */
export enum DestructibleShape {
  CUBE = 'cube',
  CYLINDER = 'cylinder',
  PYRAMID = 'pyramid',
  SPHERE = 'sphere',
}

/**
 * Material archetype, defining PBR surface characteristics and point tier.
 */
export enum DestructibleMaterial {
  WOOD = 'wood',
  METAL = 'metal',
  GLASS = 'glass',
  STONE = 'stone',
  RUBBER = 'rubber',
  CRYSTAL = 'crystal',
}

/**
 * Configuration options accepted by the factory.
 * All fields are optional – the factory supplies sensible defaults when omitted.
 */
export interface DestructibleObjectOptions {
  shape?: DestructibleShape;
  material?: DestructibleMaterial;
  position?: BABYLON.Vector3;
  /** Uniform scale applied on top of the shape's base size. */
  scale?: number;
  /** Override the color derived from the material preset. */
  colorOverride?: BABYLON.Color3;
  /** Override the point value derived from the material preset. */
  pointsOverride?: number;
  /** Override the health value derived from the material preset. */
  healthOverride?: number;
  /** Unique name suffix; a timestamp is appended automatically. */
  nameSuffix?: string;
}

/**
 * A fully-constructed destructible object returned by the factory.
 * The caller is responsible for calling destroy() to free resources.
 */
export interface DestructibleObject {
  mesh: BABYLON.Mesh;
  body: CANNON.Body;
  health: number;
  maxHealth: number;
  points: number;
  breakForce: number;
  shape: DestructibleShape;
  material: DestructibleMaterial;
  /** Remove from physics, dispose mesh + material. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Internal preset tables
// ---------------------------------------------------------------------------

interface MaterialPreset {
  /** Base color used when no override is supplied. */
  baseColor: BABYLON.Color3;
  /** Accent / damage-state color. */
  accentColor: BABYLON.Color3;
  metallic: number;
  roughness: number;
  /** Whether to add a mild emissive glow. */
  emissive: boolean;
  emissiveColor: BABYLON.Color3;
  emissiveIntensity: number;
  /** Baseline health before scale modifier. */
  baseHealth: number;
  /** Baseline point value before scale modifier. */
  basePoints: number;
  /** Force threshold (N) needed to damage this material. */
  breakForce: number;
  /** Physics mass (kg) before scale modifier. */
  baseMass: number;
  /** Physics friction coefficient. */
  friction: number;
  /** Physics restitution coefficient. */
  restitution: number;
}

const MATERIAL_PRESETS: Record<DestructibleMaterial, MaterialPreset> = {
  [DestructibleMaterial.WOOD]: {
    baseColor: BABYLON.Color3.FromHexString('#8B5E3C'),
    accentColor: BABYLON.Color3.FromHexString('#5C3D1E'),
    metallic: 0.0,
    roughness: 0.9,
    emissive: false,
    emissiveColor: BABYLON.Color3.Black(),
    emissiveIntensity: 0,
    baseHealth: 80,
    basePoints: 50,
    breakForce: 40,
    baseMass: 8,
    friction: 0.7,
    restitution: 0.2,
  },
  [DestructibleMaterial.METAL]: {
    baseColor: BABYLON.Color3.FromHexString('#7A8FA6'),
    accentColor: BABYLON.Color3.FromHexString('#4A5568'),
    metallic: 0.85,
    roughness: 0.3,
    emissive: false,
    emissiveColor: BABYLON.Color3.Black(),
    emissiveIntensity: 0,
    baseHealth: 200,
    basePoints: 150,
    breakForce: 120,
    baseMass: 25,
    friction: 0.5,
    restitution: 0.4,
  },
  [DestructibleMaterial.GLASS]: {
    baseColor: BABYLON.Color3.FromHexString('#A8D8EA'),
    accentColor: BABYLON.Color3.FromHexString('#E8F8FF'),
    metallic: 0.0,
    roughness: 0.05,
    emissive: true,
    emissiveColor: BABYLON.Color3.FromHexString('#C8EEFF'),
    emissiveIntensity: 0.15,
    baseHealth: 30,
    basePoints: 200,
    breakForce: 15,
    baseMass: 4,
    friction: 0.2,
    restitution: 0.6,
  },
  [DestructibleMaterial.STONE]: {
    baseColor: BABYLON.Color3.FromHexString('#6B7280'),
    accentColor: BABYLON.Color3.FromHexString('#4B5563'),
    metallic: 0.0,
    roughness: 0.95,
    emissive: false,
    emissiveColor: BABYLON.Color3.Black(),
    emissiveIntensity: 0,
    baseHealth: 300,
    basePoints: 100,
    breakForce: 200,
    baseMass: 40,
    friction: 0.9,
    restitution: 0.15,
  },
  [DestructibleMaterial.RUBBER]: {
    baseColor: BABYLON.Color3.FromHexString('#1F2937'),
    accentColor: BABYLON.Color3.FromHexString('#374151'),
    metallic: 0.0,
    roughness: 0.85,
    emissive: false,
    emissiveColor: BABYLON.Color3.Black(),
    emissiveIntensity: 0,
    baseHealth: 60,
    basePoints: 75,
    breakForce: 30,
    baseMass: 6,
    friction: 1.1,
    restitution: 0.75,
  },
  [DestructibleMaterial.CRYSTAL]: {
    baseColor: BABYLON.Color3.FromHexString('#C084FC'),
    accentColor: BABYLON.Color3.FromHexString('#E879F9'),
    metallic: 0.1,
    roughness: 0.02,
    emissive: true,
    emissiveColor: BABYLON.Color3.FromHexString('#D946EF'),
    emissiveIntensity: 0.4,
    baseHealth: 40,
    basePoints: 350,
    breakForce: 20,
    baseMass: 5,
    friction: 0.15,
    restitution: 0.7,
  },
};

/**
 * Per-shape base dimensions (before scale is applied).
 * Used to drive both visual mesh options and physics body sizing.
 */
interface ShapeDimensions {
  /** Half-extents along X/Y/Z used for CANNON.Box. */
  physicsHalfExtents: BABYLON.Vector3;
}

const SHAPE_DIMENSIONS: Record<DestructibleShape, ShapeDimensions> = {
  [DestructibleShape.CUBE]: {
    physicsHalfExtents: new BABYLON.Vector3(0.5, 0.5, 0.5),
  },
  [DestructibleShape.CYLINDER]: {
    // Cylinder has radius 0.5, height 1 – bounding box half-extents match a cube
    physicsHalfExtents: new BABYLON.Vector3(0.5, 0.5, 0.5),
  },
  [DestructibleShape.PYRAMID]: {
    // Pyramid fits inside roughly the same bounding box as a cube
    physicsHalfExtents: new BABYLON.Vector3(0.5, 0.5, 0.5),
  },
  [DestructibleShape.SPHERE]: {
    physicsHalfExtents: new BABYLON.Vector3(0.5, 0.5, 0.5),
  },
};

// ---------------------------------------------------------------------------
// Factory class
// ---------------------------------------------------------------------------

/**
 * DestructibleObjectFactory
 *
 * Creates Babylon.js meshes with matching Cannon.js rigid bodies for every
 * destructible object type in TIRE CHAOS.  Supports four shapes and six
 * material archetypes, each with distinct PBR visual properties, health
 * values, point rewards, and physics characteristics.
 *
 * Usage:
 * ```ts
 * const factory = new DestructibleObjectFactory(scene, physicsManager);
 * const crate = factory.create({
 *   shape: DestructibleShape.CUBE,
 *   material: DestructibleMaterial.WOOD,
 *   position: new BABYLON.Vector3(5, 1, 0),
 *   scale: 1.5,
 * });
 * ```
 */
export class DestructibleObjectFactory {
  private scene: BABYLON.Scene;
  private physicsManager: PhysicsManager;
  private shadowGenerator?: BABYLON.ShadowGenerator;
  private createdObjects: DestructibleObject[] = [];

  constructor(
    scene: BABYLON.Scene,
    physicsManager: PhysicsManager,
    shadowGenerator?: BABYLON.ShadowGenerator,
  ) {
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.shadowGenerator = shadowGenerator;

    console.log('DestructibleObjectFactory initialized');
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Create a single destructible object and register it with the physics world.
   */
  public create(options: DestructibleObjectOptions = {}): DestructibleObject {
    const shape = options.shape ?? this.randomShape();
    const material = options.material ?? this.randomMaterial();
    const scale = Math.max(0.1, options.scale ?? 1.0);
    const position = options.position ?? BABYLON.Vector3.Zero();
    const timestamp = Date.now();
    const suffix = options.nameSuffix ? `_${options.nameSuffix}` : '';
    const baseName = `destructible_${shape}_${material}${suffix}_${timestamp}`;

    const preset = MATERIAL_PRESETS[material];

    // Derive stat values (scale influences health, points, mass quadratically)
    const scaleFactor = scale * scale;
    const health =
      options.healthOverride !== undefined
        ? options.healthOverride
        : Math.round(preset.baseHealth * scaleFactor);
    const points =
      options.pointsOverride !== undefined
        ? options.pointsOverride
        : Math.round(preset.basePoints / scale); // smaller = higher reward per hit
    const breakForce = preset.breakForce * scale;
    const mass = preset.baseMass * scaleFactor;
    const color = options.colorOverride ?? preset.baseColor;

    // Build visual mesh
    const mesh = this.buildMesh(baseName, shape, scale, color, preset);
    mesh.position.copyFrom(position);
    mesh.receiveShadows = true;

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(mesh);
    }

    // Build physics body
    const body = this.buildPhysicsBody(mesh, shape, scale, mass, preset);

    // Package result
    const destructible: DestructibleObject = {
      mesh,
      body,
      health,
      maxHealth: health,
      points,
      breakForce,
      shape,
      material,
      destroy: () => this.destroyObject(destructible),
    };

    this.createdObjects.push(destructible);

    return destructible;
  }

  /**
   * Convenience: spawn a cluster of objects arranged in a grid pattern.
   *
   * @param count  - number of objects to create
   * @param origin - world-space centre of the cluster
   * @param spread - spacing between objects along X and Z
   * @param options - base options applied to each object (shape/material may be
   *                  randomised per object if not supplied)
   */
  public createCluster(
    count: number,
    origin: BABYLON.Vector3,
    spread: number = 2.5,
    options: Omit<DestructibleObjectOptions, 'position'> = {},
  ): DestructibleObject[] {
    const results: DestructibleObject[] = [];
    const cols = Math.ceil(Math.sqrt(count));

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = origin.x + (col - (cols - 1) / 2) * spread;
      const z = origin.z + (row - Math.floor(count / cols) / 2) * spread;
      const position = new BABYLON.Vector3(x, origin.y, z);

      results.push(this.create({ ...options, position }));
    }

    return results;
  }

  /**
   * Create one object of each shape type at incrementing X positions, useful
   * for testing or showcasing the variety of object types.
   */
  public createShowcase(
    origin: BABYLON.Vector3,
    material: DestructibleMaterial = DestructibleMaterial.WOOD,
    spacing: number = 3,
  ): DestructibleObject[] {
    const shapes = Object.values(DestructibleShape);
    return shapes.map((shape, index) =>
      this.create({
        shape,
        material,
        position: new BABYLON.Vector3(origin.x + index * spacing, origin.y, origin.z),
        nameSuffix: `showcase_${index}`,
      }),
    );
  }

  /**
   * Destroy all objects created by this factory instance.
   */
  public destroyAll(): void {
    // Slice to avoid mutation during iteration
    [...this.createdObjects].forEach((obj) => obj.destroy());
    this.createdObjects = [];
    console.log('DestructibleObjectFactory: all objects destroyed');
  }

  /**
   * Return the number of live objects tracked by this factory.
   */
  public getLiveCount(): number {
    return this.createdObjects.length;
  }

  // -------------------------------------------------------------------------
  // Mesh builders
  // -------------------------------------------------------------------------

  private buildMesh(
    name: string,
    shape: DestructibleShape,
    scale: number,
    color: BABYLON.Color3,
    preset: MaterialPreset,
  ): BABYLON.Mesh {
    const mesh = this.createShapeMesh(name, shape, scale);
    mesh.material = this.createPBRMaterial(`${name}_mat`, color, preset);
    return mesh;
  }

  private createShapeMesh(name: string, shape: DestructibleShape, scale: number): BABYLON.Mesh {
    switch (shape) {
      case DestructibleShape.CUBE:
        return this.buildCube(name, scale);

      case DestructibleShape.CYLINDER:
        return this.buildCylinder(name, scale);

      case DestructibleShape.PYRAMID:
        return this.buildPyramid(name, scale);

      case DestructibleShape.SPHERE:
        return this.buildSphere(name, scale);

      default:
        // Fallback – should never be reached with a strict enum
        return this.buildCube(name, scale);
    }
  }

  /** Box – standard destructible crate / block. */
  private buildCube(name: string, scale: number): BABYLON.Mesh {
    // Vary dimensions slightly so cubes look distinct from each other
    const widthVariance = 0.8 + Math.random() * 0.4;
    const heightVariance = 0.8 + Math.random() * 0.6;

    return BABYLON.MeshBuilder.CreateBox(
      name,
      {
        width: scale * widthVariance,
        height: scale * heightVariance,
        depth: scale * widthVariance,
      },
      this.scene,
    );
  }

  /** Cylinder – barrel / column shape. */
  private buildCylinder(name: string, scale: number): BABYLON.Mesh {
    return BABYLON.MeshBuilder.CreateCylinder(
      name,
      {
        diameter: scale,
        height: scale * 1.4,
        tessellation: 18,
        cap: BABYLON.Mesh.CAP_ALL,
      },
      this.scene,
    );
  }

  /**
   * Pyramid – approximated with a cone (zero top radius) since Babylon.js
   * does not have a dedicated pyramid primitive. Tessellation = 4 gives a
   * perfect square pyramid.
   */
  private buildPyramid(name: string, scale: number): BABYLON.Mesh {
    return BABYLON.MeshBuilder.CreateCylinder(
      name,
      {
        diameterTop: 0,
        diameterBottom: scale * 1.2,
        height: scale * 1.5,
        tessellation: 4, // 4-sided = pyramid
        cap: BABYLON.Mesh.CAP_START,
      },
      this.scene,
    );
  }

  /** Sphere – ball / boulder shape. */
  private buildSphere(name: string, scale: number): BABYLON.Mesh {
    return BABYLON.MeshBuilder.CreateSphere(
      name,
      {
        diameter: scale,
        segments: 16,
      },
      this.scene,
    );
  }

  // -------------------------------------------------------------------------
  // Material builder
  // -------------------------------------------------------------------------

  private createPBRMaterial(
    name: string,
    color: BABYLON.Color3,
    preset: MaterialPreset,
  ): BABYLON.PBRMetallicRoughnessMaterial {
    const mat = new BABYLON.PBRMetallicRoughnessMaterial(name, this.scene);

    mat.baseColor = color;
    mat.metallic = preset.metallic;
    mat.roughness = preset.roughness;

    if (preset.emissive) {
      mat.emissiveColor = preset.emissiveColor.scale(preset.emissiveIntensity);
    }

    return mat;
  }

  // -------------------------------------------------------------------------
  // Physics body builder
  // -------------------------------------------------------------------------

  private buildPhysicsBody(
    mesh: BABYLON.Mesh,
    shape: DestructibleShape,
    scale: number,
    mass: number,
    preset: MaterialPreset,
  ): CANNON.Body {
    const dims = SHAPE_DIMENSIONS[shape];
    const hx = dims.physicsHalfExtents.x * scale;
    const hy = dims.physicsHalfExtents.y * scale;
    const hz = dims.physicsHalfExtents.z * scale;

    // Spheres get a CANNON.Sphere for accurate rolling; everything else uses Box
    let cannonShape: CANNON.Shape;
    if (shape === DestructibleShape.SPHERE) {
      cannonShape = new CANNON.Sphere(hx);
    } else {
      cannonShape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));
    }

    const cannonMaterial = new CANNON.Material(`mat_${shape}`);
    cannonMaterial.friction = preset.friction;
    cannonMaterial.restitution = preset.restitution;

    const body = new CANNON.Body({
      mass,
      shape: cannonShape,
      material: cannonMaterial,
      linearDamping: 0.35,
      angularDamping: 0.35,
    });

    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);

    this.physicsManager.world.addBody(body);

    return body;
  }

  // -------------------------------------------------------------------------
  // Lifecycle helpers
  // -------------------------------------------------------------------------

  private destroyObject(obj: DestructibleObject): void {
    // Remove physics body
    try {
      this.physicsManager.world.removeBody(obj.body);
    } catch {
      // Body may already have been removed by PhysicsManager's own destruction path
    }

    // Dispose material and mesh
    if (obj.mesh.material) {
      obj.mesh.material.dispose();
    }
    obj.mesh.dispose();

    // Untrack
    const idx = this.createdObjects.indexOf(obj);
    if (idx !== -1) {
      this.createdObjects.splice(idx, 1);
    }
  }

  // -------------------------------------------------------------------------
  // Randomisation helpers
  // -------------------------------------------------------------------------

  private randomShape(): DestructibleShape {
    const shapes = Object.values(DestructibleShape);
    return shapes[Math.floor(Math.random() * shapes.length)];
  }

  private randomMaterial(): DestructibleMaterial {
    const materials = Object.values(DestructibleMaterial);
    return materials[Math.floor(Math.random() * materials.length)];
  }

  // -------------------------------------------------------------------------
  // Static utility – palette helpers
  // -------------------------------------------------------------------------

  /**
   * Return the default color for a given material archetype.
   * Useful when callers want to tint UI indicators to match spawned objects.
   */
  public static getMaterialColor(material: DestructibleMaterial): BABYLON.Color3 {
    return MATERIAL_PRESETS[material].baseColor;
  }

  /**
   * Return the base point value for a material archetype at scale 1.
   */
  public static getMaterialBasePoints(material: DestructibleMaterial): number {
    return MATERIAL_PRESETS[material].basePoints;
  }

  /**
   * Return the base health value for a material archetype at scale 1.
   */
  public static getMaterialBaseHealth(material: DestructibleMaterial): number {
    return MATERIAL_PRESETS[material].baseHealth;
  }
}
