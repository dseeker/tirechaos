import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Core game types and interfaces
 */

export interface TireProperties {
  mass: number;
  radius: number;
  width: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
}

export enum TireType {
  STANDARD = 'standard',
  MONSTER_TRUCK = 'monster_truck',
  RACING_SLICK = 'racing_slick',
  TRACTOR = 'tractor',
  SPARE = 'spare',
}

export interface TireConfig {
  type: TireType;
  properties: TireProperties;
  color: number;
}

export interface DestructibleObjectConfig {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  health: number;
  points: number;
  breakForce: number;
}

export interface CameraConfig {
  type: CameraType;
  offset: THREE.Vector3;
  fov: number;
  interestScore: number;
  minHoldTime: number;
  canInterrupt: boolean;
}

export enum CameraType {
  LAUNCH = 'launch',
  DRONE = 'drone',
  GOPRO = 'gopro',
  OVERHEAD = 'overhead',
  HERO_TIRE = 'hero_tire',
  REPLAY = 'replay',
}

export interface ScoreEvent {
  type: 'object_destroyed' | 'combo' | 'style' | 'distance';
  points: number;
  multiplier: number;
  timestamp: number;
}

export interface GameState {
  score: number;
  combo: number;
  tiresRemaining: number;
  objectsDestroyed: number;
  level: number;
  isPaused: boolean;
  isGameOver: boolean;
}

export interface PhysicsConfig {
  gravity: number;
  timeStep: number;
  maxSubSteps: number;
  solverIterations: number;
}

export interface LevelConfig {
  name: string;
  world: number;
  hillAngle: number;
  startingTires: number;
  targetScore: number;
  objectives: LevelObjective[];
  destructibles: DestructibleObjectConfig[];
}

export interface LevelObjective {
  description: string;
  type: 'score' | 'destroy_all' | 'time_limit' | 'combo';
  target: number;
  completed: boolean;
}

export interface TrajectoryPoint {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  time: number;
}

export interface InputState {
  isDragging: boolean;
  startPosition: THREE.Vector2;
  currentPosition: THREE.Vector2;
  power: number;
  angle: number;
}

export interface ComboChain {
  count: number;
  multiplier: number;
  lastHitTime: number;
  timeWindow: number;
}

// Constants
export const TIRE_CONFIGS: Record<TireType, TireConfig> = {
  [TireType.STANDARD]: {
    type: TireType.STANDARD,
    properties: {
      mass: 20,
      radius: 0.4,
      width: 0.25,
      friction: 0.8,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.05,
    },
    color: 0x2d3142,
  },
  [TireType.MONSTER_TRUCK]: {
    type: TireType.MONSTER_TRUCK,
    properties: {
      mass: 50,
      radius: 0.8,
      width: 0.5,
      friction: 0.9,
      restitution: 0.2,
      linearDamping: 0.15,
      angularDamping: 0.1,
    },
    color: 0x4a4a4a,
  },
  [TireType.RACING_SLICK]: {
    type: TireType.RACING_SLICK,
    properties: {
      mass: 15,
      radius: 0.35,
      width: 0.2,
      friction: 1.0,
      restitution: 0.1,
      linearDamping: 0.05,
      angularDamping: 0.02,
    },
    color: 0x1a1a1a,
  },
  [TireType.TRACTOR]: {
    type: TireType.TRACTOR,
    properties: {
      mass: 40,
      radius: 0.6,
      width: 0.4,
      friction: 1.2,
      restitution: 0.15,
      linearDamping: 0.2,
      angularDamping: 0.15,
    },
    color: 0x3d3d3d,
  },
  [TireType.SPARE]: {
    type: TireType.SPARE,
    properties: {
      mass: 10,
      radius: 0.25,
      width: 0.15,
      friction: 0.6,
      restitution: 0.6,
      linearDamping: 0.05,
      angularDamping: 0.02,
    },
    color: 0x555555,
  },
};

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: -9.82,
  timeStep: 1 / 60,
  maxSubSteps: 3,
  solverIterations: 10,
};
