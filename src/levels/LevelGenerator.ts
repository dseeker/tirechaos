import * as BABYLON from '@babylonjs/core';
import { DestructibleObjectFactory, DestructibleShape, DestructibleMaterial } from '../systems/DestructibleObjectFactory';
import { EnvironmentManager } from '../systems/EnvironmentManager';
import { PhysicsManager } from '../systems/PhysicsManager';

// ---------------------------------------------------------------------------
// Terrain constants (shared across all levels)
// ---------------------------------------------------------------------------

/** World X coordinate where the terrain starts (left/launch edge). */
const TERRAIN_ORIGIN_X = -25;
/** World Z coordinate where the terrain starts (front edge). */
const TERRAIN_ORIGIN_Z = -20;
/** Total world-unit width of the terrain in X (rolling direction). */
const TERRAIN_WIDTH = 80;
/** Total world-unit depth of the terrain in Z (side to side). */
const TERRAIN_DEPTH = 40;
/** Grid subdivisions in X (vertices = TERRAIN_SUBDIV_X + 1). */
const TERRAIN_SUBDIV_X = 80;
/** Grid subdivisions in Z (vertices = TERRAIN_SUBDIV_Z + 1). */
const TERRAIN_SUBDIV_Z = 40;
/** World-unit spacing between adjacent height samples (square grid). */
const TERRAIN_ELEMENT_SIZE = 1.0; // = TERRAIN_WIDTH / TERRAIN_SUBDIV_X
/** Y coordinate used as the lowest point of the terrain. */
const TERRAIN_BASE_Y = -8;
/** X position of the hilltop where tires are released. */
const HILL_PEAK_X = -12;

// ---------------------------------------------------------------------------
// Procedural terrain height function
// ---------------------------------------------------------------------------

/**
 * Returns the height (relative to TERRAIN_BASE_Y) for a given world (x, z).
 * The height is composed of:
 *   1. A downhill slope that makes the terrain fall away in the +X direction.
 *   2. A Gaussian bump at the launch end to create a distinct hilltop.
 *   3. Octave sine/cosine bumps scaled by the per-level seed for variety.
 *
 * @param worldX  World X coordinate.
 * @param worldZ  World Z coordinate.
 * @param seed    Per-level seed value (rounds use 1–5).
 * @returns       Height above TERRAIN_BASE_Y.  Always >= 0.
 */
export function terrainHeightAt(worldX: number, worldZ: number, seed: number): number {
  // 1. Primary slope: decreases linearly toward positive X
  const slope = Math.max(0, (HILL_PEAK_X - worldX + 28) * 0.32);

  // 2. Gaussian hill at the launch area to give a clear "top of hill" feel
  const hill = 7 * Math.exp(-((worldX - HILL_PEAK_X) ** 2) / 180);

  // 3. Procedural bumps – different per level via seed
  const s = seed * 2.71828;
  const b1 = 2.2 * Math.sin(worldX * 0.17 + s) * Math.cos(worldZ * 0.21 + s * 0.8);
  const b2 = 1.4 * Math.sin(worldX * 0.31 + s * 1.6) * Math.sin(worldZ * 0.33 + s * 1.4);
  const b3 = 0.7 * Math.cos(worldX * 0.52 + s * 0.9) * Math.cos(worldZ * 0.55 + s * 2.2);
  const b4 = 0.4 * Math.sin(worldX * 0.8 + s * 2.5) * Math.cos(worldZ * 0.7 + s * 1.1);

  return Math.max(0, slope + hill + b1 + b2 + b3 + b4);
}

/**
 * Returns the world-Y position of the terrain surface at (worldX, worldZ).
 */
export function terrainSurfaceY(worldX: number, worldZ: number, seed: number): number {
  return TERRAIN_BASE_Y + terrainHeightAt(worldX, worldZ, seed);
}

// ---------------------------------------------------------------------------
// Level configuration types
// ---------------------------------------------------------------------------

/**
 * Describes a single destructible object to spawn at level load time.
 * Y position is computed from the terrain surface at (x, z); the value in
 * `position.y` is treated as an additional vertical offset above the surface.
 */
export interface LevelObjectSpawn {
  shape: DestructibleShape;
  material: DestructibleMaterial;
  /** x and z determine world placement; y is an extra offset above terrain. */
  position: BABYLON.Vector3;
  scale?: number;
}

/**
 * Describes an environment prop placement.
 */
