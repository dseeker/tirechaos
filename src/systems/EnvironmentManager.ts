import * as BABYLON from '@babylonjs/core';

/**
 * Prop type identifiers used when spawning environment objects.
 */
export type PropType = 'barrier' | 'ramp' | 'box' | 'post';

/**
 * Configuration for a single spawned prop.
 */
export interface PropConfig {
  type: PropType;
  position: BABYLON.Vector3;
  rotation?: BABYLON.Vector3;
  scale?: BABYLON.Vector3;
}

/**
 * A record of a prop that has been placed in the scene.
 */
export interface SpawnedProp {
  mesh: BABYLON.Mesh;
  type: PropType;
}

/**
 * Play-area bounds used when generating random prop positions.
 */
export interface PlayAreaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  groundY: number;
}

/**
 * EnvironmentManager
 *
 * Adds static decorative props (barriers, ramps, boxes, posts) to the TIRE CHAOS
 * scene using Babylon.js MeshBuilder and PBR materials. Props receive shadows but
 * have no physics bodies — they are purely visual set-dressing.
 */
export class EnvironmentManager {
  private scene: BABYLON.Scene;
  private shadowGenerator: BABYLON.ShadowGenerator | null;
  private spawnedProps: SpawnedProp[] = [];

  // Shared PBR materials keyed by a descriptive name so meshes of the same
  // visual style reuse the same material instance.
  private materials: Map<string, BABYLON.PBRMetallicRoughnessMaterial> = new Map();

  constructor(scene: BABYLON.Scene, shadowGenerator?: BABYLON.ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator ?? null;
    console.log('EnvironmentManager initialized');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Spawn a fixed set of hand-crafted props that define the level layout.
   * Call this once during level setup.
   */
  public spawnLevelProps(): void {
    // --- Perimeter barriers (concrete walls around the play field) ---
    this.spawnBarrier(new BABYLON.Vector3(0, -4.0, -10), new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(50, 2, 1));
    this.spawnBarrier(new BABYLON.Vector3(0, -4.0, 10), new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(50, 2, 1));
    this.spawnBarrier(new BABYLON.Vector3(-25, -4.0, 0), new BABYLON.Vector3(0, Math.PI / 2, 0), new BABYLON.Vector3(20, 2, 1));
    this.spawnBarrier(new BABYLON.Vector3(25, -4.0, 0), new BABYLON.Vector3(0, Math.PI / 2, 0), new BABYLON.Vector3(20, 2, 1));

    // --- Launch ramp at the far left (where tires are launched from) ---
    this.spawnRamp(new BABYLON.Vector3(-18, -4.5, 0), new BABYLON.Vector3(0, 0, -0.25));

    // --- A mid-field ramp for aerial action ---
    this.spawnRamp(new BABYLON.Vector3(-2, -4.5, 3), new BABYLON.Vector3(0, Math.PI * 0.1, -0.18));

    // --- Stacked crate clusters ---
    this.spawnBoxStack(new BABYLON.Vector3(5, -4.5, -4));
    this.spawnBoxStack(new BABYLON.Vector3(10, -4.5, 5));
    this.spawnBoxStack(new BABYLON.Vector3(-5, -4.5, 6));

    // --- Signpost pillars flanking the launch zone ---
    this.spawnPost(new BABYLON.Vector3(-20, -4.0, -3));
    this.spawnPost(new BABYLON.Vector3(-20, -4.0, 3));

    // --- Scattered lone pillars down the course ---
    this.spawnPost(new BABYLON.Vector3(0, -4.0, -7));
    this.spawnPost(new BABYLON.Vector3(8, -4.0, 7));
    this.spawnPost(new BABYLON.Vector3(15, -4.0, -5));

    console.log(`EnvironmentManager: placed ${this.spawnedProps.length} level props`);
  }

  /**
   * Spawn a configurable number of random props distributed throughout the
   * given play-area bounds. Useful for procedurally dressing larger arenas.
   *
   * @param count      Number of props to spawn.
   * @param bounds     Rectangular area in which props are placed.
   */
  public spawnRandomProps(count: number, bounds: PlayAreaBounds): void {
    const types: PropType[] = ['barrier', 'ramp', 'box', 'post'];

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
      const position = new BABYLON.Vector3(x, bounds.groundY, z);
      const yaw = Math.random() * Math.PI * 2;

      switch (type) {
        case 'barrier':
          this.spawnBarrier(position, new BABYLON.Vector3(0, yaw, 0));
          break;
        case 'ramp':
          this.spawnRamp(position, new BABYLON.Vector3(0, yaw, -0.2));
          break;
        case 'box':
          this.spawnBox(
            `randomBox_${i}`,
            position.add(new BABYLON.Vector3(0, 0.5, 0)),
            this.getRandomBoxColor(),
            new BABYLON.Vector3(
              0.8 + Math.random() * 0.8,
              0.8 + Math.random() * 0.8,
              0.8 + Math.random() * 0.8,
            ),
          );
          break;
        case 'post':
          this.spawnPost(position, new BABYLON.Vector3(0, yaw, 0));
          break;
      }
    }

    console.log(`EnvironmentManager: spawned ${count} random props`);
  }

