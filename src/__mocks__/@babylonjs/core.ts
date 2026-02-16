/**
 * Mock Babylon.js for Jest tests
 * Provides minimal implementation for testing game logic
 */

export class Vector2 {
  constructor(public x: number = 0, public y: number = 0) {}

  set(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  subtract(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
}

export class Vector3 {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}

  static Zero() {
    return new Vector3(0, 0, 0);
  }

  static Distance(a: Vector3, b: Vector3): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  static LerpToRef(start: Vector3, end: Vector3, amount: number, result: Vector3) {
    result.x = start.x + (end.x - start.x) * amount;
    result.y = start.y + (end.y - start.y) * amount;
    result.z = start.z + (end.z - start.z) * amount;
  }

  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copyFrom(other: Vector3) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  addInPlace(other: Vector3) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  scale(s: number): Vector3 {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
}

export class Color3 {
  constructor(public r: number = 1, public g: number = 1, public b: number = 1) {}

  static Black(): Color3 {
    return new Color3(0, 0, 0);
  }

  static FromHexString(hex: string): Color3 {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return new Color3(1, 1, 1);
    return new Color3(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    );
  }

  scale(factor: number): Color3 {
    return new Color3(this.r * factor, this.g * factor, this.b * factor);
  }
}

export class Quaternion {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0, public w: number = 1) {}

  set(x: number, y: number, z: number, w: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
}

class MockMaterial {
  baseColor: any;
  metallic: number = 0;
  roughness: number = 1;
  baseTexture: any;
  emissiveColor: any;

  dispose() {}
}

export class PBRMetallicRoughnessMaterial extends MockMaterial {
  constructor(public name: string, scene: any) {
    super();
  }
}

export class Texture {
  static WRAP_ADDRESSMODE = 1;
  wrapU: number = 0;
  wrapV: number = 0;

  constructor(public url: string, scene: any) {}

  dispose() {}
}

class MockMesh {
  position = new Vector3();
  rotation = new Vector3();
  scaling = new Vector3(1, 1, 1);
  rotationQuaternion: Quaternion | null = null;
  material: any = null;
  receiveShadows = false;
  isVisible = true;
  private _scene: any = null;

  constructor(public name: string, scene?: any) {
    if (scene) {
      this._scene = scene;
      scene.meshes.push(this);
    }
  }

  getBoundingInfo() {
    return {
      boundingBox: {
        extendSize: new Vector3(0.5, 0.5, 0.5)
      }
    };
  }

  setEnabled(enabled: boolean) {
    this.isVisible = enabled;
  }

  dispose() {
    // Remove from scene meshes array
    if (this._scene && this._scene.meshes) {
      const index = this._scene.meshes.indexOf(this);
      if (index > -1) {
        this._scene.meshes.splice(index, 1);
      }
    }
  }
}

export class Mesh extends MockMesh {
  static CAP_ALL = 3;
  static CAP_START = 1;
}

export class LinesMesh extends MockMesh {
  color = new Color3(1, 1, 1);
  alpha = 1;
}

export class MeshBuilder {
  static CreateBox(name: string, options: any, scene: any): Mesh {
    return new Mesh(name, scene);
  }

  static CreateCylinder(name: string, options: any, scene: any): Mesh {
    return new Mesh(name, scene);
  }

  static CreateSphere(name: string, options: any, scene: any): Mesh {
    return new Mesh(name, scene);
  }

  static CreateLines(name: string, options: any, scene: any): LinesMesh {
    return new LinesMesh(name, scene);
  }
}

export class Engine {
  constructor(canvas: any, antialias?: boolean, options?: any) {}

  getRenderingCanvas() {
    return document.createElement('canvas');
  }

  runRenderLoop(fn: () => void) {}

  resize() {}

  dispose() {}
}

export class Scene {
  meshes: any[] = [];

  constructor(engine: Engine) {}

  render() {}

  dispose() {
    this.meshes = [];
  }
}

export class UniversalCamera {
  position = new Vector3(0, 10, 20);
  fov = (75 * Math.PI) / 180;

  constructor(public name: string, position: Vector3, scene: Scene) {
    this.position = position;
  }

  setTarget(target: Vector3) {}

  attachControl(canvas: any, noPreventDefault?: boolean) {}
}

export class HemisphericLight {
  intensity = 1;

  constructor(public name: string, direction: Vector3, scene: Scene) {}
}

export class DirectionalLight {
  intensity = 1;
  position = new Vector3();

  constructor(public name: string, direction: Vector3, scene: Scene) {}
}

export class ShadowGenerator {
  static QUALITY_HIGH = 2;
  useExponentialShadowMap = false;
  usePoissonSampling = false;
  filteringQuality = 0;
  darkness = 0.3;

  constructor(mapSize: number, light: any) {}

  addShadowCaster(mesh: any) {}
}

export class DefaultRenderingPipeline {
  bloomEnabled = false;
  imageProcessing: any = {
    toneMappingType: 0,
    toneMappingEnabled: false,
    contrast: 1,
    exposure: 1
  };
  chromaticAberrationEnabled = false;
  grainEnabled = false;
  samples = 1;

  constructor(name: string, hdr: boolean, scene: Scene, cameras?: any[]) {}
}

export class ImageProcessingConfiguration {
  static TONEMAPPING_ACES = 3;
}

export class TransformNode {
  position = new Vector3();

  constructor(public name: string, scene?: Scene) {}
}
