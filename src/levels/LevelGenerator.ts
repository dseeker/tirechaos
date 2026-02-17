import * as BABYLON from '@babylonjs/core';
import { DestructibleObjectFactory, DestructibleShape, DestructibleMaterial } from '../systems/DestructibleObjectFactory';
import { EnvironmentManager } from '../systems/EnvironmentManager';
import { PhysicsManager } from '../systems/PhysicsManager';

// ---------------------------------------------------------------------------
// Level configuration types
// ---------------------------------------------------------------------------

/**
 * Describes a single destructible object to spawn at level load time.
 * The factory will create it with the given options.
 */
export interface LevelObjectSpawn {
  shape: DestructibleShape;
  material: DestructibleMaterial;
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
  /** Overall slope of the ground plane in radians (negative = tilted toward the camera). */
  groundAngle: number;
  /** Y-position of the ground mesh centre. */
  groundY: number;
  /** Width and depth of the ground plane. */
  groundSize: { width: number; depth: number };
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
  /** Launch position for the tire (left side of the level). */
  launchPosition: BABYLON.Vector3;
  /** Sky / ambient colour for this level (RGBA). */
  skyColor: BABYLON.Color4;
  /** Ambient light ground-colour tint. */
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
 * Level 1 – Tutorial
 * A gentle introduction: flat terrain, 6 easy wood/rubber objects in a loose
 * line, two launch ramps, and just a few decorative props.  The player has 5
 * tires and a generous time limit so they can experiment without pressure.
 */
function buildLevel1(): LevelLayout {
  const groundY = -5;

  const objects: LevelObjectSpawn[] = [
    // Row of simple wooden cubes – easy targets right in the tire's path
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD, position: vec3(0,  groundY + 1.5, 0),  scale: 1.2 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD, position: vec3(3,  groundY + 1.5, 0),  scale: 1.2 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD, position: vec3(6,  groundY + 1.5, 0),  scale: 1.2 },
    // A couple of rubber spheres that bounce entertainingly
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER, position: vec3(-2, groundY + 1.2, 2), scale: 1.0 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER, position: vec3(4,  groundY + 1.2, -2), scale: 1.0 },
    // One glass cylinder as a bonus high-value target
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.GLASS,  position: vec3(9,  groundY + 1.5, 0),  scale: 1.0 },
  ];

  const props: LevelPropSpawn[] = [
    // Perimeter walls
    { type: 'barrier', position: vec3(0, groundY, -10), scale: vec3(50, 2, 1) },
    { type: 'barrier', position: vec3(0, groundY,  10), scale: vec3(50, 2, 1) },
    { type: 'barrier', position: vec3(-25, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(20, 2, 1) },
    { type: 'barrier', position: vec3( 25, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(20, 2, 1) },
    // Main launch ramp
    { type: 'ramp', position: vec3(-18, groundY - 0.5, 0), rotation: vec3(0, 0, -0.2) },
    // Lane-marker posts flanking the launch chute
    { type: 'post', position: vec3(-20, groundY, -3) },
    { type: 'post', position: vec3(-20, groundY,  3) },
    // A small crate hint that there is stuff to smash
    { type: 'box', position: vec3(-8, groundY + 0.5, 0), color: color3(0.85, 0.65, 0.2) },
  ];

  return {
    name: 'Tutorial',
    description: 'Learn the ropes! Knock over the wooden blocks to score.',
    roundNumber: 1,
    groundAngle: -0.05,            // Almost flat – easy roll
    groundY,
    groundSize: { width: 60, depth: 22 },
    tiresAvailable: 5,
    targetScore: 1000,
    timeLimit: 90,
    objects,
    props,
    launchPosition: vec3(-15, groundY + 7, 0),
    skyColor: color4(0.53, 0.81, 0.92, 1.0),   // Bright blue sky
    groundLightColor: color3(0.36, 0.55, 0.24), // Vivid grass
  };
}

/**
 * Level 2 – The Valley
 * Objects cluster in a bowl-shaped valley.  The ground has a steeper inward
 * slope, so tires pick up speed.  Introduces stone blocks (high health) mixed
 * with glass (fragile, high points) to encourage targeted throwing.
 */
function buildLevel2(): LevelLayout {
  const groundY = -5;

  // Valley centre: pack objects tightly so chain reactions are possible
  const cx = 5;
  const cz = 0;

  const objects: LevelObjectSpawn[] = [
    // Stone anchors at the sides – hard to destroy, act as walls
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.STONE,   position: vec3(cx - 4, groundY + 1.5, cz - 2), scale: 1.4 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.STONE,   position: vec3(cx + 4, groundY + 1.5, cz + 2), scale: 1.4 },
    // Central glass cluster – high reward if you thread the needle
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.GLASS,   position: vec3(cx,     groundY + 1.2, cz),     scale: 0.9 },
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.GLASS,   position: vec3(cx + 1, groundY + 1.5, cz - 1), scale: 0.9 },
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.GLASS,   position: vec3(cx - 1, groundY + 1.5, cz + 1), scale: 0.9 },
    // Wood filler
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD,    position: vec3(cx - 2, groundY + 1.5, cz),     scale: 1.1 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD,    position: vec3(cx + 2, groundY + 1.5, cz),     scale: 1.1 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.WOOD,    position: vec3(cx,     groundY + 1.5, cz - 3), scale: 1.1 },
    // A second-layer wood pyramid – stack collapses if the base is hit
    { shape: DestructibleShape.PYRAMID,  material: DestructibleMaterial.WOOD,    position: vec3(cx,     groundY + 3.2, cz),     scale: 1.0 },
    // Rubber balls that ricochet around the valley
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER,  position: vec3(cx - 5, groundY + 1.2, cz + 3), scale: 1.1 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER,  position: vec3(cx + 5, groundY + 1.2, cz - 3), scale: 1.1 },
  ];

  const props: LevelPropSpawn[] = [
    // Perimeter
    { type: 'barrier', position: vec3(0, groundY, -10), scale: vec3(50, 2, 1) },
    { type: 'barrier', position: vec3(0, groundY,  10), scale: vec3(50, 2, 1) },
    { type: 'barrier', position: vec3(-25, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(20, 2, 1) },
    { type: 'barrier', position: vec3( 25, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(20, 2, 1) },
    // Sloped valley side ramps (channel the tire toward the centre)
    { type: 'ramp', position: vec3(-15, groundY - 0.5, 0),  rotation: vec3(0, 0, -0.25) },
    { type: 'ramp', position: vec3(-5,  groundY - 0.5, -4), rotation: vec3(0, 0.3, -0.18) },
    { type: 'ramp', position: vec3(-5,  groundY - 0.5,  4), rotation: vec3(0, -0.3, -0.18) },
    // Scenic posts along the sides
    { type: 'post', position: vec3(-18, groundY, -3) },
    { type: 'post', position: vec3(-18, groundY,  3) },
    { type: 'post', position: vec3(12,  groundY, -6) },
    { type: 'post', position: vec3(12,  groundY,  6) },
  ];

  return {
    name: 'The Valley',
    description: 'Objects cluster in the valley floor. Aim for the glass!',
    roundNumber: 2,
    groundAngle: -0.18,            // Noticeable downslope
    groundY,
    groundSize: { width: 60, depth: 22 },
    tiresAvailable: 5,
    targetScore: 2500,
    timeLimit: 75,
    objects,
    props,
    launchPosition: vec3(-15, groundY + 7, 0),
    skyColor: color4(0.45, 0.65, 0.82, 1.0),   // Slightly overcast blue
    groundLightColor: color3(0.28, 0.42, 0.20), // Darker valley grass
  };
}

/**
 * Level 3 – Tower Challenge
 * Objects are stacked into tall vertical columns – topple a tower and
 * everything comes crashing down for a chain bonus.  Introduces metal and
 * crystal materials.  Only 4 tires; precision is rewarded.
 */
function buildLevel3(): LevelLayout {
  const groundY = -5;

  // Helper to build a tower at (tx, tz) from bottom to top
  const makeTower = (
    tx: number,
    tz: number,
    mats: DestructibleMaterial[],
    shapes: DestructibleShape[],
  ): LevelObjectSpawn[] => {
    const spawns: LevelObjectSpawn[] = [];
    for (let tier = 0; tier < mats.length; tier++) {
      spawns.push({
        shape: shapes[tier % shapes.length],
        material: mats[tier],
        position: vec3(tx, groundY + 1.2 + tier * 1.3, tz),
        scale: 1.1,
      });
    }
    return spawns;
  };

  const objects: LevelObjectSpawn[] = [
    // Left tower  – all wood, four tiers
    ...makeTower(-4, -3,
      [DestructibleMaterial.WOOD, DestructibleMaterial.WOOD, DestructibleMaterial.WOOD, DestructibleMaterial.CRYSTAL],
      [DestructibleShape.CUBE, DestructibleShape.CUBE, DestructibleShape.CUBE, DestructibleShape.PYRAMID]),

    // Centre tower – alternating metal / glass, five tiers
    ...makeTower(4, 0,
      [DestructibleMaterial.METAL, DestructibleMaterial.GLASS, DestructibleMaterial.METAL, DestructibleMaterial.GLASS, DestructibleMaterial.CRYSTAL],
      [DestructibleShape.CUBE, DestructibleShape.CYLINDER, DestructibleShape.CUBE, DestructibleShape.CYLINDER, DestructibleShape.SPHERE]),

    // Right tower – stone base, glass top, four tiers
    ...makeTower(10, 3,
      [DestructibleMaterial.STONE, DestructibleMaterial.STONE, DestructibleMaterial.WOOD, DestructibleMaterial.GLASS],
      [DestructibleShape.CUBE, DestructibleShape.CUBE, DestructibleShape.CYLINDER, DestructibleShape.PYRAMID]),

    // Lone crystal sentinel between towers as a high-value bonus target
    { shape: DestructibleShape.SPHERE, material: DestructibleMaterial.CRYSTAL, position: vec3(0, groundY + 1.2, 0), scale: 1.2 },
  ];

  const props: LevelPropSpawn[] = [
    // Perimeter
    { type: 'barrier', position: vec3(0, groundY, -10), scale: vec3(50, 2, 1) },
    { type: 'barrier', position: vec3(0, groundY,  10), scale: vec3(50, 2, 1) },
    { type: 'barrier', position: vec3(-25, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(20, 2, 1) },
    { type: 'barrier', position: vec3( 25, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(20, 2, 1) },
    // Launch ramp
    { type: 'ramp', position: vec3(-18, groundY - 0.5, 0), rotation: vec3(0, 0, -0.22) },
    // Small crate platform at mid-field – landing on it can topple a tower
    { type: 'box', position: vec3(-8, groundY + 0.5, 0), color: color3(0.7, 0.3, 0.1), scale: vec3(3, 1, 2) },
    // Flanking posts
    { type: 'post', position: vec3(-20, groundY, -3) },
    { type: 'post', position: vec3(-20, groundY,  3) },
    { type: 'post', position: vec3(15,  groundY, -6) },
    { type: 'post', position: vec3(15,  groundY,  6) },
  ];

  return {
    name: 'Tower Challenge',
    description: 'Topple the towers! Chain collapses earn huge combo bonuses.',
    roundNumber: 3,
    groundAngle: -0.15,
    groundY,
    groundSize: { width: 60, depth: 22 },
    tiresAvailable: 4,
    targetScore: 4500,
    timeLimit: 70,
    objects,
    props,
    launchPosition: vec3(-15, groundY + 7, 0),
    skyColor: color4(0.30, 0.40, 0.58, 1.0),   // Dusk steel blue
    groundLightColor: color3(0.30, 0.28, 0.18), // Dusty amber ground
  };
}

/**
 * Level 4 – Scattered Chaos
 * Objects are flung across the entire arena with no clear pattern.  Many
 * rubber balls that bounce unpredictably.  Metal boxes lurk everywhere.
 * Tires drop to 3 – maximum aggression required.
 */
function buildLevel4(): LevelLayout {
  const groundY = -5;

  // Seeded deterministic scatter positions so the layout is consistent but
  // feels organic (no actual Math.random – positions are hand-placed).
  const scatterPositions: Array<[number, number, number, DestructibleShape, DestructibleMaterial, number]> = [
    // [x, y-offset, z, shape, material, scale]
    [-12, 1.2, -5, DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER, 1.0],
    [-10, 1.5, 3,  DestructibleShape.CUBE,     DestructibleMaterial.METAL,  1.3],
    [ -7, 1.2, -2, DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER, 1.1],
    [ -5, 1.5, 5,  DestructibleShape.CYLINDER, DestructibleMaterial.WOOD,   1.2],
    [ -3, 1.5, -6, DestructibleShape.CUBE,     DestructibleMaterial.STONE,  1.0],
    [ -2, 1.2, 2,  DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER, 0.9],
    [  0, 1.5, -3, DestructibleShape.PYRAMID,  DestructibleMaterial.WOOD,   1.0],
    [  1, 1.5, 7,  DestructibleShape.CUBE,     DestructibleMaterial.METAL,  1.2],
    [  3, 1.2, -8, DestructibleShape.SPHERE,   DestructibleMaterial.GLASS,  0.8],
    [  4, 1.5, 0,  DestructibleShape.CYLINDER, DestructibleMaterial.METAL,  1.3],
    [  5, 1.5, 4,  DestructibleShape.CUBE,     DestructibleMaterial.WOOD,   1.0],
    [  6, 1.2, -5, DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER, 1.0],
    [  7, 1.5, 8,  DestructibleShape.CUBE,     DestructibleMaterial.STONE,  1.1],
    [  8, 3.5, -1, DestructibleShape.SPHERE,   DestructibleMaterial.CRYSTAL, 0.9],  // Elevated crystal
    [  9, 1.5, 5,  DestructibleShape.PYRAMID,  DestructibleMaterial.WOOD,   1.0],
    [ 11, 1.5, -4, DestructibleShape.CUBE,     DestructibleMaterial.METAL,  1.2],
    [ 12, 1.2, 2,  DestructibleShape.SPHERE,   DestructibleMaterial.RUBBER, 1.1],
    [ 14, 1.5, -7, DestructibleShape.CYLINDER, DestructibleMaterial.GLASS,  0.9],
  ];

  const objects: LevelObjectSpawn[] = scatterPositions.map(([x, yOff, z, shape, mat, scale]) => ({
    shape,
    material: mat,
    position: vec3(x, groundY + yOff, z),
    scale,
  }));

  const props: LevelPropSpawn[] = [
    // Perimeter
    { type: 'barrier', position: vec3(0, groundY, -10), scale: vec3(50, 2, 1) },
    { type: 'barrier', position: vec3(0, groundY,  10), scale: vec3(50, 2, 1) },
    { type: 'barrier', position: vec3(-25, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(20, 2, 1) },
    { type: 'barrier', position: vec3( 25, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(20, 2, 1) },
    // Multiple ramps – the tire can ricochet in any direction
    { type: 'ramp', position: vec3(-18, groundY - 0.5, 0),  rotation: vec3(0, 0, -0.25) },
    { type: 'ramp', position: vec3(-4,  groundY - 0.5, -4), rotation: vec3(0, 0.4, -0.2) },
    { type: 'ramp', position: vec3( 3,  groundY - 0.5,  4), rotation: vec3(0, -0.4, -0.2) },
    // Scattered posts as pinball bumpers
    { type: 'post', position: vec3(-16, groundY, -3) },
    { type: 'post', position: vec3(-16, groundY,  3) },
    { type: 'post', position: vec3( -1, groundY, -7) },
    { type: 'post', position: vec3(  6, groundY,  7) },
    { type: 'post', position: vec3( 13, groundY, -5) },
  ];

  return {
    name: 'Scattered Chaos',
    description: 'Complete mayhem! Objects everywhere – bounce your way to victory.',
    roundNumber: 4,
    groundAngle: -0.2,
    groundY,
    groundSize: { width: 60, depth: 24 },
    tiresAvailable: 3,
    targetScore: 7000,
    timeLimit: 60,
    objects,
    props,
    launchPosition: vec3(-15, groundY + 7, 0),
    skyColor: color4(0.20, 0.22, 0.30, 1.0),   // Dark stormy sky
    groundLightColor: color3(0.25, 0.22, 0.15), // Dry cracked earth
  };
}

/**
 * Level 5 – Final Gauntlet
 * The ultimate test: towers, scattered glass, a dense central fortress of
 * metal and stone, and a crystal crown on top.  Only 3 tires.  The player
 * needs high combo chains to hit the target score.
 */
function buildLevel5(): LevelLayout {
  const groundY = -5;

  // Central fortress – concentric rings of objects
  const fortressObjects: LevelObjectSpawn[] = [
    // Outer ring – stone cubes at 8 positions
    ...([0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const r = 6;
      return {
        shape: DestructibleShape.CUBE,
        material: DestructibleMaterial.STONE,
        position: vec3(5 + Math.cos(rad) * r, groundY + 1.5, Math.sin(rad) * r),
        scale: 1.2,
      } as LevelObjectSpawn;
    })),

    // Middle ring – metal cylinders at 6 positions
    ...([0, 60, 120, 180, 240, 300].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const r = 3.5;
      return {
        shape: DestructibleShape.CYLINDER,
        material: DestructibleMaterial.METAL,
        position: vec3(5 + Math.cos(rad) * r, groundY + 1.5, Math.sin(rad) * r),
        scale: 1.1,
      } as LevelObjectSpawn;
    })),

    // Inner ring – glass spheres at 4 positions
    ...([0, 90, 180, 270].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const r = 1.8;
      return {
        shape: DestructibleShape.SPHERE,
        material: DestructibleMaterial.GLASS,
        position: vec3(5 + Math.cos(rad) * r, groundY + 1.2, Math.sin(rad) * r),
        scale: 1.0,
      } as LevelObjectSpawn;
    })),

    // Crown – crystal pyramid on the central pedestal
    { shape: DestructibleShape.PYRAMID, material: DestructibleMaterial.CRYSTAL, position: vec3(5,  groundY + 4.0, 0), scale: 1.5 },
    { shape: DestructibleShape.SPHERE,  material: DestructibleMaterial.CRYSTAL, position: vec3(5,  groundY + 6.5, 0), scale: 0.8 },
  ];

  // Flanking siege towers (vertical stacks on both sides)
  const makeSiegeTower = (tx: number, tz: number): LevelObjectSpawn[] => [
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.STONE,  position: vec3(tx, groundY + 1.5, tz), scale: 1.3 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.METAL,  position: vec3(tx, groundY + 2.9, tz), scale: 1.1 },
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.METAL,  position: vec3(tx, groundY + 4.1, tz), scale: 1.0 },
    { shape: DestructibleShape.PYRAMID,  material: DestructibleMaterial.CRYSTAL,position: vec3(tx, groundY + 5.4, tz), scale: 0.9 },
  ];

  // Random-looking scattered bonuses in the outer field
  const bonusObjects: LevelObjectSpawn[] = [
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.CRYSTAL, position: vec3(-8, groundY + 1.2, -6), scale: 0.9 },
    { shape: DestructibleShape.CUBE,     material: DestructibleMaterial.RUBBER,  position: vec3(-6, groundY + 1.5, 7),  scale: 1.1 },
    { shape: DestructibleShape.CYLINDER, material: DestructibleMaterial.GLASS,   position: vec3(14, groundY + 1.5, -5), scale: 1.0 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.GLASS,   position: vec3(13, groundY + 1.2, 6),  scale: 0.9 },
    { shape: DestructibleShape.PYRAMID,  material: DestructibleMaterial.WOOD,    position: vec3(-3, groundY + 1.5, -8), scale: 1.0 },
    { shape: DestructibleShape.SPHERE,   material: DestructibleMaterial.RUBBER,  position: vec3(-2, groundY + 1.2, 8),  scale: 1.0 },
  ];

  const objects: LevelObjectSpawn[] = [
    ...fortressObjects,
    ...makeSiegeTower(-2, -4),
    ...makeSiegeTower(-2,  4),
    ...makeSiegeTower(12, -4),
    ...makeSiegeTower(12,  4),
    ...bonusObjects,
  ];

  const props: LevelPropSpawn[] = [
    // Perimeter – heavier barriers for the final level
    { type: 'barrier', position: vec3(0, groundY, -11), scale: vec3(55, 2.5, 1.2) },
    { type: 'barrier', position: vec3(0, groundY,  11), scale: vec3(55, 2.5, 1.2) },
    { type: 'barrier', position: vec3(-27, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(22, 2.5, 1.2) },
    { type: 'barrier', position: vec3( 27, groundY, 0), rotation: vec3(0, Math.PI / 2, 0), scale: vec3(22, 2.5, 1.2) },
    // Launch ramp
    { type: 'ramp', position: vec3(-18, groundY - 0.5, 0), rotation: vec3(0, 0, -0.28) },
    // Secondary ramp mid-field
    { type: 'ramp', position: vec3(-5,  groundY - 0.5, -5), rotation: vec3(0, 0.3, -0.22) },
    // Obstacle ramps inside the fortress zone to deflect tires upward
    { type: 'ramp', position: vec3(-1,  groundY - 0.5,  4), rotation: vec3(0, -0.3, -0.20) },
    // Dramatic pillars marking the gauntlet entrance
    { type: 'post', position: vec3(-12, groundY, -4), height: 5 } as LevelPropSpawn & { height: number },
    { type: 'post', position: vec3(-12, groundY,  4), height: 5 } as LevelPropSpawn & { height: number },
    { type: 'post', position: vec3( 0,  groundY, -8) },
    { type: 'post', position: vec3( 0,  groundY,  8) },
    { type: 'post', position: vec3(16,  groundY, -8) },
    { type: 'post', position: vec3(16,  groundY,  8) },
    // Decorative crate barricades in front of the fortress
    { type: 'box', position: vec3(-4, groundY + 0.5, -3), color: color3(0.55, 0.20, 0.20), scale: vec3(2, 1, 1) },
    { type: 'box', position: vec3(-4, groundY + 0.5,  3), color: color3(0.55, 0.20, 0.20), scale: vec3(2, 1, 1) },
    { type: 'box', position: vec3(-4, groundY + 1.5, 0),  color: color3(0.70, 0.25, 0.25), scale: vec3(2, 1, 1) },
  ];

  return {
    name: 'Final Gauntlet',
    description: 'The fortress awaits. Breach the walls and shatter the crystal crown!',
    roundNumber: 5,
    groundAngle: -0.22,            // Steep run-up
    groundY,
    groundSize: { width: 65, depth: 26 },
    tiresAvailable: 3,
    targetScore: 12000,
    timeLimit: 60,
    objects,
    props,
    launchPosition: vec3(-18, groundY + 7, 0),
    skyColor: color4(0.10, 0.08, 0.15, 1.0),   // Deep purple-black night sky
    groundLightColor: color3(0.22, 0.18, 0.28), // Eerie purple tint
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the LevelLayout for the given round number (1–5).
 * Any value outside 1–5 is clamped to the nearest valid round.
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

/**
 * LevelGenerator
 *
 * Takes a LevelLayout data object and materialises it into the Babylon.js
 * scene using the existing factory and manager classes.  GameManager calls
 * this once per round transition after clearing the previous scene.
 *
 * Usage:
 * ```ts
 * const gen = new LevelGenerator(scene, physicsManager, shadowGenerator);
 * gen.buildLevel(getLevelLayout(roundNumber));
 * ```
 */
export class LevelGenerator {
  private scene: BABYLON.Scene;
  private physicsManager: PhysicsManager;
  private shadowGenerator?: BABYLON.ShadowGenerator;
  private destructibleFactory: DestructibleObjectFactory;
  private environmentManager: EnvironmentManager;

  /** Mesh created for the ground this level. Stored so clearLevel() can dispose it. */
  private groundMesh?: BABYLON.Mesh;

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

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Build a complete level from a LevelLayout descriptor.
   * Call clearLevel() first if rebuilding mid-game.
   */
  public buildLevel(layout: LevelLayout): void {
    console.log(`LevelGenerator: building level ${layout.roundNumber} – "${layout.name}"`);

    // 1. Sky colour
    this.scene.clearColor = layout.skyColor;

    // 2. Ground
    this.buildGround(layout);

    // 3. Destructible objects
    this.spawnObjects(layout);

    // 4. Environment props
    this.spawnProps(layout);

    console.log(
      `LevelGenerator: level "${layout.name}" ready – ` +
      `${layout.objects.length} destructibles, ${layout.props.length} props`,
    );
  }

  /**
   * Remove all level geometry.  Call before building the next level.
   * DestructibleObjectFactory and EnvironmentManager handle their own cleanup.
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

  // -------------------------------------------------------------------------
  // Private builders
  // -------------------------------------------------------------------------

  private buildGround(layout: LevelLayout): void {
    const { groundY, groundAngle, groundSize } = layout;

    const ground = BABYLON.MeshBuilder.CreateBox(
      'ground',
      { width: groundSize.width, height: 1, depth: groundSize.depth },
      this.scene,
    );

    ground.position = new BABYLON.Vector3(0, groundY, 0);
    ground.rotation.z = groundAngle;
    ground.receiveShadows = true;

    // Grass-toned PBR material
    const mat = new BABYLON.PBRMetallicRoughnessMaterial('groundMat', this.scene);
    mat.baseColor = layout.groundLightColor;
    mat.metallic = 0.0;
    mat.roughness = 0.9;
    ground.material = mat;

    this.physicsManager.addGroundPlane(ground);
    this.groundMesh = ground;
  }

  private spawnObjects(layout: LevelLayout): void {
    for (const spawn of layout.objects) {
      const obj = this.destructibleFactory.create({
        shape: spawn.shape,
        material: spawn.material,
        position: spawn.position,
        scale: spawn.scale ?? 1.0,
      });

      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(obj.mesh);
      }
    }
  }

  private spawnProps(layout: LevelLayout): void {
    for (const prop of layout.props) {
      switch (prop.type) {
        case 'barrier':
          this.environmentManager.spawnBarrier(prop.position, prop.rotation, prop.scale);
          break;

        case 'ramp':
          this.environmentManager.spawnRamp(prop.position, prop.rotation, prop.scale);
          break;

        case 'post': {
          // Height may be embedded as an extra field on the spawn descriptor
          const height = (prop as LevelPropSpawn & { height?: number }).height;
          this.environmentManager.spawnPost(prop.position, prop.rotation, height);
          break;
        }

        case 'box': {
          const boxColor = prop.color ?? new BABYLON.Color3(0.6, 0.4, 0.2);
          this.environmentManager.spawnBox(
            `levelBox_${layout.roundNumber}_${this.environmentManager.getSpawnedProps().length}`,
            prop.position,
            boxColor,
            prop.scale,
            prop.rotation,
          );
          break;
        }
      }
    }
  }
}