  /**
   * Remove all props from the scene and free resources.
   */
  public clear(): void {
    this.spawnedProps.forEach((prop) => prop.mesh.dispose());
    this.spawnedProps = [];

    this.materials.forEach((mat) => mat.dispose());
    this.materials.clear();

    console.log('EnvironmentManager: cleared all props');
  }

  /**
   * Return the list of all currently spawned props (read-only view).
   */
  public getSpawnedProps(): ReadonlyArray<SpawnedProp> {
    return this.spawnedProps;
  }

  // ---------------------------------------------------------------------------
  // Individual prop spawners
  // ---------------------------------------------------------------------------

  /**
   * Concrete safety barrier — a wide, flat-topped wall segment.
   */
  public spawnBarrier(
    position: BABYLON.Vector3,
    rotation: BABYLON.Vector3 = BABYLON.Vector3.Zero(),
    scale: BABYLON.Vector3 = new BABYLON.Vector3(8, 1.2, 0.6),
  ): BABYLON.Mesh {
    const name = `barrier_${this.spawnedProps.length}`;

    const mesh = BABYLON.MeshBuilder.CreateBox(
      name,
      { width: scale.x, height: scale.y, depth: scale.z },
      this.scene,
    );

    mesh.position.copyFrom(position);
    mesh.position.y += scale.y * 0.5; // Sit on the ground surface
    mesh.rotation.copyFrom(rotation);

    // Concrete PBR material — light grey, non-metallic, very rough
    mesh.material = this.getOrCreateMaterial('concrete', {
      baseColor: new BABYLON.Color3(0.72, 0.72, 0.70),
      metallic: 0.0,
      roughness: 0.92,
    });

    this.finaliseProp(mesh, 'barrier');
    return mesh;
  }