export interface LevelPropSpawn {
  type: 'barrier' | 'ramp' | 'post' | 'box';
  position: BABYLON.Vector3;
  rotation?: BABYLON.Vector3;
  scale?: BABYLON.Vector3;
  /** Only used for box props – overrides the default crate colour. */
  color?: BABYLON.Color3;
}

/**
 * Full configuration returned by getLevelLayout for a given round.
 * GameManager consumes this to set up the scene.
 */
export interface LevelLayout {
  /** Human-readable name shown in the HUD. */
  name: string;
  /** Short flavour description for the round-start splash. */
  description: string;
  /** 1–5 */
  roundNumber: number;
  /**
   * Seed value for the procedural terrain generator.
   * Different seeds produce different hill shapes and bump patterns.
   */
  terrainSeed: number;
  /** Tires the player gets this round (fed into RoundManager). */
  tiresAvailable: number;
  /** Score needed to pass the round. */
  targetScore: number;
  /** Seconds allowed. */
  timeLimit: number;
  /** Objects that must be placed by the factory. */
  objects: LevelObjectSpawn[];
  /** Environment props to place via EnvironmentManager. */
  props: LevelPropSpawn[];
  /**
   * XZ launch position for the tire at the top of the hill.
   * Y is automatically computed from the terrain + tire radius.
   */
  launchPosition: BABYLON.Vector3;
  /** Sky / ambient colour for this level (RGBA). */
  skyColor: BABYLON.Color4;
  /** Base colour tint for the terrain PBR material. */
  groundLightColor: BABYLON.Color3;
}

// ---------------------------------------------------------------------------
// Helper – shorthand constructors
// ---------------------------------------------------------------------------

function vec3(x: number, y: number, z: number): BABYLON.Vector3 {
  return new BABYLON.Vector3(x, y, z);
}

function color3(r: number, g: number, b: number): BABYLON.Color3 {
  return new BABYLON.Color3(r, g, b);
}

function color4(r: number, g: number, b: number, a: number): BABYLON.Color4 {
  return new BABYLON.Color4(r, g, b, a);
}

// ---------------------------------------------------------------------------
// Individual level definitions
// ---------------------------------------------------------------------------

/**
 * Level 1 – Gentle Slope
 * A calm introduction.  Objects sit in a loose scatter on the lower slope.
 * Terrain seed 1 gives gentle, predictable bumps.
 */
function buildLevel1(): LevelLayout {
  const seed = 1;

  // Object x,z positions on the downhill terrain; y = extra offset above surface
  const objects: LevelObjectSpawn[] = [
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD,   position: vec3( 0,  0, 0),   scale: 1.2 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD,   position: vec3( 4,  0, 1),   scale: 1.2 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD,   position: vec3( 8,  0, -1),  scale: 1.2 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER, position: vec3(-2,  0, 3),   scale: 1.0 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER, position: vec3( 5,  0, -3),  scale: 1.0 },
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.GLASS,  position: vec3(12,  0, 0),   scale: 1.0 },
  ];

  const props: LevelPropSpawn[] = [
    // Side guide rails so the tire doesn't roll off the edges
    { type: 'barrier', position: vec3(15, 0, -18), rotation: vec3(0, 0, 0), scale: vec3(80, 2, 1) },
    { type: 'barrier', position: vec3(15, 0,  18), rotation: vec3(0, 0, 0), scale: vec3(80, 2, 1) },
    // A couple of guide posts at the hilltop
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0, -4) },
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0,  4) },
  ];

  return {
    name: 'Gentle Slope',
    description: 'Roll the tire downhill and knock over the wooden blocks!',
    roundNumber: 1,
    terrainSeed: seed,
    tiresAvailable: 5,
    targetScore: 1000,
    timeLimit: 90,
    objects,
    props,
    // Tire released from hilltop; Y is computed at runtime from terrain
    launchPosition: vec3(HILL_PEAK_X, 0, 0),
    skyColor: color4(0.53, 0.81, 0.92, 1.0),
    groundLightColor: color3(0.36, 0.55, 0.24),
  };
}

/**
 * Level 2 – The Valley Run
 * A second seed reshapes the terrain.  Objects cluster in the dip at mid-field.
 * Glass mixed with stone encourages targeted precision.
 */
