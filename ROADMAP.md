# 🗺️ TIRE CHAOS - Product Roadmap

**"Physics. Mayhem. Tires."**

This roadmap outlines the development journey from our current MVP to the full vision described in the [Complete Game Design Document](./docs/GAME_DESIGN.md).

---

## 🎯 Vision Statement

> "TIRE CHAOS will redefine physics-based gaming by making every player a cinematic director. Through our revolutionary AI camera system, we're not just creating a game—we're building a platform for viral moments, creative expression, and pure joy."

### Core Pillars

1. **Cinematic Excellence** - Every moment feels like a directed action movie
2. **Physics Satisfaction** - Realistic, weighty, deeply satisfying interactions
3. **Viral by Design** - Built for sharing from the ground up
4. **Accessible Depth** - Easy to pick up, impossible to master
5. **Ethical F2P** - 100% gameplay free, cosmetics only

---

## 📅 Development Timeline

### ✅ Phase 0: Foundation (COMPLETED - Jan 2026)

**Goal:** Establish core technology and prove the concept

#### Achievements
- ✅ TypeScript + Vite development environment
- ✅ Three.js rendering pipeline (migrating to Babylon.js)
- ✅ Cannon.js physics integration
- ✅ 5 tire types with distinct physics
- ✅ Basic destructible objects
- ✅ Trajectory prediction system
- ✅ Drag-and-launch input
- ✅ Camera director foundation (7 camera types)
- ✅ Scoring system with combos (1x-5x)
- ✅ 56 unit tests + E2E test framework
- ✅ Performance validation (60 FPS)

**Milestone:** Playable prototype with fun core loop ✅

---

### 🚧 Phase 1: Visual Excellence (IN PROGRESS - Feb 2026)

**Goal:** Upgrade to AAA-quality graphics and visual feedback

#### Sprint 1.1: Babylon.js Migration (Week 1-2)
- [ ] Replace Three.js with Babylon.js 6.x
- [ ] Migrate all entities to Babylon mesh system
- [ ] Update physics integration
- [ ] Verify all tests still pass
- [ ] Performance benchmarking (maintain 60 FPS)

#### Sprint 1.2: PBR Materials & Lighting (Week 3)
- [ ] Implement PBR materials (metallic/roughness workflow)
- [ ] Real-time shadows with PCF/ESM
- [ ] SSAO (Screen Space Ambient Occlusion)
- [ ] HDR rendering with tone mapping
- [ ] Environment maps for reflections

#### Sprint 1.3: Post-Processing Pipeline (Week 4)
- [ ] Bloom effect for glowing highlights
- [ ] Motion blur for fast-moving objects
- [ ] Depth of field for cinematic shots
- [ ] God rays / volumetric light scattering
- [ ] Chromatic aberration (subtle)
- [ ] Film grain for texture

#### Sprint 1.4: Advanced Effects (Week 5-6)
- [ ] Softbody tire deformation system
- [ ] Enhanced particle systems (debris, dust, sparks)
- [ ] Tire skid marks with decals
- [ ] Impact flash effects
- [ ] Smoke trails
- [ ] Dynamic dust clouds on terrain

**Milestone:** Stunning visuals that rival premium titles

---

---

### ⚙️ Phase 1.5: Physics Engine Migration — Ammo.js / Bullet (Feb–Mar 2026)

**Goal:** Replace Cannon-es with Ammo.js (Bullet Physics) to unlock true softbody, cloth, and constraint-based deformation for realistic tire physics.

---

#### Why Migrate? Cannon-es vs Ammo.js/Bullet

| Capability | Cannon-es (current) | Ammo.js / Bullet |
|---|---|---|
| Rigid body | ✅ | ✅ |
| Broad/narrow phase | SAPBroadphase | DBVT (faster, dynamic) |
| Joints & constraints | limited | full: hinge, slider, 6DOF, spring |
| Softbody simulation | ❌ | ✅ `btSoftBody` |
| Cloth / rope | ❌ | ✅ |
| Deformable mesh sync | manual hack | native vertex feed |
| Continuous collision | partial | ✅ CCD full support |
| WASM + multi-thread | ❌ | ✅ (Bullet3 + SharedArrayBuffer) |
| Babylon.js plugin | `CannonJSPlugin` | `AmmoJSPlugin` (built-in) |
| Bundle size | ~86 KB gzip | ~160 KB gzip (WASM smaller) |

