import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';

/**
 * Core game types and interfaces - Updated for Babylon.js
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
  color: BABYLON.Color3;
  materialConfig: PBRMaterialConfig;
}

export interface PBRMaterialConfig {
  baseColor: BABYLON.Color3;
  metallic: number;
  roughness: number;
  bumpTextureUrl?: string;
  emissiveColor?: BABYLON.Color3;
}

export interface DestructibleObjectConfig {
  mesh: BABYLON.Mesh;
  body: CANNON.Body;
  health: number;
  points: number;
  breakForce: number;
}

export interface CameraConfig {
  type: CameraType;
  offset: BABYLON.Vector3;
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
  position: BABYLON.Vector3;
  velocity: BABYLON.Vector3;
  time: number;
}

export interface InputState {
  isDragging: boolean;
  startPosition: BABYLON.Vector2;
  currentPosition: BABYLON.Vector2;
  power: number;
  angle: number;
}

export interface ComboChain {
  count: number;
  multiplier: number;
  lastHitTime: number;
  timeWindow: number;
}

export interface PostProcessingConfig {
  bloom: {
    enabled: boolean;
    threshold: number;
    weight: number;
    kernel: number;
  };
  ssao: {
    enabled: boolean;
    radius: number;
    totalStrength: number;
  };
  motionBlur: {
    enabled: boolean;
    motionStrength: number;
  };
  depthOfField: {
    enabled: boolean;
    focalLength: number;
    fStop: number;
  };
  chromaticAberration: {
    enabled: boolean;
    aberrationAmount: number;
  };
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
    color: BABYLON.Color3.FromHexString('#2d3142'),
    materialConfig: {
      baseColor: BABYLON.Color3.FromHexString('#2d3142'),
      metallic: 0.0,
      roughness: 0.9,
    },
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
    color: BABYLON.Color3.FromHexString('#4a4a4a'),
    materialConfig: {
      baseColor: BABYLON.Color3.FromHexString('#4a4a4a'),
      metallic: 0.1,
      roughness: 0.85,
    },
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
    color: BABYLON.Color3.FromHexString('#1a1a1a'),
    materialConfig: {
      baseColor: BABYLON.Color3.FromHexString('#1a1a1a'),
      metallic: 0.0,
      roughness: 0.95,
    },
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
    color: BABYLON.Color3.FromHexString('#3d3d3d'),
    materialConfig: {
      baseColor: BABYLON.Color3.FromHexString('#3d3d3d'),
      metallic: 0.0,
      roughness: 0.8,
    },
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
    color: BABYLON.Color3.FromHexString('#555555'),
    materialConfig: {
      baseColor: BABYLON.Color3.FromHexString('#555555'),
      metallic: 0.0,
      roughness: 0.85,
    },
  },
};

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: -9.82,
  timeStep: 1 / 60,
  maxSubSteps: 8,   // handles frames slower than 60fps without slow-motion physics
  solverIterations: 20, // 20+ needed for stable cylinder-on-heightfield contact
};

export const DEFAULT_POSTPROCESSING_CONFIG: PostProcessingConfig = {
  bloom: {
    enabled: true,
    threshold: 0.8,
    weight: 0.3,
    kernel: 64,
  },
  ssao: {
    enabled: true,
    radius: 2.0,
    totalStrength: 1.3,
  },
  motionBlur: {
    enabled: true,
    motionStrength: 0.5,
  },
  depthOfField: {
    enabled: false, // Enable for cinematic shots
    focalLength: 50,
    fStop: 1.4,
  },
  chromaticAberration: {
    enabled: true,
    aberrationAmount: 0.5,
  },
};
