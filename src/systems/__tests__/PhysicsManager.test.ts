import * as THREE from 'three';
import { PhysicsManager } from '../PhysicsManager';

describe('PhysicsManager', () => {
  let physicsManager: PhysicsManager;

  beforeEach(() => {
    physicsManager = new PhysicsManager();
  });

  afterEach(() => {
    physicsManager.clear();
  });

  describe('Initialization', () => {
    it('should initialize with correct gravity', () => {
      expect(physicsManager.world.gravity.y).toBe(-9.82);
    });

    it('should have solver configured', () => {
      // @ts-ignore - iterations property exists at runtime
      expect(physicsManager.world.solver.iterations).toBe(10);
    });

    it('should allow sleeping bodies', () => {
      expect(physicsManager.world.allowSleep).toBe(true);
    });
  });

  describe('Ground Plane', () => {
    it('should add ground plane correctly', () => {
      const geometry = new THREE.BoxGeometry(10, 1, 10);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      const body = physicsManager.addGroundPlane(mesh);

      expect(body).toBeDefined();
      expect(body.mass).toBe(0); // Static body
      expect(physicsManager.world.bodies).toContain(body);
    });

    it('should position ground plane at mesh position', () => {
      const geometry = new THREE.BoxGeometry(10, 1, 10);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(5, -10, 3);

      const body = physicsManager.addGroundPlane(mesh);

      expect(body.position.x).toBe(5);
      expect(body.position.y).toBe(-10);
      expect(body.position.z).toBe(3);
    });
  });

  describe('Destructible Objects', () => {
    it('should add destructible object correctly', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      const body = physicsManager.addDestructibleObject(mesh, {
        mass: 5,
        health: 100,
        points: 50,
      });

      expect(body).toBeDefined();
      expect(body.mass).toBe(5);
      expect(physicsManager.world.bodies).toContain(body);
    });

    it('should track destructible objects', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      physicsManager.addDestructibleObject(mesh, {
        mass: 5,
        health: 100,
        points: 50,
      });

      const objects = physicsManager.getDestructibleObjects();
      expect(objects.length).toBe(1);
      expect(objects[0].health).toBe(100);
      expect(objects[0].points).toBe(50);
    });
  });

  describe('Tire Bodies', () => {
    it('should add tire body correctly', () => {
      const geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 16);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      const body = physicsManager.addTireBody(mesh, 0.4, 0.25, 20);

      expect(body).toBeDefined();
      expect(body.mass).toBe(20);
      expect(physicsManager.world.bodies).toContain(body);
    });

    it('should apply tire material properties', () => {
      const geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 16);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      const body = physicsManager.addTireBody(mesh, 0.4, 0.25, 20);

      expect(body.linearDamping).toBe(0.1);
      expect(body.angularDamping).toBe(0.05);
    });
  });

  describe('Physics Simulation', () => {
    it('should update physics world', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, 10, 0);

      physicsManager.addDestructibleObject(mesh, {
        mass: 5,
        health: 100,
        points: 50,
      });

      const initialY = mesh.position.y;

      // Update physics for 1 second
      for (let i = 0; i < 60; i++) {
        physicsManager.update(1 / 60);
      }

      // Object should have fallen due to gravity
      expect(mesh.position.y).toBeLessThan(initialY);
    });

    it('should sync mesh positions with physics bodies', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, 5, 0);

      const body = physicsManager.addDestructibleObject(mesh, {
        mass: 5,
        health: 100,
        points: 50,
      });

      // Manually move physics body
      body.position.set(10, 3, 5);

      physicsManager.update(1 / 60);

      // Mesh should be synced to body position
      expect(mesh.position.x).toBeCloseTo(10, 1);
      expect(mesh.position.y).toBeCloseTo(3, 1);
      expect(mesh.position.z).toBeCloseTo(5, 1);
    });
  });

  describe('Force Application', () => {
    it('should apply force to body', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      const body = physicsManager.addDestructibleObject(mesh, {
        mass: 5,
        health: 100,
        points: 50,
      });

      physicsManager.applyForce(mesh, { x: 0, y: 100, z: 0 } as any);

      // Update physics to apply the force
      physicsManager.update(1 / 60);

      // Body should have upward velocity (force accumulates over time)
      expect(Math.abs(body.velocity.y)).toBeGreaterThan(0);
    });

    it('should apply impulse to body', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      physicsManager.addDestructibleObject(mesh, {
        mass: 5,
        health: 100,
        points: 50,
      });

      physicsManager.applyImpulse(mesh, { x: 10, y: 0, z: 0 } as any);

      const body = physicsManager.getBody(mesh);
      expect(body?.velocity.x).toBeGreaterThan(0);
    });

    it('should set velocity directly', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);

      physicsManager.addDestructibleObject(mesh, {
        mass: 5,
        health: 100,
        points: 50,
      });

      physicsManager.setVelocity(mesh, { x: 5, y: 10, z: -3 } as any);

      const body = physicsManager.getBody(mesh);
      expect(body?.velocity.x).toBe(5);
      expect(body?.velocity.y).toBe(10);
      expect(body?.velocity.z).toBe(-3);
    });
  });

  describe('Cleanup', () => {
    it('should clear all bodies', () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();

      // Add multiple objects
      for (let i = 0; i < 5; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        physicsManager.addDestructibleObject(mesh, {
          mass: 5,
          health: 100,
          points: 50,
        });
      }

      expect(physicsManager.world.bodies.length).toBeGreaterThan(0);

      physicsManager.clear();

      expect(physicsManager.world.bodies.length).toBe(0);
      expect(physicsManager.getDestructibleObjects().length).toBe(0);
    });
  });
});