  /**
   * Wooden ramp — an angled box that acts as a jump surface.
   */
  public spawnRamp(
    position: BABYLON.Vector3,
    rotation: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, -0.2),
    scale: BABYLON.Vector3 = new BABYLON.Vector3(4, 0.3, 2.5),
  ): BABYLON.Mesh {
    const name = `ramp_${this.spawnedProps.length}`;

    const mesh = BABYLON.MeshBuilder.CreateBox(
      name,
      { width: scale.x, height: scale.y, depth: scale.z },
      this.scene,
    );

    mesh.position.copyFrom(position);
    mesh.position.y += scale.y * 0.5;
    mesh.rotation.copyFrom(rotation);

    // Weathered wood PBR material — warm brown, rough, slight sheen
    mesh.material = this.getOrCreateMaterial('wood', {
      baseColor: new BABYLON.Color3(0.45, 0.30, 0.18),
      metallic: 0.0,
      roughness: 0.85,
    });

    this.finaliseProp(mesh, 'ramp');
    return mesh;
  }

  /**
   * Single decorative crate / box.
   */
  public spawnBox(
    name: string,
    position: BABYLON.Vector3,
    color: BABYLON.Color3,
    scale: BABYLON.Vector3 = new BABYLON.Vector3(1, 1, 1),
    rotation: BABYLON.Vector3 = BABYLON.Vector3.Zero(),
  ): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateBox(
      name,
      { width: scale.x, height: scale.y, depth: scale.z },
      this.scene,
    );

    mesh.position.copyFrom(position);
    mesh.rotation.copyFrom(rotation);

    // Each crate gets its own material because colours vary
    const matKey = `crate_${color.toHexString()}`;
    mesh.material = this.getOrCreateMaterial(matKey, {
      baseColor: color,
      metallic: 0.05,
      roughness: 0.80,
    });

    this.finaliseProp(mesh, 'box');
    return mesh;
  }

  /**
   * Vertical post / pillar — used as lane markers, signpost bases, etc.
   */
  public spawnPost(
    position: BABYLON.Vector3,
    rotation: BABYLON.Vector3 = BABYLON.Vector3.Zero(),
    height: number = 3.0,
    diameter: number = 0.25,
  ): BABYLON.Mesh {
    const name = `post_${this.spawnedProps.length}`;

    const mesh = BABYLON.MeshBuilder.CreateCylinder(
      name,
      {
        height,
        diameter,
        tessellation: 12,
      },
      this.scene,
    );

    mesh.position.copyFrom(position);
    mesh.position.y += height * 0.5; // Sit on ground
    mesh.rotation.copyFrom(rotation);

    // Galvanised steel PBR material — mid-grey, slightly metallic, medium rough
    mesh.material = this.getOrCreateMaterial('galvanisedSteel', {
      baseColor: new BABYLON.Color3(0.55, 0.56, 0.58),
      metallic: 0.75,
      roughness: 0.45,
    });

    // Add a small cap disc on top for extra detail
    const cap = BABYLON.MeshBuilder.CreateCylinder(
      `${name}_cap`,
      { height: 0.08, diameter: diameter * 1.4, tessellation: 12 },
      this.scene,
    );
    cap.position.copyFrom(mesh.position);
    cap.position.y += height * 0.5 + 0.04;
    cap.material = this.getOrCreateMaterial('galvanisedSteel', {
      baseColor: new BABYLON.Color3(0.55, 0.56, 0.58),
      metallic: 0.75,
      roughness: 0.45,
    });

    this.finaliseProp(cap, 'post');
    this.finaliseProp(mesh, 'post');

    return mesh;
  }

  // ---------------------------------------------------------------------------
  // Helper — stacked box cluster
  // ---------------------------------------------------------------------------

  /**
   * Spawn a small cluster of crates at a given base position.
   */
  private spawnBoxStack(basePosition: BABYLON.Vector3): void {
    const crateColors: BABYLON.Color3[] = [
      new BABYLON.Color3(0.85, 0.42, 0.10), // Burnt orange
      new BABYLON.Color3(0.20, 0.52, 0.78), // Steel blue
      new BABYLON.Color3(0.78, 0.78, 0.20), // Yellow
      new BABYLON.Color3(0.55, 0.20, 0.20), // Dark red
    ];

    // Ground-level row (3 crates side by side)
    for (let col = 0; col < 3; col++) {
      const color = crateColors[(col) % crateColors.length];
      const pos = basePosition.add(new BABYLON.Vector3((col - 1) * 1.05, 0.5, 0));
      const rotation = new BABYLON.Vector3(0, (Math.random() - 0.5) * 0.15, 0);
      this.spawnBox(`stackBase_${this.spawnedProps.length}`, pos, color, new BABYLON.Vector3(1, 1, 1), rotation);
    }

    // Second row (2 crates)
    for (let col = 0; col < 2; col++) {
      const color = crateColors[(col + 2) % crateColors.length];
      const pos = basePosition.add(new BABYLON.Vector3((col - 0.5) * 1.05, 1.55, 0));
      const rotation = new BABYLON.Vector3(0, (Math.random() - 0.5) * 0.2, 0);
      this.spawnBox(`stackMid_${this.spawnedProps.length}`, pos, color, new BABYLON.Vector3(1, 1, 1), rotation);
    }

    // Top single crate
    const topColor = crateColors[Math.floor(Math.random() * crateColors.length)];
    const topPos = basePosition.add(new BABYLON.Vector3(0, 2.6, 0));
    const topRot = new BABYLON.Vector3(0, Math.random() * 0.4, 0);
    this.spawnBox(`stackTop_${this.spawnedProps.length}`, topPos, topColor, new BABYLON.Vector3(1, 1, 1), topRot);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Mark a mesh as a shadow receiver (and optionally shadow caster), then push
   * it into the internal props list.
   */
  private finaliseProp(mesh: BABYLON.Mesh, type: PropType): void {
    // Props receive shadows cast by dynamic lights
    mesh.receiveShadows = true;

    // Props also cast shadows on the ground and on each other
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(mesh, true);
    }

    this.spawnedProps.push({ mesh, type });
  }

  /**
   * Retrieve a cached PBR material by key, creating it if it does not yet
   * exist. This avoids duplicate material objects for identical surfaces.
   */
  private getOrCreateMaterial(
    key: string,
    config: { baseColor: BABYLON.Color3; metallic: number; roughness: number },
  ): BABYLON.PBRMetallicRoughnessMaterial {
    if (this.materials.has(key)) {
      return this.materials.get(key)!;
    }

    const mat = new BABYLON.PBRMetallicRoughnessMaterial(`envMat_${key}`, this.scene);
    mat.baseColor = config.baseColor;
    mat.metallic = config.metallic;
    mat.roughness = config.roughness;

    this.materials.set(key, mat);
    return mat;
  }

  /**
   * Return a random colour suitable for a decorative crate.
   */
  private getRandomBoxColor(): BABYLON.Color3 {
    const palette: BABYLON.Color3[] = [
      new BABYLON.Color3(0.85, 0.42, 0.10), // Burnt orange
      new BABYLON.Color3(0.20, 0.52, 0.78), // Steel blue
      new BABYLON.Color3(0.78, 0.78, 0.20), // Yellow
      new BABYLON.Color3(0.55, 0.20, 0.20), // Dark red
      new BABYLON.Color3(0.20, 0.65, 0.30), // Green
      new BABYLON.Color3(0.60, 0.30, 0.70), // Purple
    ];
    return palette[Math.floor(Math.random() * palette.length)];
  }
}