function buildLevel2(): LevelLayout {
  const seed = 2;

  const cx = 5;

  const objects: LevelObjectSpawn[] = [
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.STONE,  position: vec3(cx - 4, 0, -2), scale: 1.4 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.STONE,  position: vec3(cx + 4, 0,  2), scale: 1.4 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.GLASS,  position: vec3(cx,     0, 0),  scale: 0.9 },
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.GLASS,  position: vec3(cx + 1, 0, -1), scale: 0.9 },
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.GLASS,  position: vec3(cx - 1, 0,  1), scale: 0.9 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD,   position: vec3(cx - 2, 0, 0),  scale: 1.1 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD,   position: vec3(cx + 2, 0, 0),  scale: 1.1 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD,   position: vec3(cx,     0, -3), scale: 1.1 },
    { shape: DestructibleShape.PYRAMID,  material: DestructibleMaterial.WOOD,   position: vec3(cx,     2, 0),  scale: 1.0 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER, position: vec3(cx - 5, 0,  3), scale: 1.1 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER, position: vec3(cx + 5, 0, -3), scale: 1.1 },
  ];

  const props: LevelPropSpawn[] = [
    { type: 'barrier', position: vec3(15, 0, -18), scale: vec3(80, 2, 1) },
    { type: 'barrier', position: vec3(15, 0,  18), scale: vec3(80, 2, 1) },
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0, -4) },
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0,  4) },
    { type: 'post', position: vec3(15, 0, -8) },
    { type: 'post', position: vec3(15, 0,  8) },
  ];

  return {
    name: 'The Valley Run',
    description: 'Thread the needle through stone walls to shatter the glass inside!',
    roundNumber: 2,
    terrainSeed: seed,
    tiresAvailable: 5,
    targetScore: 2500,
    timeLimit: 75,
    objects,
    props,
    launchPosition: vec3(HILL_PEAK_X, 0, 0),
    skyColor: color4(0.45, 0.65, 0.82, 1.0),
    groundLightColor: color3(0.28, 0.42, 0.20),
  };
}

/**
 * Level 3 – Tower Challenge
 * Towers stacked on the lower terrain.  A different seed creates new bumps to
 * send the tire veering unpredictably into (or away from) the towers.
 */
function buildLevel3(): LevelLayout {
  const seed = 3;

  const makeTower = (
    tx: number, tz: number,
    mats: DestructibleMaterial[], shapes: DestructibleShape[],
  ): LevelObjectSpawn[] =>
    mats.map((mat, tier) => ({
      shape: shapes[tier % shapes.length],
      material: mat,
      position: vec3(tx, tier * 1.4, tz),  // y = stacking offset above terrain
      scale: 1.1,
    }));

  const objects: LevelObjectSpawn[] = [
    ...makeTower(-2, -4,
      [DestructibleMaterial.WOOD, DestructibleMaterial.WOOD, DestructibleMaterial.WOOD, DestructibleMaterial.CRYSTAL],
      [DestructibleShape.CUBE, DestructibleShape.CUBE, DestructibleShape.CUBE, DestructibleShape.PYRAMID]),
    ...makeTower( 6,  0,
      [DestructibleMaterial.METAL, DestructibleMaterial.GLASS, DestructibleMaterial.METAL, DestructibleMaterial.GLASS, DestructibleMaterial.CRYSTAL],
      [DestructibleShape.CUBE, DestructibleShape.CYLINDER, DestructibleShape.CUBE, DestructibleShape.CYLINDER, DestructibleShape.SPHERE]),
    ...makeTower(14,  4,
      [DestructibleMaterial.STONE, DestructibleMaterial.STONE, DestructibleMaterial.WOOD, DestructibleMaterial.GLASS],
      [DestructibleShape.CUBE, DestructibleShape.CUBE, DestructibleShape.CYLINDER, DestructibleShape.PYRAMID]),
    { shape: DestructibleShape.SPHERE, material: DestructibleMaterial.CRYSTAL, position: vec3(2, 0, 0), scale: 1.2 },
  ];

  const props: LevelPropSpawn[] = [
    { type: 'barrier', position: vec3(15, 0, -18), scale: vec3(80, 2, 1) },
    { type: 'barrier', position: vec3(15, 0,  18), scale: vec3(80, 2, 1) },
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0, -4) },
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0,  4) },
    { type: 'box', position: vec3(-5, 0, 0), color: color3(0.7, 0.3, 0.1), scale: vec3(3, 1, 2) },
  ];

  return {
    name: 'Tower Challenge',
    description: 'Topple the towers! Chain collapses earn huge combo bonuses.',
    roundNumber: 3,
    terrainSeed: seed,
    tiresAvailable: 4,
    targetScore: 4500,
    timeLimit: 70,
    objects,
    props,
    launchPosition: vec3(HILL_PEAK_X, 0, 0),
    skyColor: color4(0.30, 0.40, 0.58, 1.0),
    groundLightColor: color3(0.30, 0.28, 0.18),
  };
}

