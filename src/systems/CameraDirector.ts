import * as BABYLON from '@babylonjs/core';
import { CameraType, CameraConfig } from '../types';

/**
 * CameraDirector — AI-driven camera system that creates cinematic shots.
 *
 * Enhancements over the original:
 * - Velocity-aware interest scoring: fast-moving tires get more dramatic angles
 * - Dynamic FOV: widens as the tire accelerates for a speed sensation
 * - Subtle camera roll during fast lateral movement (Dutch tilt)
 * - Per-camera-type smoothing factors (drone is lazy, GoPro is snappy)
 * - Rack-focus: exposes focus distance so ScreenEffects can drive DOF
 */
export class CameraDirector {
  private camera: BABYLON.UniversalCamera;
  private _scene: BABYLON.Scene;
  private activeCameraType: CameraType = CameraType.DRONE;
  private followTarget?: BABYLON.TransformNode;

  private currentOffset: BABYLON.Vector3 = new BABYLON.Vector3(0, 5, 10);
  private targetOffset: BABYLON.Vector3 = new BABYLON.Vector3(0, 5, 10);

  private lastSwitchTime: number = 0;
  private lastTargetPosition: BABYLON.Vector3 = BABYLON.Vector3.Zero();
  private targetVelocity: BABYLON.Vector3 = BABYLON.Vector3.Zero();   // m/s estimate
  private targetSpeed: number = 0;  // scalar m/s

  // Smoothed focus distance (metres) for rack-focus DOF
  public focusDistance: number = 12;

  // Virtual cameras configuration
  private cameraConfigs: Map<CameraType, CameraConfig & { smoothing: number; baseFov: number }> = new Map([
    [
      CameraType.LAUNCH,
      {
        type: CameraType.LAUNCH,
        offset: new BABYLON.Vector3(-6, 4, 10),
        fov: 60,
        baseFov: 60,
        interestScore: 0,
        minHoldTime: 2,
        canInterrupt: false,
        smoothing: 0.07,
      },
    ],
    [
      CameraType.DRONE,
      {
        type: CameraType.DRONE,
        offset: new BABYLON.Vector3(0, 5, 10),
        fov: 72,
        baseFov: 72,
        interestScore: 0,
        minHoldTime: 2,
        canInterrupt: true,
        smoothing: 0.06, // lazy, cinematic
      },
    ],
    [
      CameraType.GOPRO,
      {
        type: CameraType.GOPRO,
        offset: new BABYLON.Vector3(2.5, 1.2, 3.5),
        fov: 95,
        baseFov: 95,
        interestScore: 0,
        minHoldTime: 1.5,
        canInterrupt: true,
        smoothing: 0.14, // snappy action-cam feel
      },
    ],
    [
      CameraType.OVERHEAD,
      {
        type: CameraType.OVERHEAD,
        offset: new BABYLON.Vector3(0, 22, 2),
        fov: 55,
        baseFov: 55,
        interestScore: 0,
        minHoldTime: 3,
        canInterrupt: true,
        smoothing: 0.05, // very smooth overhead sweep
      },
    ],
    [
      CameraType.HERO_TIRE,
      {
        type: CameraType.HERO_TIRE,
        offset: new BABYLON.Vector3(0, 0.6, 2.2),
        fov: 88,
        baseFov: 88,
        interestScore: 0,
        minHoldTime: 1,
        canInterrupt: false,
        smoothing: 0.18, // tight, reactive mount
      },
    ],
  ]);