**Key win:** `btSoftBody` lets each tire be a deformable mesh directly — no vertex-shader hacks. Bullet simulates the rubber-like pressure model internally and feeds updated vertex positions every frame.

---

#### Migration Architecture

```
Current:
  Tire.ts → CANNON.Body (cylinder) → manual mesh.scaling squash

Target:
  Tire.ts → btSoftBody (pressurized ellipsoid) → Bullet feeds vertex positions
          → mesh.setVerticesData() each frame (native sync)
```

The `PhysicsManager` abstraction layer means the migration is **contained**:
- Replace `CannonJSPlugin` with `AmmoJSPlugin` in `GameManager.ts` (1 line)
- Rewrite `PhysicsManager` internals (keep the same public API surface)
- Update `Tire.createPhysicsBody()` to return `btSoftBody` wrapped in adapter

---

#### Step-by-Step Implementation Plan

##### Step 1 — Install Ammo.js WASM build
```bash
npm install ammo.js
# or use the optimized Babylon-bundled build:
npm install @babylonjs/ammo
```

`vite.config.ts` change — exclude from manualChunks, allow WASM:
```typescript
// Add to vite config
assetsInlineLimit: 0,  // don't inline WASM
optimizeDeps: { exclude: ['ammo.js'] },
```

##### Step 2 — Swap physics plugin in GameManager
```typescript
// GameManager.ts constructor — replace:
this.scene.enablePhysics(
  new BABYLON.Vector3(0, -9.82, 0),
  new BABYLON.CannonJSPlugin()
);

// With:
import Ammo from 'ammo.js';
await Ammo();   // loads WASM
this.scene.enablePhysics(
  new BABYLON.Vector3(0, -9.82, 0),
  new BABYLON.AmmoJSPlugin(true, Ammo)
);
```
`GameManager` must become async (or move scene init to an async `init()` method).

##### Step 3 — Rewrite PhysicsManager with Ammo types
```typescript
// Replace import
import Ammo from 'ammo.js';

// Key type swap:
// CANNON.World   → btDiscreteDynamicsWorld
// CANNON.Body    → btRigidBody  (rigid) | btSoftBody (tire)
// CANNON.Shape   → btCylinderShape

export class PhysicsManager {
  public world: Ammo.btSoftRigidDynamicsWorld;  // softRigid, not Discrete
  public timeScale: number = 1.0;

  constructor() {
    const collisionConfig = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfig);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();
    const softSolver = new Ammo.btDefaultSoftBodySolver();

    this.world = new Ammo.btSoftRigidDynamicsWorld(
      dispatcher, broadphase, solver, collisionConfig, softSolver
    );
    this.world.setGravity(new Ammo.btVector3(0, -9.82, 0));
  }

  update(deltaTime: number): void {
    this.world.stepSimulation(deltaTime * this.timeScale, 10, 1/120);
  }
}
```

