import * as BABYLON from '@babylonjs/core';

/**
 * ParticleManager - Creates and manages particle effects for destruction, smoke, impacts
 */
export class ParticleManager {
  private scene: BABYLON.Scene;
  private activeParticleSystems: BABYLON.ParticleSystem[] = [];

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    console.log('💥 Particle Manager initialized');
  }

  /**
   * Create explosion effect
   */
  public createExplosion(position: BABYLON.Vector3, intensity: number = 1.0): void {
    const particleSystem = new BABYLON.ParticleSystem('explosion', 200 * intensity, this.scene);

    // Texture
    particleSystem.particleTexture = new BABYLON.Texture(
      'https://playground.babylonjs.com/textures/flare.png',
      this.scene
    );

    // Position
    particleSystem.emitter = position;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.5);

    // Colors
    particleSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0); // Orange
    particleSystem.color2 = new BABYLON.Color4(1, 0.8, 0, 1.0); // Yellow
    particleSystem.colorDead = new BABYLON.Color4(0.2, 0.2, 0.2, 0.0); // Gray fade

    // Size
    particleSystem.minSize = 0.1 * intensity;
    particleSystem.maxSize = 0.5 * intensity;

    // Life time
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.8;

    // Emission rate
    particleSystem.emitRate = 500 * intensity;

    // Blast radius
    particleSystem.minEmitPower = 5 * intensity;
    particleSystem.maxEmitPower = 10 * intensity;
    particleSystem.updateSpeed = 0.01;

    // Direction
    particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 2, 1);

    // Gravity
    particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);

    // Start and auto-dispose
    particleSystem.start();
    this.activeParticleSystems.push(particleSystem);

    // Auto-stop after burst
    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => {
        particleSystem.dispose();
        this.removeParticleSystem(particleSystem);
      }, 1000);
    }, 100);
  }

  /**
   * Create debris effect
   */
  public createDebris(position: BABYLON.Vector3, color: BABYLON.Color3): void {
    const particleSystem = new BABYLON.ParticleSystem('debris', 50, this.scene);

    // Texture
    particleSystem.particleTexture = new BABYLON.Texture(
      'https://playground.babylonjs.com/textures/flare.png',
      this.scene
    );

    // Position
    particleSystem.emitter = position;

    // Colors
    particleSystem.color1 = new BABYLON.Color4(color.r, color.g, color.b, 1.0);
    particleSystem.color2 = new BABYLON.Color4(color.r * 0.5, color.g * 0.5, color.b * 0.5, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, 0.0);

    // Size
    particleSystem.minSize = 0.05;
    particleSystem.maxSize = 0.2;

    // Life time
    particleSystem.minLifeTime = 0.5;
    particleSystem.maxLifeTime = 1.5;

    // Emission rate
    particleSystem.emitRate = 100;

    // Speed
    particleSystem.minEmitPower = 3;
    particleSystem.maxEmitPower = 8;

    // Direction
    particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 3, 1);

    // Gravity
    particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);

    // Start
    particleSystem.start();
    this.activeParticleSystems.push(particleSystem);

    // Auto-dispose
    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => {
        particleSystem.dispose();
        this.removeParticleSystem(particleSystem);
      }, 2000);
    }, 200);
  }

  /**
   * Create tire smoke trail
   */
  public createTireSmoke(position: BABYLON.Vector3): BABYLON.ParticleSystem {
    const particleSystem = new BABYLON.ParticleSystem('smoke', 100, this.scene);

    // Texture
    particleSystem.particleTexture = new BABYLON.Texture(
      'https://playground.babylonjs.com/textures/flare.png',
      this.scene
    );

    // Position
    particleSystem.emitter = position;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.1, 0, -0.1);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 0, 0.1);

    // Colors (gray smoke)
    particleSystem.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 0.5);
    particleSystem.color2 = new BABYLON.Color4(0.3, 0.3, 0.3, 0.3);
    particleSystem.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, 0.0);

    // Size
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.3;

    // Life time
    particleSystem.minLifeTime = 0.5;
    particleSystem.maxLifeTime = 1.0;

    // Emission rate
    particleSystem.emitRate = 20;

    // Speed
    particleSystem.minEmitPower = 0.5;
    particleSystem.maxEmitPower = 1.5;

    // Direction (upward and outward)
    particleSystem.direction1 = new BABYLON.Vector3(-0.5, 0.5, -0.5);
    particleSystem.direction2 = new BABYLON.Vector3(0.5, 1.5, 0.5);

    // No gravity (smoke floats)
    particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);

    // Start
    particleSystem.start();
    this.activeParticleSystems.push(particleSystem);

    return particleSystem;
  }

  /**
   * Create impact particles for tire-ground collisions (dust/debris) or
   * tire-object collisions (sparks).
   *
   * @param position   World-space collision point
   * @param velocity   Collision velocity magnitude (used to scale intensity)
   * @param isGround   true → dust/debris style; false → spark style
   */
  public createImpactParticles(
    position: BABYLON.Vector3,
    velocity: number,
    isGround: boolean,
  ): void {
    // Clamp intensity to a sensible range (0–1)
    const intensity = Math.min(velocity / 20, 1.0);

    // Skip very soft touches (avoids constant low-velocity noise)
    if (intensity < 0.05) return;

    const particleCount = Math.floor(40 * intensity);
    const systemName = isGround ? 'groundImpact' : 'objectImpact';
    const particleSystem = new BABYLON.ParticleSystem(systemName, particleCount, this.scene);

    particleSystem.particleTexture = new BABYLON.Texture(
      'https://playground.babylonjs.com/textures/flare.png',
      this.scene,
    );

    particleSystem.emitter = position.clone();
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.1, 0, -0.1);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 0, 0.1);

    if (isGround) {
      // Dust / debris — earthy browns and tans
      particleSystem.color1 = new BABYLON.Color4(0.72, 0.57, 0.38, 0.9);
      particleSystem.color2 = new BABYLON.Color4(0.55, 0.42, 0.25, 0.7);
      particleSystem.colorDead = new BABYLON.Color4(0.3, 0.25, 0.15, 0.0);

      particleSystem.minSize = 0.05 + 0.15 * intensity;
      particleSystem.maxSize = 0.15 + 0.4 * intensity;

      particleSystem.minLifeTime = 0.3;
      particleSystem.maxLifeTime = 0.8 + 0.4 * intensity;

      particleSystem.emitRate = Math.floor(200 * intensity);

      particleSystem.minEmitPower = 2 * intensity;
      particleSystem.maxEmitPower = 6 * intensity;

      // Eject mostly sideways and slightly upward — like dirt kicked up
      particleSystem.direction1 = new BABYLON.Vector3(-1.5, 0.5, -1.5);
      particleSystem.direction2 = new BABYLON.Vector3(1.5, 2.0, 1.5);

      // Gravity pulls dust back down
      particleSystem.gravity = new BABYLON.Vector3(0, -6, 0);
    } else {
      // Sparks — bright yellow/white with a hot orange fade
      particleSystem.color1 = new BABYLON.Color4(1.0, 1.0, 0.8, 1.0);
      particleSystem.color2 = new BABYLON.Color4(1.0, 0.6, 0.1, 1.0);
      particleSystem.colorDead = new BABYLON.Color4(0.4, 0.0, 0.0, 0.0);

      particleSystem.minSize = 0.02;
      particleSystem.maxSize = 0.06 + 0.06 * intensity;

      particleSystem.minLifeTime = 0.1;
      particleSystem.maxLifeTime = 0.3 + 0.2 * intensity;

      particleSystem.emitRate = Math.floor(300 * intensity);

      particleSystem.minEmitPower = 4 * intensity;
      particleSystem.maxEmitPower = 10 * intensity;

      // Sparks scatter in a wide cone
      particleSystem.direction1 = new BABYLON.Vector3(-1, 0.2, -1);
      particleSystem.direction2 = new BABYLON.Vector3(1, 2.5, 1);

      // Strong gravity so sparks arc quickly
      particleSystem.gravity = new BABYLON.Vector3(0, -12, 0);
    }

    particleSystem.start();
    this.activeParticleSystems.push(particleSystem);

    // Burst duration: ground impacts linger a little, sparks vanish quickly
    const burstDuration = isGround ? 120 : 60;
    const fadeDuration = isGround ? 900 : 400;

    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => {
        particleSystem.dispose();
        this.removeParticleSystem(particleSystem);
      }, fadeDuration);
    }, burstDuration);

    // Heavy ground hits get a supplemental mud splatter layer
    if (isGround && intensity > 0.35) {
      this.createMudSplash(position.clone(), velocity);
    }
  }

  /**
   * Heavy mud splatter for fast terrain impacts – dark, wet, grimy.
   * Produces two layers: chunky mud blobs + a fine tan mist cloud.
   *
   * @param position   World-space contact point
   * @param velocity   Impact speed magnitude (m/s)
   */
  public createMudSplash(position: BABYLON.Vector3, velocity: number): void {
    const intensity = Math.min(velocity / 15, 1.0);
    if (intensity < 0.15) return;

    const flareUrl = 'https://playground.babylonjs.com/textures/flare.png';

    // ── Chunky mud blobs ────────────────────────────────────────────────────
    const mudPS = new BABYLON.ParticleSystem('mudBlob', Math.floor(30 * intensity), this.scene);
    mudPS.particleTexture = new BABYLON.Texture(flareUrl, this.scene);
    mudPS.emitter    = position.clone();
    mudPS.minEmitBox = new BABYLON.Vector3(-0.15, 0, -0.15);
    mudPS.maxEmitBox = new BABYLON.Vector3( 0.15, 0,  0.15);

    // Dark wet mud colours
    mudPS.color1    = new BABYLON.Color4(0.18, 0.13, 0.07, 1.0); // near-black mud
    mudPS.color2    = new BABYLON.Color4(0.32, 0.22, 0.10, 0.9); // dark brown
    mudPS.colorDead = new BABYLON.Color4(0.12, 0.09, 0.05, 0.0);

    mudPS.minSize = 0.08 + 0.18 * intensity;
    mudPS.maxSize = 0.22 + 0.42 * intensity;

    mudPS.minLifeTime = 0.4;
    mudPS.maxLifeTime = 1.0 + 0.5 * intensity;

    mudPS.emitRate      = Math.floor(140 * intensity);
    mudPS.minEmitPower  = 1.5 * intensity;
    mudPS.maxEmitPower  = 4.5 * intensity;

    // Wide low-arc splatter pattern – mud flings sideways, not straight up
    mudPS.direction1 = new BABYLON.Vector3(-2.0, 0.6, -2.0);
    mudPS.direction2 = new BABYLON.Vector3( 2.0, 2.5,  2.0);
    mudPS.gravity    = new BABYLON.Vector3(0, -14, 0); // heavy, falls fast

    mudPS.start();
    this.activeParticleSystems.push(mudPS);
    setTimeout(() => {
      mudPS.stop();
      setTimeout(() => { mudPS.dispose(); this.removeParticleSystem(mudPS); }, 1200);
    }, 80);

    // ── Fine tan mist cloud ─────────────────────────────────────────────────
    const mistPS = new BABYLON.ParticleSystem('mudMist', Math.floor(20 * intensity), this.scene);
    mistPS.particleTexture = new BABYLON.Texture(flareUrl, this.scene);
    mistPS.emitter = position.clone();

    mistPS.color1    = new BABYLON.Color4(0.52, 0.44, 0.32, 0.65); // dusty tan
    mistPS.color2    = new BABYLON.Color4(0.38, 0.32, 0.22, 0.40);
    mistPS.colorDead = new BABYLON.Color4(0.22, 0.19, 0.14, 0.00);

    mistPS.minSize = 0.06;
    mistPS.maxSize = 0.14 + 0.10 * intensity;

    mistPS.minLifeTime = 0.3;
    mistPS.maxLifeTime = 0.7;

    mistPS.emitRate     = Math.floor(90 * intensity);
    mistPS.minEmitPower = 2.0 * intensity;
    mistPS.maxEmitPower = 5.5 * intensity;

    mistPS.direction1 = new BABYLON.Vector3(-1.5, 0.5, -1.5);
    mistPS.direction2 = new BABYLON.Vector3( 1.5, 3.2,  1.5);
    mistPS.gravity    = new BABYLON.Vector3(0, -5, 0);

    mistPS.start();
    this.activeParticleSystems.push(mistPS);
    setTimeout(() => {
      mistPS.stop();
      setTimeout(() => { mistPS.dispose(); this.removeParticleSystem(mistPS); }, 800);
    }, 60);
  }

  /**
   * Create impact sparks
   */
  public createImpactSparks(position: BABYLON.Vector3, direction: BABYLON.Vector3): void {
    const particleSystem = new BABYLON.ParticleSystem('sparks', 30, this.scene);

    // Texture
    particleSystem.particleTexture = new BABYLON.Texture(
      'https://playground.babylonjs.com/textures/flare.png',
      this.scene
    );

    // Position
    particleSystem.emitter = position;

    // Colors (yellow/white sparks)
    particleSystem.color1 = new BABYLON.Color4(1, 1, 0, 1.0);
    particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0.5, 0, 0, 0.0);

    // Size
    particleSystem.minSize = 0.02;
    particleSystem.maxSize = 0.08;

    // Life time (short-lived sparks)
    particleSystem.minLifeTime = 0.1;
    particleSystem.maxLifeTime = 0.3;

    // Emission rate
    particleSystem.emitRate = 200;

    // Speed
    particleSystem.minEmitPower = 5;
    particleSystem.maxEmitPower = 10;

    // Direction (based on impact direction)
    const reflect = direction.scale(-1);
    particleSystem.direction1 = reflect.add(new BABYLON.Vector3(-1, 0.5, -1));
    particleSystem.direction2 = reflect.add(new BABYLON.Vector3(1, 2, 1));

    // Gravity
    particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);

    // Start
    particleSystem.start();
    this.activeParticleSystems.push(particleSystem);

    // Auto-dispose (very quick)
    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => {
        particleSystem.dispose();
        this.removeParticleSystem(particleSystem);
      }, 500);
    }, 50);
  }

  /**
   * Create combo celebration effect
   */
  public createComboCelebration(position: BABYLON.Vector3, comboLevel: number): void {
    const particleSystem = new BABYLON.ParticleSystem('combo', 100 * comboLevel, this.scene);

    // Texture
    particleSystem.particleTexture = new BABYLON.Texture(
      'https://playground.babylonjs.com/textures/flare.png',
      this.scene
    );

    // Position
    particleSystem.emitter = position;

    // Colors (rainbow based on combo level)
    const colors = [
      { r: 0, g: 1, b: 1 }, // Cyan (2x)
      { r: 0, g: 1, b: 0 }, // Green (3x)
      { r: 1, g: 1, b: 0 }, // Yellow (4x)
      { r: 1, g: 0.5, b: 0 }, // Orange (5x+)
    ];
    const colorIndex = Math.min(comboLevel - 2, colors.length - 1);
    const color = colors[Math.max(0, colorIndex)];

    particleSystem.color1 = new BABYLON.Color4(color.r, color.g, color.b, 1.0);
    particleSystem.color2 = new BABYLON.Color4(color.r * 0.7, color.g * 0.7, color.b * 0.7, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(1, 1, 1, 0.0);

    // Size
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.4;

    // Life time
    particleSystem.minLifeTime = 0.5;
    particleSystem.maxLifeTime = 1.2;

    // Emission rate
    particleSystem.emitRate = 200;

    // Speed
    particleSystem.minEmitPower = 3;
    particleSystem.maxEmitPower = 8;

    // Direction (fountain upward)
    particleSystem.direction1 = new BABYLON.Vector3(-0.5, 2, -0.5);
    particleSystem.direction2 = new BABYLON.Vector3(0.5, 4, 0.5);

    // Gravity
    particleSystem.gravity = new BABYLON.Vector3(0, -5, 0);

    // Start
    particleSystem.start();
    this.activeParticleSystems.push(particleSystem);

    // Auto-dispose
    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => {
        particleSystem.dispose();
        this.removeParticleSystem(particleSystem);
      }, 1500);
    }, 300);
  }

  /**
   * Stop and dispose a specific particle system
   */
  public stopParticleSystem(particleSystem: BABYLON.ParticleSystem): void {
    particleSystem.stop();
    setTimeout(() => {
      particleSystem.dispose();
      this.removeParticleSystem(particleSystem);
    }, 1000);
  }

  /**
   * Remove particle system from active list
   */
  private removeParticleSystem(particleSystem: BABYLON.ParticleSystem): void {
    const index = this.activeParticleSystems.indexOf(particleSystem);
    if (index > -1) {
      this.activeParticleSystems.splice(index, 1);
    }
  }

  /**
   * Stop all particle systems
   */
  public stopAll(): void {
    this.activeParticleSystems.forEach((ps) => {
      ps.stop();
      ps.dispose();
    });
    this.activeParticleSystems = [];
  }

  /**
   * Get active particle count
   */
  public getActiveCount(): number {
    return this.activeParticleSystems.length;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopAll();
  }
}
