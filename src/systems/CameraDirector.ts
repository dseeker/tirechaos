import * as BABYLON from '@babylonjs/core';
import { CameraType, CameraConfig } from '../types';

/**
 * CameraDirector - AI-driven camera system that creates cinematic shots
 * This is a flagship feature that makes every moment feel like an action movie
 * Now with Babylon.js cameras!
 */
export class CameraDirector {
  private camera: BABYLON.UniversalCamera;
  private _scene: BABYLON.Scene;
  private activeCameraType: CameraType = CameraType.DRONE;
  private followTarget?: BABYLON.TransformNode;
  private currentOffset: BABYLON.Vector3 = new BABYLON.Vector3(0, 5, 10);
  private targetOffset: BABYLON.Vector3 = new BABYLON.Vector3(0, 5, 10);
  private lastSwitchTime: number = 0;
  private smoothing: number = 0.1;

  // Virtual cameras configuration
  private cameraConfigs: Map<CameraType, CameraConfig> = new Map([
    [
      CameraType.LAUNCH,
      {
        type: CameraType.LAUNCH,
        offset: new BABYLON.Vector3(-5, 3, 8),
        fov: 65,
        interestScore: 0,
        minHoldTime: 2,
        canInterrupt: false,
      },
    ],
    [
      CameraType.DRONE,
      {
        type: CameraType.DRONE,
        offset: new BABYLON.Vector3(0, 3, 8),
        fov: 75,
        interestScore: 0,
        minHoldTime: 2,
        canInterrupt: true,
      },
    ],
    [
      CameraType.GOPRO,
      {
        type: CameraType.GOPRO,
        offset: new BABYLON.Vector3(2, 1, 3),
        fov: 90,
        interestScore: 0,
        minHoldTime: 1.5,
        canInterrupt: true,
      },
    ],
    [
      CameraType.OVERHEAD,
      {
        type: CameraType.OVERHEAD,
        offset: new BABYLON.Vector3(0, 20, 0),
        fov: 60,
        interestScore: 0,
        minHoldTime: 3,
        canInterrupt: true,
      },
    ],
    [
      CameraType.HERO_TIRE,
      {
        type: CameraType.HERO_TIRE,
        offset: new BABYLON.Vector3(0, 0.5, 2),
        fov: 85,
        interestScore: 0,
        minHoldTime: 1,
        canInterrupt: false,
      },
    ],
  ]);

  constructor(camera: BABYLON.UniversalCamera, scene: BABYLON.Scene) {
    this.camera = camera;
    this._scene = scene;

    console.log('🎬 Camera Director initialized');
  }

  /**
   * Set the target for camera to follow
   */
  public setFollowTarget(target: BABYLON.TransformNode): void {
    this.followTarget = target;
    this.activeCameraType = CameraType.LAUNCH;
    this.lastSwitchTime = performance.now();

    // After 2 seconds, switch to drone camera
    setTimeout(() => {
      this.activeCameraType = CameraType.DRONE;
    }, 2000);

    console.log(`🎯 Camera following target`);
  }

  /**
   * Calculate interest score for a camera type
   * Higher score = more interesting/dramatic shot
   */
  private calculateInterestScore(cameraType: CameraType): number {
    if (!this.followTarget) return 0;

    let score = 0;
    const _config = this.cameraConfigs.get(cameraType);
    if (!_config) return 0;

    // Proximity to collision (would need physics prediction)
    // For now, use distance from origin as proxy
    const distanceFromOrigin = this.followTarget.position.length();
    score += Math.max(0, 20 - distanceFromOrigin);

    // Velocity (if target has velocity data)
    // This would be enhanced with actual velocity tracking
    score += 10;

    // Camera variety bonus
    if (cameraType !== this.activeCameraType) {
      score += 5;
    }

    // Time since last switch
    const timeSinceSwitch = (performance.now() - this.lastSwitchTime) / 1000;
    if (timeSinceSwitch < _config.minHoldTime) {
      score *= 0.3; // Penalize recent switches
    }

    return score;
  }

  /**
   * Update camera position to follow target smoothly
   */
  private updateFollowCamera(_deltaTime: number): void {
    if (!this.followTarget) return;

    const _config = this.cameraConfigs.get(this.activeCameraType);
    if (!_config) return;

    // Calculate target position based on camera type
    const targetPosition = new BABYLON.Vector3();
    const lookAtPosition = this.followTarget.position.clone();

    switch (this.activeCameraType) {
      case CameraType.OVERHEAD:
        // Directly above
        targetPosition.copyFrom(this.followTarget.position);
        targetPosition.y += _config.offset.y;
        break;

      case CameraType.HERO_TIRE:
        // Close follow
        targetPosition.copyFrom(this.followTarget.position);
        targetPosition.addInPlace(_config.offset);
        break;

      case CameraType.DRONE:
      case CameraType.LAUNCH:
      default:
        // Behind and above
        targetPosition.copyFrom(this.followTarget.position);
        targetPosition.addInPlace(_config.offset);
        break;
    }

    // Smooth camera movement
    BABYLON.Vector3.LerpToRef(this.camera.position, targetPosition, this.smoothing, this.camera.position);

    // Look at target smoothly
    this.camera.setTarget(lookAtPosition);

    // Update FOV if needed (convert FOV degrees to radians for Babylon)
    const targetFovRadians = (_config.fov * Math.PI) / 180;
    if (Math.abs(this.camera.fov - targetFovRadians) > 0.01) {
      this.camera.fov += (targetFovRadians - this.camera.fov) * 0.1;
    }
  }

  /**
   * AI director logic - decide which camera to use
   * This is simplified for MVP - full implementation would be more sophisticated
   */
  private _selectBestCamera(): CameraType {
    let bestCamera = this.activeCameraType;
    let bestScore = this.calculateInterestScore(this.activeCameraType);

    // Evaluate all camera types
    this.cameraConfigs.forEach((_config, cameraType) => {
      const score = this.calculateInterestScore(cameraType);
      if (score > bestScore) {
        bestScore = score;
        bestCamera = cameraType;
      }
    });

    return bestCamera;
  }

  /**
   * Switch to a different camera type
   */
  public switchCamera(cameraType: CameraType): void {
    if (cameraType === this.activeCameraType) return;

    const _config = this.cameraConfigs.get(cameraType);
    if (!_config) return;

    console.log(`🎥 Switching to ${cameraType} camera`);

    this.activeCameraType = cameraType;
    this.lastSwitchTime = performance.now();
    this.targetOffset = _config.offset.clone();
  }

  /**
   * Get current camera type
   */
  public getCurrentCameraType(): CameraType {
    return this.activeCameraType;
  }

  /**
   * Update camera director
   */
  public update(deltaTime: number): void {
    if (this.followTarget) {
      this.updateFollowCamera(deltaTime);
    }

    // Smooth offset transition
    BABYLON.Vector3.LerpToRef(this.currentOffset, this.targetOffset, 0.05, this.currentOffset);
  }

  /**
   * Reset camera to default position
   */
  public reset(): void {
    this.followTarget = undefined;
    this.activeCameraType = CameraType.DRONE;
    this.camera.position.set(0, 10, 20);
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.fov = (75 * Math.PI) / 180; // Convert to radians
  }

  /**
   * Enable/disable auto camera switching
   */
  public setAutoSwitch(enabled: boolean): void {
    // Future enhancement: auto-switch based on AI scoring
    console.log(`Auto camera switching ${enabled ? 'enabled' : 'disabled'}`);
  }
}