##### Step 4 — Softbody tire creation
This is the key upgrade. Each tire becomes a pressure-filled ellipsoid:
```typescript
// Tire.createPhysicsBody() replacement:
createSoftTireBody(mesh: BABYLON.Mesh, radius: number, restitution: number): Ammo.btSoftBody {
  // Get mesh vertex positions for initial softbody shape
  const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)!;
  const numVerts = positions.length / 3;

  const softBodyHelpers = new Ammo.btSoftBodyHelpers();
  const worldInfo = this.physicsManager.world.getWorldInfo();

  // Build softbody from mesh vertices
  const vertexAmmoArray = new Ammo.btVector3(0, 0, 0);
  const ammoVerts: Ammo.btVector3[] = [];
  for (let i = 0; i < numVerts; i++) {
    ammoVerts.push(new Ammo.btVector3(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2]
    ));
  }

  const softBody = softBodyHelpers.CreateFromTriMesh(
    worldInfo,
    positions,           // vertex positions flat array
    indices,             // triangle indices
    numTriangles,
    true                 // randomizeConstraints
  );

  // Pressure model — makes it feel like a pneumatic tire:
  const sbConfig = softBody.get_m_cfg();
  sbConfig.set_viterations(10);   // velocity solver iterations
  sbConfig.set_piterations(10);   // position solver iterations
  sbConfig.set_kDF(0.2);          // dynamic friction
  sbConfig.set_kDP(0.01);         // damping
  sbConfig.set_kPR(250);          // pressure (higher = stiffer tire)
  sbConfig.set_kVC(20);           // volume conservation
  sbConfig.set_kCHR(restitution); // rigid body contact hardness

  softBody.setTotalMass(mass, false);
  softBody.generateBendingConstraints(2);  // internal cross-links

  this.physicsManager.world.addSoftBody(softBody, 1, -1);
  return softBody;
}
```

##### Step 5 — Per-frame vertex sync (native, no squash hack needed)
```typescript
// In Tire.update() — replaces the currentScale lerp entirely:
syncMeshToSoftBody(): void {
  const softBody = this.softBody;
  const nodes = softBody.get_m_nodes();
  const numNodes = nodes.size();

  // Bullet feeds us updated world positions of every softbody node:
  const positions = new Float32Array(numNodes * 3);
  for (let i = 0; i < numNodes; i++) {
    const node = nodes.at(i);
    const pos = node.get_m_x();
    positions[i * 3]     = pos.x();
    positions[i * 3 + 1] = pos.y();
    positions[i * 3 + 2] = pos.z();
  }
  this.mesh.updateVerticesData(
    BABYLON.VertexBuffer.PositionKind,
    positions,
    true   // updateExtends
  );
  // Normals need recomputing each frame for correct lighting:
  this.mesh.createNormals(true);
}
```
This gives **real rubber deformation** — the contact patch flattens, the sidewalls bulge, and the tire wobbles on high-speed impacts, all driven by physics.

##### Step 6 — Per-type Bullet contact materials
```typescript
// Equivalent of CANNON.ContactMaterial:
const tireMaterial = new Ammo.btDefaultContactCallback();
// Per-type friction/restitution via collision group masks and
// btRigidBody.setFriction() / setRestitution()

const configs = {
  standard:      { friction: 0.8,  restitution: 0.4,  pressure: 250 },
  monster_truck: { friction: 0.9,  restitution: 0.2,  pressure: 400 },
  racing_slick:  { friction: 0.95, restitution: 0.35, pressure: 320 },
  tractor:       { friction: 1.0,  restitution: 0.15, pressure: 180 },
  spare:         { friction: 0.6,  restitution: 0.8,  pressure: 120 },
};
```

##### Step 7 — Constraints: Suspension system (bonus)
Ammo.js constraints enable proper tire suspension — future-ready for vehicles:
```typescript
// btHingeConstraint for axle spin
const axle = new Ammo.btHingeConstraint(chassisBody, wheelBody,
  new Ammo.btVector3(0, 0, 0),       // pivot on chassis
  new Ammo.btVector3(0, 0, 0),       // pivot on wheel
  new Ammo.btVector3(1, 0, 0),       // axis (X = spin)
  new Ammo.btVector3(1, 0, 0),
  true
);
// btRaycastVehicle for full car physics (Phase 5+)
```

##### Step 8 — Multithreading (advanced, optional)
```typescript
// Bullet3 + SharedArrayBuffer + Worker:
// Use ammo.js taskScheduler for parallel island solving
// ~2-3× speedup for 100+ bodies (Avalanche Mode prerequisite)
const scheduler = new Ammo.btTaskSchedulerManager();
scheduler.addDefaultTaskScheduler();
Ammo.btSetTaskScheduler(scheduler.getOrCreateDefaultTaskScheduler());
```