/**
 * Level 4 – Scattered Chaos
 * Objects flung across the whole downslope.  Rubber balls ricochet everywhere.
 */
function buildLevel4(): LevelLayout {
  const seed = 4;

  const scatter: Array<[number, number, DestructibleShape, DestructibleMaterial, number]> = [
    [-10, -5, DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER,  1.0],
    [ -8,  3, DestructibleShape.CUBE,     DestructibleMaterial.METAL,   1.3],
    [ -5, -2, DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER,  1.1],
    [ -3,  5, DestructibleShape.CYLINDER, DestructibleMaterial.WOOD,    1.2],
    [ -1, -6, DestructibleShape.CUBE,     DestructibleMaterial.STONE,   1.0],
    [  1,  2, DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER,  0.9],
    [  3, -3, DestructibleShape.PYRAMID,  DestructibleMaterial.WOOD,    1.0],
    [  5,  7, DestructibleShape.CUBE,     DestructibleMaterial.METAL,   1.2],
    [  7, -8, DestructibleShape.SPHERE,   DestructibleMaterial.GLASS,   0.8],
    [  9,  0, DestructibleShape.CYLINDER, DestructibleMaterial.METAL,   1.3],
    [ 11,  4, DestructibleShape.CUBE,     DestructibleMaterial.WOOD,    1.0],
    [ 12, -5, DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER,  1.0],
    [ 14,  8, DestructibleShape.CUBE,     DestructibleMaterial.STONE,   1.1],
    [ 15, -1, DestructibleShape.SPHERE,   DestructibleMaterial.CRYSTAL, 0.9],
    [ 17,  5, DestructibleShape.PYRAMID,  DestructibleMaterial.WOOD,    1.0],
    [ 19, -4, DestructibleShape.CUBE,     DestructibleMaterial.METAL,   1.2],
    [ 21,  2, DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER,  1.1],
    [ 23, -7, DestructibleShape.CYLINDER, DestructibleMaterial.GLASS,   0.9],
  ];

  const objects: LevelObjectSpawn[] = scatter.map(([x, z, shape, mat, scale]) => ({
    shape, material: mat, position: vec3(x, 0, z), scale,
  }));

  const props: LevelPropSpawn[] = [
    { type: 'barrier', position: vec3(15, 0, -18), scale: vec3(80, 2, 1) },
    { type: 'barrier', position: vec3(15, 0,  18), scale: vec3(80, 2, 1) },
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0, -4) },
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0,  4) },
    { type: 'post', position: vec3( 3, 0, -9) },
    { type: 'post', position: vec3(10, 0,  9) },
    { type: 'post', position: vec3(18, 0, -7) },
  ];

  return {
    name: 'Scattered Chaos',
    description: 'Complete mayhem! Objects everywhere – bounce your way to victory.',
    roundNumber: 4,
    terrainSeed: seed,
    tiresAvailable: 3,
    targetScore: 7000,
    timeLimit: 60,
    objects,
    props,
    launchPosition: vec3(HILL_PEAK_X, 0, 0),
    skyColor: color4(0.20, 0.22, 0.30, 1.0),
    groundLightColor: color3(0.25, 0.22, 0.15),
  };
}

/**
 * Level 5 – Final Gauntlet
 * A dense fortress on the lower terrain.  Only 3 tires.
 */