  constructor(camera: BABYLON.UniversalCamera, scene: BABYLON.Scene) {
    this.camera = camera;
    this._scene = scene;
    console.log('🎬 Camera Director initialized');
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  public setFollowTarget(target: BABYLON.TransformNode): void {
    this.followTarget = target;
    this.lastTargetPosition = target.position.clone();
    this.activeCameraType = CameraType.LAUNCH;
    this.lastSwitchTime = performance.now();

    setTimeout(() => {
      this.activeCameraType = CameraType.DRONE;
      this.lastSwitchTime = performance.now();
    }, 2000);

    console.log('🎯 Camera following target');
  }

  public switchCamera(cameraType: CameraType): void {
    if (cameraType === this.activeCameraType) return;
    const cfg = this.cameraConfigs.get(cameraType);
    if (!cfg) return;
    console.log(`🎥 Switching to ${cameraType} camera`);
    this.activeCameraType = cameraType;
    this.lastSwitchTime = performance.now();
    this.targetOffset = cfg.offset.clone();
  }

  public getCurrentCameraType(): CameraType {
    return this.activeCameraType;
  }

  public update(deltaTime: number): void {
    if (!this.followTarget) return;

    // Estimate target velocity from position delta
    const currentPos = this.followTarget.position.clone();
    if (deltaTime > 0) {
      const delta = currentPos.subtract(this.lastTargetPosition).scale(1 / deltaTime);
      // Smooth velocity estimate to reduce noise
      BABYLON.Vector3.LerpToRef(this.targetVelocity, delta, 0.25, this.targetVelocity);
      this.targetSpeed = this.targetVelocity.length();
    }
    this.lastTargetPosition = currentPos.clone();

    // Smooth offset transition (used by camera follow)
    const cfg = this.cameraConfigs.get(this.activeCameraType);
    if (cfg) {
      BABYLON.Vector3.LerpToRef(this.currentOffset, cfg.offset, 0.04, this.currentOffset);
    }

    this.updateFollowCamera(deltaTime);
  }

  public reset(): void {
    this.followTarget = undefined;
    this.activeCameraType = CameraType.DRONE;
    this.targetSpeed = 0;
    this.targetVelocity = BABYLON.Vector3.Zero();
    this.camera.position.set(0, 12, 22);
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.rotation.z = 0; // Clear roll
    this.camera.fov = (72 * Math.PI) / 180;
  }

  public setAutoSwitch(_enabled: boolean): void {
    // Reserved for future AI-directed auto-switching
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  /**
   * Compute velocity-aware interest score.
   * Faster tire = more interesting; camera variety is rewarded.
   */
  private calculateInterestScore(cameraType: CameraType): number {
    if (!this.followTarget) return 0;
    const cfg = this.cameraConfigs.get(cameraType);
    if (!cfg) return 0;

    let score = 0;

    // Speed bonus — fast tire is exciting
    score += Math.min(this.targetSpeed * 1.5, 30);

    // Proximity to world origin (more props in centre)
    const distFromOrigin = this.followTarget.position.length();
    score += Math.max(0, 15 - distFromOrigin * 0.5);

    // Variety bonus
    if (cameraType !== this.activeCameraType) score += 6;

    // Penalise very recent switches
    const timeSince = (performance.now() - this.lastSwitchTime) / 1000;
    if (timeSince < cfg.minHoldTime) score *= 0.25;

    return score;
  }

  /**
   * Choose the highest-scoring camera type.
   */
  private _selectBestCamera(): CameraType {
    let best = this.activeCameraType;
    let bestScore = this.calculateInterestScore(this.activeCameraType);
    this.cameraConfigs.forEach((_c, type) => {
      const s = this.calculateInterestScore(type);
      if (s > bestScore) { bestScore = s; best = type; }
    });
    return best;
  }

  /**
   * Update camera position, look-at, FOV, and subtle roll each frame.
   * Includes terrain collision detection to prevent camera going through ground.
   */
  private updateFollowCamera(_deltaTime: number): void {
    if (!this.followTarget) return;

    const cfg = this.cameraConfigs.get(this.activeCameraType);
    if (!cfg) return;

    const targetPosition = new BABYLON.Vector3();
    const lookAtPos = this.followTarget.position.clone();

    // ── Compute desired camera world position ───────────────────────────────
    switch (this.activeCameraType) {
      case CameraType.OVERHEAD:
        targetPosition.copyFrom(this.followTarget.position);
        targetPosition.y += cfg.offset.y;
        targetPosition.x += cfg.offset.x;
        targetPosition.z += cfg.offset.z;
        break;

      case CameraType.HERO_TIRE:
        targetPosition.copyFrom(this.followTarget.position);
        targetPosition.addInPlace(cfg.offset);
        break;

      case CameraType.GOPRO:
        // Slightly forward of the tire to mimic a mount on the tread
        targetPosition.copyFrom(this.followTarget.position);
        targetPosition.addInPlace(cfg.offset);
        break;

      default:
        // DRONE / LAUNCH — behind and above the tire
        targetPosition.copyFrom(this.followTarget.position);
        targetPosition.addInPlace(cfg.offset);
        break;
    }

    // ── Terrain collision detection ─────────────────────────────────────────
    // Raycast from target to desired camera position to check for terrain
    const rayOrigin = this.followTarget.position.clone();
    rayOrigin.y += 0.5; // Start slightly above target center
    const rayDirection = targetPosition.subtract(rayOrigin).normalize();
    const rayLength = BABYLON.Vector3.Distance(rayOrigin, targetPosition);

    const ray = new BABYLON.Ray(rayOrigin, rayDirection, rayLength);
    const hit = this._scene.pickWithRay(ray, (mesh) => {
      // Only check against terrain mesh
      return mesh.name === 'terrain';
    });

    if (hit && hit.hit && hit.pickedPoint) {
      // Terrain is in the way - place camera closer to target
      const hitDistance = BABYLON.Vector3.Distance(rayOrigin, hit.pickedPoint!);
      const safeDistance = Math.max(2, hitDistance - 0.5); // Stay 0.5m away from terrain, min 2m
      
      // Only adjust if the hit is between target and desired camera position
      if (safeDistance < rayLength) {
        targetPosition.copyFrom(rayOrigin.add(rayDirection.scale(safeDistance)));
        // Ensure camera stays above ground
        targetPosition.y = Math.max(targetPosition.y, hit.pickedPoint!.y + 1.0);
      }
    }

    // ── Smooth camera position ──────────────────────────────────────────────
    BABYLON.Vector3.LerpToRef(
      this.camera.position,
      targetPosition,
      cfg.smoothing,
      this.camera.position,
    );

    // ── Look-at with slight lead — aim slightly ahead of travel direction ───
    const leadAmount = 0.4;
    lookAtPos.addInPlace(this.targetVelocity.scale(leadAmount));
    this.camera.setTarget(lookAtPos);

    // ── Dynamic FOV — widen as tire goes faster (speed sensation) ───────────
    const speedNorm = Math.min(this.targetSpeed / 25, 1.0); // 25 m/s = max speed
    const fovBoost = speedNorm * 18; // Up to +18° at full speed
    const targetFovDeg = cfg.baseFov + fovBoost;
    const targetFovRad = (targetFovDeg * Math.PI) / 180;
    this.camera.fov += (targetFovRad - this.camera.fov) * 0.08;

    // ── Subtle Dutch tilt — roll slightly into fast lateral movement ─────────
    if (this.activeCameraType === CameraType.DRONE || this.activeCameraType === CameraType.GOPRO) {
      const lateralSpeed = this.targetVelocity.z; // +Z = right
      const targetRoll = Math.max(-0.08, Math.min(0.08, lateralSpeed * 0.004));
      this.camera.rotation.z += (targetRoll - this.camera.rotation.z) * 0.06;
    } else {
      // Restore roll for other cameras
      this.camera.rotation.z += (0 - this.camera.rotation.z) * 0.1;
    }

    // ── Rack-focus: expose smoothed focus distance for ScreenEffects/DOF ────
    const distToTarget = BABYLON.Vector3.Distance(this.camera.position, this.followTarget.position);
    this.focusDistance += (distToTarget - this.focusDistance) * 0.05;
  }
}