---

#### Migration Checklist

```
Phase 1.5 Sprints
├── Sprint A: Infrastructure (1 week)
│   ├── [ ] Install ammo.js / configure vite WASM handling
│   ├── [ ] Make GameManager.init() async
│   ├── [ ] Swap CannonJSPlugin → AmmoJSPlugin
│   ├── [ ] Rewrite PhysicsManager with btSoftRigidDynamicsWorld
│   └── [ ] Verify all rigid bodies (ground, objects) still work
│
├── Sprint B: Tire Softbody (1 week)
│   ├── [ ] CreateFromTriMesh softbody for Tire
│   ├── [ ] Per-frame vertex sync (syncMeshToSoftBody)
│   ├── [ ] Remove squash-stretch hack (vertex deform is native now)
│   ├── [ ] Per-type pressure / contact material config
│   └── [ ] Tune kPR, kVC, kDF per tire type
│
├── Sprint C: Stability & Testing (1 week)
│   ├── [ ] Update unit tests (Ammo mocks vs Cannon mocks)
│   ├── [ ] Performance profiling — softbody vertex sync cost
│   ├── [ ] LOD: degrade to rigid body at >30m from camera
│   ├── [ ] Fix any collision event API differences
│   └── [ ] Full regression pass on all 5 levels
│
└── Sprint D: Bonus Features (1 week)
    ├── [ ] btHingeConstraint axle spin for vehicles
    ├── [ ] Cloth physics for starting banner / debris
    ├── [ ] Rope constraints for hanging targets
    └── [ ] Multithreading investigation (SharedArrayBuffer)
```

---

#### Bundle Impact

| Chunk | Before | After |
|---|---|---|
| `vendor-cannon` | 86 KB gzip | removed |
| `vendor-ammo` (WASM) | — | ~160 KB gzip |
| `vendor-ammo` (JS glue) | — | ~40 KB gzip |
| **Net change** | | **+114 KB** |

WASM loads faster at runtime than the equivalent JS, so perceived init time improves despite the larger download.

---

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ammo API complexity (raw C++ bindings) | High | Medium | Keep PhysicsManager façade; only internals change |
| Softbody vertex count performance | Medium | High | LOD: rigid body for tires > 30 m; reduce tessellation |
| Memory leaks (Ammo uses manual Ammo.destroy()) | Medium | Medium | Wrapper class that calls destroy() on dispose |
| WASM not supported (old mobile) | Low | High | Fallback: serve Cannon-es bundle with feature detect |
| Test suite breakage | High | Low | Mock Ammo module same as current Cannon mock |

---

### 🎵 Phase 2: Audio & Feel (Mar 2026)

**Goal:** Add sound design and haptic feedback

#### Sprint 2.1: Sound Effects
- [ ] Tire rolling sounds (varies by surface)
- [ ] Tire bounce/impact sounds
- [ ] Destruction sounds (wood, glass, metal)
- [ ] Explosion effects
- [ ] UI sounds (clicks, whooshes)
- [ ] Commentator callouts (optional)

#### Sprint 2.2: Music System
- [ ] 5-7 high-energy background tracks
- [ ] Dynamic music system (intensity based on combos)
- [ ] Main menu theme
- [ ] Victory/defeat jingles
- [ ] Music mixer with fade in/out

#### Sprint 2.3: Polish
- [ ] Screen shake on impacts
- [ ] Slow-motion on critical hits
- [ ] Haptic feedback for mobile/controllers
- [ ] Audio occlusion system

**Milestone:** Game feels as good as it looks

---

### 🎮 Phase 3: Content Expansion (Apr-May 2026)

**Goal:** Build out campaign and game modes

#### Sprint 3.1: World 1 - Suburban Chaos (Week 1-2)
- [ ] 10 unique levels
- [ ] Tutorial integration
- [ ] Boss level: "HOA President's Perfect Lawn"
- [ ] 3-star rating system
- [ ] Unlock progression