function buildLevel5(): LevelLayout {
  const seed = 5;

  const fortressObjects: LevelObjectSpawn[] = [
    ...([0, 45, 90, 135, 180, 225, 270, 315].map((deg): LevelObjectSpawn => {
      const rad = (deg * Math.PI) / 180;
      const r = 6;
      return {
        shape: DestructibleShape.CUBE, material: DestructibleMaterial.STONE,
        position: vec3(10 + Math.cos(rad) * r, 0, Math.sin(rad) * r), scale: 1.2,
      };
    })),
    ...([0, 60, 120, 180, 240, 300].map((deg): LevelObjectSpawn => {
      const rad = (deg * Math.PI) / 180;
      const r = 3.5;
      return {
        shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.METAL,
        position: vec3(10 + Math.cos(rad) * r, 0, Math.sin(rad) * r), scale: 1.1,
      };
    })),
    ...([0, 90, 180, 270].map((deg): LevelObjectSpawn => {
      const rad = (deg * Math.PI) / 180;
      const r = 1.8;
      return {
        shape: DestructibleShape.SPHERE, material: DestructibleMaterial.GLASS,
        position: vec3(10 + Math.cos(rad) * r, 0, Math.sin(rad) * r), scale: 1.0,
      };
    })),
    { shape: DestructibleShape.PYRAMID, material: DestructibleMaterial.CRYSTAL, position: vec3(10, 3.5, 0),  scale: 1.5 },
    { shape: DestructibleShape.SPHERE,  material: DestructibleMaterial.CRYSTAL, position: vec3(10, 6.0, 0),  scale: 0.8 },
  ];

  const makeSiegeTower = (tx: number, tz: number): LevelObjectSpawn[] => [
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.STONE,   position: vec3(tx, 0.0, tz), scale: 1.3 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.METAL,   position: vec3(tx, 1.4, tz), scale: 1.1 },
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.METAL,   position: vec3(tx, 2.6, tz), scale: 1.0 },
    { shape: DestructibleShape.PYRAMID,  material: DestructibleMaterial.CRYSTAL, position: vec3(tx, 3.9, tz), scale: 0.9 },
  ];

  const bonusObjects: LevelObjectSpawn[] = [
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.CRYSTAL, position: vec3(-5, 0, -6),  scale: 0.9 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.RUBBER,  position: vec3(-3, 0,  7),  scale: 1.1 },
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.GLASS,   position: vec3(20, 0, -5),  scale: 1.0 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.GLASS,   position: vec3(19, 0,  6),  scale: 0.9 },
    { shape: DestructibleShape.PYRAMID,  material: DestructibleMaterial.WOOD,    position: vec3( 0, 0, -8),  scale: 1.0 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER,  position: vec3( 1, 0,  8),  scale: 1.0 },
  ];

  const objects: LevelObjectSpawn[] = [
    ...fortressObjects,
    ...makeSiegeTower( 3, -5),
    ...makeSiegeTower( 3,  5),
    ...makeSiegeTower(17, -5),
    ...makeSiegeTower(17,  5),
    ...bonusObjects,
  ];

  const props: LevelPropSpawn[] = [
    { type: 'barrier', position: vec3(15, 0, -18), scale: vec3(80, 2.5, 1.2) },
    { type: 'barrier', position: vec3(15, 0,  18), scale: vec3(80, 2.5, 1.2) },
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0, -5), height: 5 } as LevelPropSpawn & { height: number },
    { type: 'post', position: vec3(HILL_PEAK_X - 2, 0,  5), height: 5 } as LevelPropSpawn & { height: number },
    { type: 'post', position: vec3( 5, 0, -10) },
    { type: 'post', position: vec3( 5, 0,  10) },
    { type: 'post', position: vec3(22, 0, -10) },
    { type: 'post', position: vec3(22, 0,  10) },
    { type: 'box', position: vec3(2, 0, -3), color: color3(0.55, 0.20, 0.20), scale: vec3(2, 1, 1) },
    { type: 'box', position: vec3(2, 0,  3), color: color3(0.55, 0.20, 0.20), scale: vec3(2, 1, 1) },
  ];

  return {
    name: 'Final Gauntlet',
    description: 'Breach the fortress and shatter the crystal crown!',
    roundNumber: 5,
    terrainSeed: seed,
    tiresAvailable: 3,
    targetScore: 12000,
    timeLimit: 60,
    objects,
    props,
    launchPosition: vec3(HILL_PEAK_X, 0, 0),
    skyColor: color4(0.10, 0.08, 0.15, 1.0),
    groundLightColor: color3(0.22, 0.18, 0.28),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the LevelLayout for the given round number (1–5).
 */
export function getLevelLayout(roundNumber: number): LevelLayout {
  const round = Math.max(1, Math.min(5, Math.round(roundNumber)));
  switch (round) {
    case 1: return buildLevel1();
    case 2: return buildLevel2();
    case 3: return buildLevel3();
    case 4: return buildLevel4();
    case 5: return buildLevel5();
    default: return buildLevel1();
  }
}

// ---------------------------------------------------------------------------
// LevelGenerator class – applies a LevelLayout to the live scene
// ---------------------------------------------------------------------------

export class LevelGenerator {
  private scene: BABYLON.Scene;
  private physicsManager: PhysicsManager;
  private shadowGenerator?: BABYLON.ShadowGenerator;
  private destructibleFactory: DestructibleObjectFactory;
  private environmentManager: EnvironmentManager;

  private groundMesh?: BABYLON.Mesh;

  /** Current terrain height function – set after buildLevel(). */
  private currentSeed: number = 1;

  constructor(
    scene: BABYLON.Scene,
    physicsManager: PhysicsManager,
    destructibleFactory: DestructibleObjectFactory,
    environmentManager: EnvironmentManager,
    shadowGenerator?: BABYLON.ShadowGenerator,
  ) {
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.destructibleFactory = destructibleFactory;
    this.environmentManager = environmentManager;
    this.shadowGenerator = shadowGenerator;
    console.log('LevelGenerator initialized');
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Returns the world-Y position of the terrain surface at (worldX, worldZ).
   * Valid after buildLevel() has been called.
   */
  public getTerrainSurfaceY(worldX: number, worldZ: number): number {
    return terrainSurfaceY(worldX, worldZ, this.currentSeed);
  }

  /**
   * Build a complete level from a LevelLayout descriptor.
   */
  public buildLevel(layout: LevelLayout): void {
    console.log(`LevelGenerator: building level ${layout.roundNumber} – "${layout.name}"`);

    this.currentSeed = layout.terrainSeed;

    this.scene.clearColor = layout.skyColor;
    this.buildProceduralTerrain(layout);
    this.spawnObjects(layout);
    this.spawnProps(layout);

    console.log(
      `LevelGenerator: level "${layout.name}" ready – ` +
      `${layout.objects.length} destructibles, ${layout.props.length} props`,
    );
  }

  /**
   * Remove all level geometry. Call before building the next level.
   */
  public clearLevel(): void {
    if (this.groundMesh) {
      this.groundMesh.dispose();
      this.groundMesh = undefined;
    }
    this.destructibleFactory.destroyAll();
    this.environmentManager.clear();
    this.physicsManager.clear();
    console.log('LevelGenerator: level cleared');
  }

  // ─── Private builders ──────────────────────────────────────────────────────

  /**
   * Generate a procedural heightfield terrain and register it with physics.
   *
   * The terrain spans world X from TERRAIN_ORIGIN_X to TERRAIN_ORIGIN_X+TERRAIN_WIDTH
   * and world Z from TERRAIN_ORIGIN_Z to TERRAIN_ORIGIN_Z+TERRAIN_DEPTH.
   * Heights are computed from terrainHeightAt() and placed above TERRAIN_BASE_Y.
   */
  private buildProceduralTerrain(layout: LevelLayout): void {
    const seed = layout.terrainSeed;
    const nVertX = TERRAIN_SUBDIV_X + 1; // 81
    const nVertZ = TERRAIN_SUBDIV_Z + 1; // 41

    // --- Babylon mesh ---
    const ground = BABYLON.MeshBuilder.CreateGround(
      'terrain',
      {
        width:        TERRAIN_WIDTH,
        height:       TERRAIN_DEPTH,
        subdivisionsX: TERRAIN_SUBDIV_X,
        subdivisionsY: TERRAIN_SUBDIV_Z,
        updatable:    true,
      },
      this.scene,
    );

    // Center the mesh so it spans the desired world range
    const centerX = TERRAIN_ORIGIN_X + TERRAIN_WIDTH  / 2; // -25 + 40 = 15
    const centerZ = TERRAIN_ORIGIN_Z + TERRAIN_DEPTH  / 2; //  -20 + 20 = 0
    ground.position.set(centerX, TERRAIN_BASE_Y, centerZ);
    ground.receiveShadows = true;

    // Modify vertex heights
    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind) as Float32Array;

    for (let row = 0; row < nVertZ; row++) {
      for (let col = 0; col < nVertX; col++) {
        const i = (row * nVertX + col) * 3;

        // In Babylon's CreateGround, local X runs from -width/2 to +width/2,
        // local Z runs from -height/2 to +height/2  (Y = 0 by default).
        const localX = -TERRAIN_WIDTH  / 2 + col * TERRAIN_ELEMENT_SIZE;
        const localZ = -TERRAIN_DEPTH  / 2 + row * TERRAIN_ELEMENT_SIZE;

        const worldX = centerX + localX;
        const worldZ = centerZ + localZ;

        // positions[i]   = local X (unchanged)
        // positions[i+1] = local Y (height above mesh origin)
        // positions[i+2] = local Z (unchanged)
        positions[i + 1] = terrainHeightAt(worldX, worldZ, seed);
      }
    }

    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);

    // Recompute normals for correct lighting
    const indices = ground.getIndices()!;
    const normals: number[] = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, new Float32Array(normals), true);
    ground.refreshBoundingInfo();

    // PBR terrain material
    const mat = new BABYLON.PBRMetallicRoughnessMaterial('terrainMat', this.scene);
    mat.baseColor = layout.groundLightColor;
    mat.metallic  = 0.0;
    mat.roughness = 0.95;
    ground.material = mat;

    this.groundMesh = ground;

    // --- CANNON heightfield ---
    // Build [xi][zi] height array in the same spatial order as the mesh.
    // CANNON Heightfield data[xi][zi] → world position:
    //   worldX = offsetX + xi * elementSize
    //   worldZ = offsetZ + zi * elementSize
    //   worldY = body.position.y + heights[xi][zi]
    const heights: number[][] = [];
    for (let xi = 0; xi < nVertX; xi++) {
      heights[xi] = [];
      for (let zi = 0; zi < nVertZ; zi++) {
        const worldX = TERRAIN_ORIGIN_X + xi * TERRAIN_ELEMENT_SIZE;
        const worldZ = TERRAIN_ORIGIN_Z + zi * TERRAIN_ELEMENT_SIZE;
        heights[xi][zi] = terrainHeightAt(worldX, worldZ, seed);
      }
    }

    this.physicsManager.addTerrainBody(
      heights,
      TERRAIN_ELEMENT_SIZE,
      TERRAIN_ORIGIN_X,
      TERRAIN_ORIGIN_Z,
      TERRAIN_BASE_Y,
    );
  }

  private spawnObjects(layout: LevelLayout): void {
    const seed = layout.terrainSeed;

    for (const spawn of layout.objects) {
      const worldX = spawn.position.x;
      const worldZ = spawn.position.z;
      const scale  = spawn.scale ?? 1.0;

      // Place the object ON the terrain surface.
      // spawn.position.y is treated as a vertical stacking offset (0 = ground level).
      const surfaceY = terrainSurfaceY(worldX, worldZ, seed);
      const objectHalfH = scale * 0.75; // rough half-height for all shapes
      const finalY = surfaceY + objectHalfH + spawn.position.y;

      const adjustedPos = new BABYLON.Vector3(worldX, finalY, worldZ);

      const obj = this.destructibleFactory.create({
        shape:    spawn.shape,
        material: spawn.material,
        position: adjustedPos,
        scale,
      });

      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(obj.mesh);
      }
    }
  }

  private spawnProps(layout: LevelLayout): void {
    const seed = layout.terrainSeed;

    for (const prop of layout.props) {
      // Align props to terrain surface as well
      const surfaceY = terrainSurfaceY(prop.position.x, prop.position.z, seed);
      const adjustedPos = new BABYLON.Vector3(
        prop.position.x,
        surfaceY + (prop.position.y !== 0 ? prop.position.y : 0),
        prop.position.z,
      );

      switch (prop.type) {
        case 'barrier':
          this.environmentManager.spawnBarrier(adjustedPos, prop.rotation, prop.scale);
          break;
        case 'ramp':
          this.environmentManager.spawnRamp(adjustedPos, prop.rotation, prop.scale);
          break;
        case 'post': {
          const height = (prop as LevelPropSpawn & { height?: number }).height;
          this.environmentManager.spawnPost(adjustedPos, prop.rotation, height);
          break;
        }
        case 'box': {
          const boxColor = prop.color ?? new BABYLON.Color3(0.6, 0.4, 0.2);
          this.environmentManager.spawnBox(
            `levelBox_${layout.roundNumber}_${this.environmentManager.getSpawnedProps().length}`,
            adjustedPos, boxColor, prop.scale, prop.rotation,
          );
          break;
        }
      }
    }
  }
}
