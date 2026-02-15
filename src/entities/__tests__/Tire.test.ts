import * as THREE from 'three';
import { Tire } from '../Tire';
import { TireType } from '../../types';
import { PhysicsManager } from '../../systems/PhysicsManager';

describe('Tire', () => {
  let scene: THREE.Scene;
  let physicsManager: PhysicsManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    physicsManager = new PhysicsManager();
  });

  afterEach(() => {
    physicsManager.clear();
  });

  describe('Tire Creation', () => {
    it('should create standard tire correctly', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);

      expect(tire).toBeDefined();
      expect(tire.mesh).toBeDefined();
      expect(tire.body).toBeDefined();
      expect(tire.isLaunched).toBe(false);
    });

    it('should create different tire types', () => {
      const types = [
        TireType.STANDARD,
        TireType.MONSTER_TRUCK,
        TireType.RACING_SLICK,
        TireType.TRACTOR,
        TireType.SPARE,
      ];

      types.forEach((type) => {
        const tire = new Tire(type, scene, physicsManager);
        expect(tire.config.type).toBe(type);
        tire.destroy();
      });
    });

    it('should add tire to scene', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);

      expect(scene.children).toContain(tire.mesh);
    });

    it('should have correct physics properties', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);

      expect(tire.body.mass).toBe(20); // Standard tire mass
      expect(tire.body.linearDamping).toBe(0.1);
      expect(tire.body.angularDamping).toBe(0.05);
    });
  });

  describe('Tire Properties', () => {
    it('should have monster truck properties', () => {
      const tire = new Tire(TireType.MONSTER_TRUCK, scene, physicsManager);

      expect(tire.config.properties.mass).toBe(50);
      expect(tire.config.properties.radius).toBe(0.8);
    });

    it('should have racing slick properties', () => {
      const tire = new Tire(TireType.RACING_SLICK, scene, physicsManager);

      expect(tire.config.properties.mass).toBe(15);
      expect(tire.config.properties.friction).toBe(1.0);
    });

    it('should have spare tire properties', () => {
      const tire = new Tire(TireType.SPARE, scene, physicsManager);

      expect(tire.config.properties.mass).toBe(10);
      expect(tire.config.properties.restitution).toBe(0.6); // Bouncy
    });
  });

  describe('Tire Position', () => {
    it('should set position correctly', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);
      const position = new THREE.Vector3(10, 5, -3);

      tire.setPosition(position);

      expect(tire.mesh.position.x).toBe(10);
      expect(tire.mesh.position.y).toBe(5);
      expect(tire.mesh.position.z).toBe(-3);

      expect(tire.body.position.x).toBe(10);
      expect(tire.body.position.y).toBe(5);
      expect(tire.body.position.z).toBe(-3);
    });
  });

  describe('Tire Launch', () => {
    it('should launch with given velocity', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);
      const velocity = new THREE.Vector3(10, 15, 0);

      tire.launch(velocity);

      expect(tire.isLaunched).toBe(true);
      expect(tire.body.velocity.x).toBe(10);
      expect(tire.body.velocity.y).toBe(15);
      expect(tire.launchTime).toBeGreaterThan(0);
    });

    it('should apply initial spin on launch', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);
      const velocity = new THREE.Vector3(10, 0, 0);

      tire.launch(velocity);

      // Should have angular velocity (spin)
      expect(tire.body.angularVelocity.z).not.toBe(0);
    });
  });

  describe('Tire Speed', () => {
    it('should calculate speed correctly', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);

      tire.body.velocity.set(3, 4, 0); // 3-4-5 triangle = speed 5

      expect(tire.getSpeed()).toBeCloseTo(5, 1);
    });

    it('should detect rest state', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);

      tire.body.velocity.set(0, 0, 0);

      expect(tire.isAtRest()).toBe(true);
    });

    it('should detect moving state', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);

      tire.body.velocity.set(5, 0, 0);

      expect(tire.isAtRest()).toBe(false);
    });
  });

  describe('Tire Update', () => {
    it('should update position from physics', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);
      tire.launch(new THREE.Vector3(0, 10, 0));

      const initialY = tire.mesh.position.y;

      // Update for several frames
      for (let i = 0; i < 10; i++) {
        tire.update(1 / 60);
        physicsManager.update(1 / 60);
      }

      // Position should have changed
      expect(tire.mesh.position.y).not.toBe(initialY);
    });

    it('should track distance traveled', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);
      tire.setPosition(new THREE.Vector3(0, 0, 0));
      tire.launch(new THREE.Vector3(10, 0, 0));

      // Simulate movement
      for (let i = 0; i < 60; i++) {
        tire.update(1 / 60);
        physicsManager.update(1 / 60);
      }

      const distance = tire.getDistanceTraveled();
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('Tire Cleanup', () => {
    it('should remove tire from scene on destroy', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);

      expect(scene.children).toContain(tire.mesh);

      tire.destroy();

      expect(scene.children).not.toContain(tire.mesh);
    });

    it('should remove tire from physics on destroy', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);
      const bodyCount = physicsManager.world.bodies.length;

      tire.destroy();

      expect(physicsManager.world.bodies.length).toBe(bodyCount - 1);
    });

    it('should dispose geometries and materials', () => {
      const tire = new Tire(TireType.STANDARD, scene, physicsManager);

      const disposeSpy = jest.spyOn(tire.mesh.geometry, 'dispose');

      tire.destroy();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });
});