#### Sprint 3.2: World 2 - Construction Carnage (Week 3-4)
- [ ] 10 construction-themed levels
- [ ] New obstacles: scaffolding, cranes, cement mixers
- [ ] Boss level: "Demolition Day"
- [ ] Introduce explosive barrels

#### Sprint 3.3: World 3 - Winter Wasteland (Week 5-6)
- [ ] 10 snowy mountain levels
- [ ] Ice physics system
- [ ] Avalanche triggers
- [ ] Boss level: "Downhill Destroyer"

#### Sprint 3.4: Worlds 4 & 5 (Week 7-10)
- [ ] Desert Demolition (10 levels)
- [ ] Volcano Velocity (10 levels)
- [ ] Final boss: "Tire of the Gods"

**Milestone:** 50+ levels, 5 complete worlds

---

### ⭐ Phase 4: Avalanche Mode (June 2026)

**Goal:** Implement the flagship chaos mode

#### Sprint 4.1: Foundation
- [ ] Object placement UI
- [ ] Budget system (point-based)
- [ ] 100-tire simultaneous physics
- [ ] Camera system optimization
- [ ] Performance tuning

#### Sprint 4.2: Optimization
- [ ] Tire pooling system
- [ ] Progressive sleep for stationary tires
- [ ] LOD system for distant tires
- [ ] Staggered physics updates
- [ ] Culling system (300-500 tire support)

#### Sprint 4.3: Content
- [ ] 5 Avalanche maps:
  - Urban Sprawl
  - Factory Meltdown
  - Mountain Pass
  - Beach Bonanza
  - Cosmic Chaos (low gravity!)
- [ ] Leaderboards
- [ ] Achievement system

**Milestone:** 500-tire chaos at playable framerates

---

### 🎯 Phase 5: Mini-Games (July 2026)

**Goal:** Add variety and replayability

#### Mini-Games to Implement
- [ ] Tire Bowling (strike/spare system)
- [ ] Ring Toss Extreme (moving targets)
- [ ] Tire Golf (18 holes, par system)
- [ ] Tire Curling (precision sliding)
- [ ] Speed Demon (time trials)
- [ ] Dizzy Derby (ragdoll in tire)
- [ ] Tire Jump (ski jump scoring)

**Milestone:** 7 unique mini-games

---

### 📹 Phase 6: Replay & Sharing (Aug 2026)

**Goal:** Make viral content creation effortless

#### Sprint 6.1: Replay System
- [ ] Auto-highlight detection
- [ ] Replay timeline scrubber
- [ ] Free camera mode
- [ ] Speed controls (0.1x to 2x)
- [ ] Screenshot mode (4K, no UI)

#### Sprint 6.2: Export & Sharing
- [ ] GIF export (optimized for Twitter/Discord)
- [ ] MP4 export (720p/1080p)
- [ ] One-click sharing
- [ ] Auto-generated captions/hashtags
- [ ] Watermark options

#### Sprint 6.3: Community Features
- [ ] In-game replay gallery
- [ ] "Moment of the Week" featured on main menu
- [ ] Upvote/favorite system
- [ ] Creator profiles

**Milestone:** Every player becomes a content creator

---

### 👥 Phase 7: Multiplayer (Sep-Oct 2026)

**Goal:** Add social competition

#### Sprint 7.1: Turn-Based Modes
- [ ] Local hot-seat multiplayer
- [ ] Online turn-based (async)
- [ ] Highest score wins
- [ ] Best of 3/5 rounds

#### Sprint 7.2: Simultaneous Modes
- [ ] Real-time simultaneous launches
- [ ] Tire collision between players
- [ ] Sabotage mechanics
- [ ] Team modes (2v2)

#### Sprint 7.3: Cooperative
- [ ] Combined score challenges
- [ ] Chain reaction cooperation
- [ ] Boss battles (vs AI mega-structures)

**Milestone:** Rich multiplayer experience

---

### 🎨 Phase 8: Polish & Optimization (Nov 2026)

**Goal:** Final quality pass before v1.0 release

