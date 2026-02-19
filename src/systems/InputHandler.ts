import * as BABYLON from '@babylonjs/core';
import { InputState, TrajectoryPoint } from '../types';
import { GameManager } from '../core/GameManager';

/**
 * InputHandler - Manages user input for aiming and launching tires
 */
export class InputHandler {
  private gameManager: GameManager;
  private inputState: InputState = {
    isDragging: false,
    startPosition: new BABYLON.Vector2(),
    currentPosition: new BABYLON.Vector2(),
    power: 0,
    angle: 45,
  };

  private trajectoryLine?: BABYLON.LinesMesh;
  private trajectoryPoints: TrajectoryPoint[] = [];
  private maxPower: number = 1.0;
  private maxDragDistance: number = 200; // pixels

  constructor(gameManager: GameManager) {
    this.gameManager = gameManager;
    this.setupEventListeners();
    this.createTrajectoryLine();

    console.log('🎮 Input handler initialized');
  }

  /**
   * Setup mouse/touch event listeners
   */
  private setupEventListeners(): void {
    const canvas = this.gameManager.engine.getRenderingCanvas()!;

    // Mouse events
    canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
    canvas.addEventListener('mousemove', this.onPointerMove.bind(this));
    canvas.addEventListener('mouseup', this.onPointerUp.bind(this));

    // Touch events for mobile
    canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
    canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
    canvas.addEventListener('touchend', this.onTouchEnd.bind(this));

    // Keyboard shortcuts
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  /**
   * Create trajectory prediction line
   */
  private createTrajectoryLine(): void {
    // Babylon LinesMesh will be created dynamically when we have points
    // For now, just prepare the trajectory points array
    this.trajectoryPoints = [];
  }

  /**
   * Handle pointer down (mouse/touch start)
   */
  private onPointerDown(event: MouseEvent): void {
    this.inputState.isDragging = true;
    this.inputState.startPosition.set(event.clientX, event.clientY);
    this.inputState.currentPosition.set(event.clientX, event.clientY);

    // Show trajectory indicator
    this.showTrajectoryIndicator(true);
  }

  /**
   * Handle pointer move (mouse/touch move)
   */
  private onPointerMove(event: MouseEvent): void {
    if (!this.inputState.isDragging) return;

    this.inputState.currentPosition.set(event.clientX, event.clientY);

    // Calculate power and angle
    this.updateAimingParameters();

    // Update trajectory prediction
    this.updateTrajectoryPrediction();

    // Update UI
    this.updateAimingUI();
  }

  /**
   * Handle pointer up (mouse/touch end)
   */
  private onPointerUp(_event: MouseEvent): void {
    if (!this.inputState.isDragging) return;

    this.inputState.isDragging = false;

    // Launch tire with calculated power and angle
    if (this.inputState.power > 0.1) {
      this.gameManager.launchTire(this.inputState.power, this.inputState.angle);
    }

    // Hide trajectory
    this.showTrajectoryIndicator(false);
    if (this.trajectoryLine) {
      this.trajectoryLine.isVisible = false;
    }
  }

  /**
   * Touch event handlers
   */
  private onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    this.onPointerDown(touch as any);
  }

  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    this.onPointerMove(touch as any);
  }

  private onTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.onPointerUp({} as MouseEvent);
  }

  /**
   * Handle keyboard input
   */
  private onKeyDown(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
      case 'r':
        this.gameManager.resetLevel();
        break;
      case 'p':
        if (this.gameManager.gameState.isPaused) {
          this.gameManager.resume();
        } else {
          this.gameManager.pause();
        }
        break;
      case ' ':
        // Quick launch: moderate speed, straight downhill
        event.preventDefault();
        this.gameManager.launchTire(0.5, 0);
        break;
    }
  }

  /**
   * Update aiming parameters based on drag.
   *
   * The camera now looks downhill (+X world direction), so:
   *   - Horizontal screen drag (delta.x) → left/right deviation direction (±45°)
   *   - Total drag distance              → initial roll speed (0–1)
   */
  private updateAimingParameters(): void {
    const delta = this.inputState.currentPosition.subtract(this.inputState.startPosition);

    // Speed: total drag distance, normalised to [0, 1]
    const dragDistance = delta.length();
    this.inputState.power = Math.min(dragDistance / this.maxDragDistance, this.maxPower);

    // Direction: horizontal drag maps to ±45° from straight downhill
    // Positive delta.x (drag right) → positive direction (+Z, right of hill)
    const maxHorizontalDrag = this.maxDragDistance * 0.7;
    const direction = Math.max(-45, Math.min(45,
      (delta.x / maxHorizontalDrag) * 45
    ));
    this.inputState.angle = direction;
  }

  /**
   * Update trajectory prediction
   */
  private updateTrajectoryPrediction(): void {
    this.trajectoryPoints = this.calculateTrajectory(
      new BABYLON.Vector3(-15, 2, 0), // Launch position
      this.inputState.power,
      this.inputState.angle,
    );

    // Dispose old trajectory line
    if (this.trajectoryLine) {
      this.trajectoryLine.dispose();
    }

    // Create new trajectory line if we have points
    if (this.trajectoryPoints.length >= 2) {
      const points = this.trajectoryPoints.map((tp) => tp.position);

      this.trajectoryLine = BABYLON.MeshBuilder.CreateLines(
        'trajectoryLine',
        {
          points: points,
          updatable: true,
        },
        this.gameManager.scene,
      );

      this.trajectoryLine.color = new BABYLON.Color3(1, 1, 0); // Yellow
      this.trajectoryLine.alpha = 0.6;
      this.trajectoryLine.isVisible = true;
    }
  }

  /**
   * Calculate trajectory points using projectile motion
   */
  private calculateTrajectory(
    startPosition: BABYLON.Vector3,
    power: number,
    angle: number,
  ): TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];
    const launchSpeed = power * 30;
    const angleRad = (angle * Math.PI) / 180;
    const gravity = -9.82;
    const timeStep = 0.1;
    const maxTime = 3;

    const velocity = new BABYLON.Vector3(
      Math.cos(angleRad) * launchSpeed,
      Math.sin(angleRad) * launchSpeed,
      0,
    );

    let position = startPosition.clone();
    let currentVelocity = velocity.clone();

    for (let t = 0; t < maxTime; t += timeStep) {
      points.push({
        position: position.clone(),
        velocity: currentVelocity.clone(),
        time: t,
      });

      // Update velocity (gravity)
      currentVelocity.y += gravity * timeStep;

      // Update position
      position.addInPlace(currentVelocity.scale(timeStep));

      // Stop if hit ground
      if (position.y < -5) break;

      // Limit number of points
      if (points.length > 50) break;
    }

    return points;
  }

  /**
   * Show/hide trajectory indicator UI
   */
  private showTrajectoryIndicator(show: boolean): void {
    const indicator = document.getElementById('trajectory-indicator');
    if (indicator) {
      if (show) {
        indicator.classList.remove('hidden');
      } else {
        indicator.classList.add('hidden');
      }
    }
  }

  /**
   * Update aiming UI with current values
   */
  private updateAimingUI(): void {
    const powerEl = document.getElementById('power-value');
    const angleEl = document.getElementById('angle-value');

    if (powerEl) {
      powerEl.textContent = `${Math.round(this.inputState.power * 100)}%`;
    }

    if (angleEl) {
      angleEl.textContent = `${Math.round(this.inputState.angle)}°`;
    }
  }

  /**
   * Get current input state
   */
  public getInputState(): InputState {
    return { ...this.inputState };
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    const canvas = this.gameManager.engine.getRenderingCanvas()!;

    canvas.removeEventListener('mousedown', this.onPointerDown.bind(this));
    canvas.removeEventListener('mousemove', this.onPointerMove.bind(this));
    canvas.removeEventListener('mouseup', this.onPointerUp.bind(this));
    canvas.removeEventListener('touchstart', this.onTouchStart.bind(this));
    canvas.removeEventListener('touchmove', this.onTouchMove.bind(this));
    canvas.removeEventListener('touchend', this.onTouchEnd.bind(this));
    window.removeEventListener('keydown', this.onKeyDown.bind(this));

    if (this.trajectoryLine) {
      this.trajectoryLine.dispose();
    }
  }
}
