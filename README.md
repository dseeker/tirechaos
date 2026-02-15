# TIRE CHAOS

**"Physics. Mayhem. Tires."**

A physics-based destruction game featuring rolling tires, cinematic camera work, and maximum chaos.

## 🎮 Features

- **Realistic Tire Physics**: Powered by Cannon.js physics engine
- **Cinematic Camera System**: AI-driven camera director with multiple camera types
- **Destructible Environments**: Break, smash, and destroy everything in your path
- **Avalanche Mode**: Release 100+ tires simultaneously for massive chaos
- **Scoring & Combos**: Chain reactions and style points
- **Multiple Game Modes**: Campaign, Mini-games, Sandbox, and more

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Build

```bash
npm run build
```

### Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

## 🏗️ Project Structure

```
tire-chaos/
├── src/
│   ├── core/           # Core game systems
│   ├── entities/       # Game objects (tires, obstacles)
│   ├── systems/        # Game systems (physics, camera, scoring)
│   ├── managers/       # Game managers
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript types
│   └── tests/          # Test setup
├── e2e/                # End-to-end tests
├── public/             # Static assets
└── dist/               # Build output
```

## 🎯 Roadmap

- [x] Project setup
- [x] Core physics engine
- [x] Basic tire mechanics
- [x] Camera system foundation
- [ ] Destruction system
- [ ] Scoring & combo system
- [ ] UI/UX polish
- [ ] Multiple levels
- [ ] Avalanche mode
- [ ] Multiplayer support

## 🧪 Testing

This project maintains high test coverage:
- Unit tests for all core systems
- E2E tests for complete gameplay flows
- Coverage threshold: 70%

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines first.

---

**Let's roll!** 🛞