#### Areas of Focus
- [ ] Performance optimization (target 60 FPS on mid-range)
- [ ] Visual polish pass
- [ ] Audio mixing and balance
- [ ] Tutorial refinement
- [ ] Loading time optimization
- [ ] Localization (Spanish, French, German, Japanese)
- [ ] Accessibility features:
  - Colorblind modes
  - Subtitle options
  - Scalable UI
  - Remappable controls
  - One-handed mode

**Milestone:** Release candidate ready

---

### 🚀 Phase 9: Launch (Dec 2026)

**Goal:** Ship v1.0 and grow community

#### Pre-Launch (Week 1-2)
- [ ] Steam page live
- [ ] Press kit distribution
- [ ] Influencer review codes (50-100)
- [ ] Trailer release
- [ ] Social media campaign

#### Launch Week (Week 3)
- [ ] Release on Steam + itch.io
- [ ] 20% launch discount
- [ ] Reddit AMA
- [ ] Discord launch party
- [ ] Critical bug monitoring

#### Post-Launch (Week 4+)
- [ ] Patch 1.1 (bug fixes)
- [ ] Community feedback integration
- [ ] Analytics monitoring
- [ ] Begin post-launch content

**Milestone:** v1.0 shipped to the world!

---

### 🌍 Phase 10: Post-Launch Content (2027+)

**Goal:** Keep community engaged and growing

#### Update 1.0: "Mountain Madness" (Q1 2027)
- 10 extreme mountain levels
- 2 new tire types
- New mini-game
- QoL improvements

#### Update 2.0: "Multiplayer Mayhem" (Q2 2027)
- Ranked leaderboards
- Seasonal tournaments
- Emote system
- Clan/team features

#### Update 3.0: "Avalanche Evolution" (Q3 2027)
- 5 new Avalanche maps
- Advanced object types
- Challenge mode variations
- Creator tools (community maps)

#### Mobile Port Consideration (Q4 2027)
- iOS/Android version
- Touch-optimized controls
- Cross-platform progression
- Cloud save sync

---

## 💰 Monetization Strategy

### Free-to-Play Model (Ethical)

**Core Principle:** 100% of gameplay is free forever

#### Revenue Streams

**1. Cosmetic Microtransactions ($0.99 - $4.99)**
- Tire skins (flame, chrome, camo, RGB, etc.)
- Smoke trail colors
- Particle effects
- Hats for tires (silly cosmetics)
- Emotes (post-launch)

**2. Battle Pass (Optional - $4.99/season)**
- 8-week seasons
- Free tier + premium tier
- Exclusive skins and trails
- Bonus currency
- Completable in 10-15 hours

**3. Optional Ads (Non-Intrusive)**
- Rewarded video ads only
- Max 3 per hour
- Double XP, extra tire, cosmetic preview
- $2.99 to remove permanently

**4. Support Bundle ($5.00 one-time)**
- "Thank You" tire skin
- Name in credits
- Purely supportive

### Revenue Projections

**Year 1 (Conservative):**
- 50,000 downloads
- 5% conversion rate
- Average purchase $2.50
- **Estimated: $100,000 - $150,000**

**Year 2 (with growth):**
- 150,000 total users
- Improved conversion (7%)
- **Estimated: $250,000 - $400,000**

---

## 📊 Success Metrics

### Launch Targets (Month 1)
- **Downloads:** 50,000+
- **Retention:** 40% Day 1, 20% Day 7, 10% Day 30
- **Avg Session:** 25-45 minutes
- **Steam Rating:** 80%+ positive
- **Conversion:** 5%+ make a purchase

### Long-Term Goals (Year 1)
- **Monthly Active Users:** 10,000+
- **Content Creation:** 1,000+ YouTube videos
- **Social Reach:** 20,000+ followers
- **Award Nominations:** Indie game awards
- **Revenue:** Break-even + team salaries

---

## 🔄 Agile Process

