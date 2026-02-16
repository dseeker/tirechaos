# 🎨 Babylon.js Migration Guide

**Migration from Three.js to Babylon.js for Enhanced Graphics**

---

## Overview

This document tracks the migration from Three.js to Babylon.js to achieve AAA-quality graphics with PBR materials, advanced lighting, and post-processing effects.

### Why Babylon.js?

**Visual Improvements:**
- ✅ PBR (Physically Based Rendering) materials built-in
- ✅ Advanced lighting (SSAO, HDR, Bloom, God Rays)
- ✅ Superior post-processing pipeline
- ✅ Better performance optimization tools
- ✅ Built-in physics integration (Cannon.js/Havok)
- ✅ Inspector for live debugging

**Key Differences from Three.js:**
| Feature | Three.js | Babylon.js |
|---------|----------|------------|
| Materials | Basic Phong/Lambert | Full PBR with metallic/roughness |
| Shadows | PCF only | PCF, ESM, Cascaded |
| Post-Processing | Manual setup | Built-in pipeline |
| Physics | External integration | Native support |
| Performance | Manual optimization | Auto-optimization |
| Debugging | Browser DevTools | Built-in Inspector |

---

## Migration Checklist

### Phase 1: Core Systems ✅ COMPLETED
- [x] Update package.json with Babylon.js dependencies
- [x] Migrate GameManager (Engine, Scene setup)
- [x] Migrate Camera system (CameraDirector)
- [x] Update type definitions
- [x] Update test mocks
- [x] Migrate PhysicsManager
- [x] Migrate InputHandler

### Phase 2: Entities ✅ COMPLETED
- [x] Migrate Tire entity
- [x] Add PBR materials
- [ ] Implement softbody deformation (future enhancement)
- [x] Update physics integration

### Phase 3: Visual Enhancements ✅ COMPLETED
- [x] Setup PBR workflow
- [x] Add advanced lighting (HemisphericLight, DirectionalLight, Shadows)
- [x] Implement post-processing (Bloom, HDR, ACES tone mapping, chromatic aberration)
- [ ] Add particle effects (future enhancement)

### Phase 4: Testing & Verification ✅ COMPLETED
- [x] Update all unit tests
- [x] Verify build compiles successfully
- [ ] Verify E2E tests (pending)
- [ ] Performance benchmarking (pending)
- [ ] Visual quality comparison (pending)

---

## Code Migration Patterns

### Scene Setup

**Before (Three.js):**
```typescript
this.scene = new THREE.Scene();
this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
this.camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);
```

**After (Babylon.js):**
```typescript
this.engine = new BABYLON.Engine(canvas, true);
this.scene = new BABYLON.Scene(this.engine);
this.camera = new BABYLON.ArcRotateCamera("camera", 0, 0, 10, BABYLON.Vector3.Zero(), this.scene);
```

### Materials

**Before (Three.js):**
```typescript
const material = new THREE.MeshStandardMaterial({
  color: 0x2d3142,
  roughness: 0.9,
  metalness: 0.1
});
```

**After (Babylon.js - PBR):**
```typescript
const material = new BABYLON.PBRMetallicRoughnessMaterial("tireMat", this.scene);
material.baseColor = new BABYLON.Color3.FromHexString("#2d3142");
material.roughness = 0.9;
material.metallic = 0.1;
```

### Meshes

**Before (Three.js):**
```typescript
const geometry = new THREE.CylinderGeometry(radius, radius, width, 32);
const mesh = new THREE.Mesh(geometry, material);
this.scene.add(mesh);
```

**After (Babylon.js):**
```typescript
const mesh = BABYLON.MeshBuilder.CreateCylinder("tire", {
  height: width,
  diameter: radius * 2,
  tessellation: 32
}, this.scene);
mesh.material = material;
```

### Lighting

**Before (Three.js):**
```typescript
const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(50, 50, 25);
light.castShadow = true;
```

**After (Babylon.js - with advanced shadows):**
```typescript
const light = new BABYLON.DirectionalLight("sun",
  new BABYLON.Vector3(-1, -2, -1), this.scene);
light.intensity = 0.8;

const shadowGenerator = new BABYLON.ShadowGenerator(2048, light);
shadowGenerator.useExponentialShadowMap = true;
shadowGenerator.usePoissonSampling = true;
```

### Post-Processing

