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

### v0.2.0 (In Progress - Feb 2026)
- Babylon.js migration
- PBR materials and advanced lighting
- Post-processing pipeline
- Sound effects system
- Softbody deformation

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

**Last Updated:** February 15, 2026
**Next Review:** March 1, 2026

---

**Let's roll!** 🛞

*TIRE CHAOS - Making physics chaos feel cinematic*