### Sprint Structure
- **Duration:** 2-week sprints
- **Ceremonies:**
  - Sprint planning (Monday)
  - Daily standups (async for remote)
  - Sprint review (Friday)
  - Sprint retrospective (Friday)

### Prioritization Framework
1. **P0 - Critical:** Blocks launch, breaks game
2. **P1 - High:** Core features, major bugs
3. **P2 - Medium:** Nice-to-haves, polish
4. **P3 - Low:** Future considerations

### Flexibility
- Roadmap is living document
- Community feedback shapes priorities
- Technical discoveries may shift timeline
- Quality over arbitrary deadlines

---

## 🎯 Key Risks & Mitigation

### Technical Risks

**Risk:** Physics instability with 500 tires
- **Mitigation:** Progressive optimization, LOD system, early testing

**Risk:** Performance on lower-end hardware
- **Mitigation:** Scalable graphics settings, performance mode, regular profiling

**Risk:** Babylon.js learning curve
- **Mitigation:** Strong documentation, community support, fallback to Three.js if needed

### Business Risks

**Risk:** Market saturation (physics games)
- **Mitigation:** Camera system differentiator, viral marketing, unique IP

**Risk:** F2P revenue insufficient
- **Mitigation:** Low burn rate, sponsorships, merchandise, premium DLC option

**Risk:** Scope creep
- **Mitigation:** Strict MVP definition, post-launch for extras, regular prioritization

---

## 🤝 Team Structure

### Core Team (MVP)
- **Game Designer / Lead:** Vision, design, community
- **Programmer:** Systems, optimization, bug fixing
- **3D Artist:** Models, textures, visual effects
- **Sound Designer:** Music, SFX (contract)

### Extended Team (Post-Launch)
- Additional programmer (multiplayer)
- Marketing specialist (pre-launch)
- QA testers (alpha/beta)
- Community manager (post-launch)

---

## 📝 Change Log

### v0.1.0 (Jan 2026)
- Initial implementation with Three.js
- Core gameplay mechanics
- 56 unit tests
- E2E test framework

### v0.2.0 (Feb 2026)
- Babylon.js migration complete (PBR materials, advanced lighting, shadows)
- Post-processing pipeline (bloom, DOF, motion blur)
- Synthesized Web Audio SoundManager (no audio files, 7 SFX + music)
- LeaderboardManager (top-5 persistent, name entry modal)
- AchievementManager (15 achievements, toast notifications)
- SlowMotionManager (0.25× physics at combo ≥ 3)
- TouchControlManager (mobile swipe-to-aim)
- Vertex deformation: contact patch flatten + inertial wobble (Babylon.js native)
- Per-tire restitution contact materials (Spare 0.8 → Tractor 0.15)
- GitHub Pages CI/CD (GitHub Actions, WASM-safe chunk splitting)
- Bundle splitting: Babylon 3.9 MB cached chunk, game code 141 KB

### v0.2.1 (In Progress - Feb 2026)
- Ammo.js/Bullet migration plan documented (Phase 1.5)

### v1.0.0 (Target: Dec 2026)
- Full campaign (50 levels)
- Avalanche mode
- 7 mini-games
- Multiplayer
- Replay system
- Localization

---

## 🌟 North Star Metrics

These metrics guide all decisions:

1. **Seconds to Fun:** <30s from launch to first satisfying tire roll
2. **Viral Coefficient:** Share rate per player (target: 20%+)
3. **Session Length:** Average 30+ minutes (engaged players)
4. **Retention:** 15%+ Day 30 (industry-leading for F2P)
5. **NPS Score:** 50+ (promoters significantly outnumber detractors)

---

## 📞 Feedback & Iteration

This roadmap evolves based on:
- Community feedback (Discord, Reddit, surveys)
- Analytics data (retention, engagement, monetization)
- Technical discoveries (new possibilities/limitations)
- Market trends (competitive analysis)
- Team capacity (realistic commitments)

**Last Updated:** February 18, 2026
**Next Review:** March 1, 2026

---

**Let's roll!** 🛞

*TIRE CHAOS - Making physics chaos feel cinematic*