**New in Babylon.js:**
```typescript
const pipeline = new BABYLON.DefaultRenderingPipeline(
  "default",
  true, // HDR
  this.scene,
  [this.camera]
);

// Enable effects
pipeline.samples = 4; // MSAA
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.8;
pipeline.bloomWeight = 0.3;

pipeline.imageProcessingEnabled = true;
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.contrast = 1.2;

pipeline.depthOfFieldEnabled = true;
pipeline.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
```

---

## Performance Optimization

### Babylon.js Optimizations

**Scene Optimizer:**
```typescript
BABYLON.SceneOptimizer.OptimizeAsync(this.scene,
  BABYLON.SceneOptimizerOptions.ModerateDegradationAllowed(),
  () => console.log("Optimization complete"),
  () => console.log("Optimization failed")
);
```

**LOD System:**
```typescript
const tireLOD0 = createDetailedTire(); // High poly
const tireLOD1 = createMediumTire();   // Medium poly
const tireLOD2 = createLowTire();      // Low poly

mesh.addLODLevel(20, tireLOD1);
mesh.addLODLevel(50, tireLOD2);
mesh.addLODLevel(100, null); // Invisible beyond 100m
```

**Instancing for multiple tires:**
```typescript
const source = createTireMesh();
for (let i = 0; i < 100; i++) {
  const instance = source.createInstance(`tire_${i}`);
  instance.position = new BABYLON.Vector3(x, y, z);
}
```

---

## Visual Quality Enhancements

### 1. PBR Materials

```typescript
// Realistic tire material
const tireMaterial = new BABYLON.PBRMetallicRoughnessMaterial("tire", scene);
tireMaterial.baseColor = new BABYLON.Color3(0.15, 0.15, 0.18);
tireMaterial.roughness = 0.9;
tireMaterial.metallic = 0.0;

// Add normal map for tread pattern
tireMaterial.bumpTexture = new BABYLON.Texture("assets/tire_normal.jpg", scene);
tireMaterial.bumpTexture.level = 0.5;

// Ambient occlusion
tireMaterial.ambientTexture = new BABYLON.Texture("assets/tire_ao.jpg", scene);
```

### 2. Advanced Lighting

```typescript
// Environment texture for reflections
const hdrTexture = new BABYLON.CubeTexture("assets/environment.env", scene);
scene.environmentTexture = hdrTexture;

// SSAO (Screen Space Ambient Occlusion)
const ssao = new BABYLON.SSAORenderingPipeline("ssao", scene, 0.75);
ssao.fallOff = 0.1;
ssao.area = 0.5;
ssao.radius = 2.0;
ssao.totalStrength = 1.3;

// God rays from sun
const godrays = new BABYLON.VolumetricLightScatteringPostProcess(
  "godrays", 1.0, camera, sun, 100,
  BABYLON.Texture.BILINEAR_SAMPLINGMODE,
  engine, false
);
```

### 3. Particle Systems

```typescript
// Debris particles on impact
const particleSystem = new BABYLON.ParticleSystem("debris", 2000, scene);
particleSystem.particleTexture = new BABYLON.Texture("assets/debris.png", scene);
particleSystem.emitter = impactPoint;
particleSystem.minSize = 0.1;
particleSystem.maxSize = 0.5;
particleSystem.minLifeTime = 0.3;
particleSystem.maxLifeTime = 1.5;
particleSystem.emitRate = 500;
particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);
particleSystem.start();
```

---

## Testing Updates

### Mock Updates for Babylon.js

```typescript
// Jest setup for Babylon.js
class MockEngine {
  runRenderLoop(callback: () => void) {
    setInterval(callback, 16);
  }
  dispose() {}
}

global.BABYLON = {
  Engine: MockEngine,
  Scene: class MockScene {},
  Vector3: class MockVector3 {},
  // ... other mocks
} as any;
```

---

## Expected Results

### Performance Targets
- Maintain 60 FPS on desktop
- Reduce bundle size with tree-shaking
- Faster initial load with async asset loading

### Visual Quality
- Photorealistic tire materials
- Dramatic lighting and shadows
- Cinematic post-processing
- Smooth particle effects

---

## Rollback Plan

If critical issues arise:
1. Revert to Three.js by checking out previous commit
2. Branch remains: `feature/babylonjs-migration`
3. All Three.js code preserved in git history
4. Can cherry-pick specific improvements

---

**Migration Status:** In Progress
**Started:** February 15, 2026
**Target Completion:** February 29, 2026

---

*This is a living document updated throughout the migration process.*
