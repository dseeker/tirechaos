# TIRE CHAOS - Agent Development Guide

> **"Physics. Mayhem. Tires."**
>
> A physics-based tire rolling destruction game with cinematic AI camera system, powered by Babylon.js and Cannon.js.

---

## Project Overview

TIRE CHAOS is a browser-based 3D physics game where players launch tires down hills to cause maximum destruction. The flagship feature is the **AI Camera Director** system that automatically creates Hollywood-quality cinematic shots.

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Engine** | Babylon.js | 6.42.0 |
| **Physics** | Cannon-ES | 0.20.0 |
| **Language** | TypeScript | 5.3+ |
| **Build Tool** | Vite | 5.x |
| **Testing** | Jest + Playwright | 29.x / 1.40+ |

### Key Dependencies

- `@babylonjs/core` - Core 3D engine
- `@babylonjs/materials` - PBR materials
- `@babylonjs/post-processes` - Visual effects
- `cannon-es` - Physics simulation

---

## Project Structure

```
tirechaos/
├── src/
│   ├── core/
│   │   └── GameManager.ts          # Singleton game controller
│   ├── entities/
│   │   ├── Tire.ts                 # Tire entity with PBR materials
│   │   └── __tests__/              # Entity unit tests
│   ├── systems/
│   │   ├── PhysicsManager.ts       # Physics simulation wrapper
│   │   ├── CameraDirector.ts       # AI camera system
│   │   ├── ScoringSystem.ts        # Score & combos
│   │   ├── InputHandler.ts         # Mouse/keyboard input
│   │   ├── UIManager.ts            # UI screens & HUD
│   │   ├── ParticleManager.ts      # Visual effects
│   │   ├── SoundManager.ts         # Audio system
│   │   ├── RoundManager.ts         # Multi-round progression
│   │   └── __tests__/              # System unit tests
│   ├── levels/
│   │   └── LevelGenerator.ts       # Procedural level generation
│   ├── types/
│   │   ├── index.ts                # Core types & configs
│   │   └── gameState.ts            # Game flow state types
│   ├── styles/
│   │   └── game-ui.css             # Game UI styles
│   ├── tests/
│   │   └── setup.ts                # Jest test environment
│   ├── __mocks__/@babylonjs/
│   │   └── core.ts                 # Babylon.js mock for tests
│   └── main.ts                     # Application entry point
├── e2e/
│   ├── gameplay.spec.ts            # E2E gameplay tests
│   └── performance.spec.ts         # Performance benchmarks
├── public/                         # Static assets
├── .github/workflows/
│   ├── deploy.yml                  # GitHub Pages deployment
│   └── e2e.yml                     # E2E test workflow
├── index.html                      # Entry HTML
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Vite build config
├── jest.config.ts                  # Jest test config
├── playwright.config.ts            # Playwright E2E config
├── .eslintrc.json                  # ESLint rules
└── .prettierrc.json                # Code formatting rules
```

---

## Build & Development Commands

### Development

```bash
# Start dev server (port 3000)
npm run dev

# Preview production build locally
npm run preview
```

### Building

```bash
# Production build (for local preview)
npm run build

# GitHub Pages build (sets correct base path)
npm run deploy
```

### Testing

```bash
# Run unit tests (Jest)
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests (Playwright)
npm run test:e2e

# E2E with UI mode
npm run test:e2e:ui
```

### Code Quality

```bash
# Lint TypeScript files
npm run lint

# Format code with Prettier
npm run format
```

---

## Architecture Patterns

### Singleton Pattern

The `GameManager` is the central controller using the Singleton pattern:

```typescript
const game = GameManager.getInstance();
await game.init();
```

All game systems are accessed through or managed by GameManager.

### Component-Based Systems

Game logic is split into specialized systems:

| System | Responsibility |
|--------|---------------|
| `PhysicsManager` | Physics simulation, collision detection |
| `CameraDirector` | AI-driven camera switching & framing |
| `ScoringSystem` | Points, combos, multipliers |
| `UIManager` | Menu screens, HUD, overlays |
| `ParticleManager` | Debris, explosions, effects |
| `RoundManager` | Multi-round progression & scoring |

### Event-Driven Communication

Custom DOM events for decoupled communication:

```typescript
// Dispatching events
window.dispatchEvent(new CustomEvent('objectDestroyed', {
  detail: { points, position }
}));

// Listening to events
window.addEventListener('start-game', () => this.startNewGame());
window.addEventListener('round-complete', (e) => { ... });
```

---

## Code Style Guidelines

### TypeScript Configuration

- **Strict mode**: Enabled
- **Target**: ES2020
- **Module**: ESNext with bundler resolution
- **Path aliases**: `@/*` maps to `src/*`

### Naming Conventions

```typescript
// Classes: PascalCase
class Tire { }
class PhysicsManager { }

// Interfaces: PascalCase with descriptive names
interface TireConfig { }
interface PhysicsConfig { }

// Enums: PascalCase, members UPPER_SNAKE_CASE
enum TireType {
  STANDARD = 'standard',
  MONSTER_TRUCK = 'monster_truck',
}

// Variables/functions: camelCase
const tireCount = 5;
function calculateScore() { }

// Private members: underscore prefix (in classes)
private _currentLaunchPosition: Vector3;
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### ESLint Rules

- `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"`
- Explicit return types not required
- `no-explicit-any` warns but doesn't error

---

## Testing Strategy

### Unit Tests (Jest)

- **Location**: `src/**/__tests__/**/*.test.ts`
- **Environment**: jsdom with WebGL mocks
- **Coverage Thresholds**: 70% (branches, functions, lines, statements)

```typescript
// Example test pattern
import { Tire } from '../Tire';

describe('Tire', () => {
  test('creates tire with correct type', () => {
    const tire = new Tire(TireType.STANDARD, scene, physics);
    expect(tire.config.type).toBe(TireType.STANDARD);
  });
});
```

### Test Mocks

Babylon.js is mocked in `src/__mocks__/@babylonjs/core.ts` for unit tests.

### E2E Tests (Playwright)

- **Location**: `e2e/*.spec.ts`
- **Browsers**: Chromium, Firefox, WebKit
- **Base URL**: `http://localhost:3000`

```typescript
// E2E test pattern
import { test, expect } from '@playwright/test';

test('game loads successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TIRE CHAOS/);
});
```

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### Deploy to GitHub Pages (`.github/workflows/deploy.yml`)

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Steps:**
1. Checkout code
2. Setup Node.js 20
3. Cache `node_modules` (keyed by `package.json` hash)
4. Install dependencies (`npm install --no-save`)
5. Run unit tests
6. Build with `GITHUB_PAGES=true`
7. Deploy to GitHub Pages

**Note:** Lock files are intentionally excluded from version control.

#### E2E Tests (`.github/workflows/e2e.yml`)

**Triggers:**
- Pull requests to `main`
- Manual workflow dispatch

**Steps:**
1. Install dependencies
2. Install Playwright browsers (Chromium only)
3. Build project
4. Run E2E tests
5. Upload Playwright report on failure

---

## Vite Build Configuration

### Chunk Splitting

The build splits code into optimized chunks:

| Chunk | Contents |
|-------|----------|
| `vendor-babylon` | All `@babylonjs/*` packages (~3.5MB) |
| `vendor-cannon` | `cannon-es` physics engine |
| `vendor` | Other npm dependencies |
| `game` | Application code |

### Base Path

```typescript
// vite.config.ts
base: process.env.GITHUB_PAGES === 'true' ? '/tirechaos/' : '/'
```

- Local dev: `/`
- GitHub Pages: `/tirechaos/`

---

## Game Controls & Features

### Player Controls

| Input | Action |
|-------|--------|
| Click & Drag | Aim (shows trajectory) |
| Release | Launch tire |
| `R` | Reset level |
| `Space` | Quick launch |
| `P` | Pause/Resume |
| `C` | Cycle camera types |
| `1-5` | Switch tire types |
| `F` | Toggle FPS display |
| `F11` | Fullscreen |

### Tire Types

1. **Standard** - Balanced, good all-rounder
2. **Monster Truck** - Heavy, high friction, destroys everything
3. **Racing Slick** - Fast, low friction, slides far
4. **Tractor** - Maximum friction, slow but powerful
5. **Spare** - Light, bouncy, unpredictable

---

## Key Technical Details

### Physics Integration

Babylon.js uses Cannon.js via the `CannonJSPlugin`:

```typescript
// Expose CANNON globally (required for production)
(window as any).CANNON = CANNON;

// Enable physics
scene.enablePhysics(
  new BABYLON.Vector3(0, -9.82, 0),
  new BABYLON.CannonJSPlugin()
);
```

### PBR Materials

All materials use PBR workflow:

```typescript
const material = new BABYLON.PBRMetallicRoughnessMaterial('mat', scene);
material.baseColor = BABYLON.Color3.FromHexString('#2d3142');
material.metallic = 0.0;
material.roughness = 0.9;
```

### Post-Processing Pipeline

Default rendering pipeline includes:
- MSAA (4 samples)
- Bloom effect
- HDR tone mapping (ACES)
- Chromatic aberration
- Film grain

---

## Deployment

### GitHub Pages Setup

1. Repository Settings → Pages → Source: GitHub Actions
2. Push to `main` triggers automatic deployment
3. Site URL: `https://dseeker.github.io/tirechaos/`

### Environment Configuration

If deployment fails with "Branch is not allowed":

1. Settings → Environments → github-pages
2. Deployment branches: Select "No restriction" OR add `main` rule
3. Re-run failed workflow

---

## Common Development Tasks

### Adding a New System

1. Create file in `src/systems/YourSystem.ts`
2. Import in `GameManager.ts` and initialize in constructor
3. Add cleanup in `destroy()` if needed
4. Write tests in `src/systems/__tests__/YourSystem.test.ts`

### Adding a New Tire Type

1. Extend `TireType` enum in `src/types/index.ts`
2. Add configuration to `TIRE_CONFIGS` constant
3. Update UI to display new type

### Modifying Level Generation

1. Edit `src/levels/LevelGenerator.ts`
2. Update `getLevelLayout()` function for round-based layouts
3. Test with different round numbers

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| FPS (Desktop) | 60 | 60 ✅ |
| FPS (Mobile) | 30 | TBD |
| Load Time | <3s | ~2s ✅ |
| Bundle Size | <5MB | ~4MB ✅ |
| Memory Usage | <500MB | ~300MB ✅ |

---

## Security Considerations

- Game runs entirely client-side
- No server-side components
- LocalStorage used for high scores only
- No sensitive data transmission

---

## Troubleshooting

### Build Issues

```bash
# Clean install
rm -rf node_modules dist
npm install
npm run build
```

### Test Failures

```bash
# Update snapshots
npm test -- --updateSnapshot

# Run specific test
npm test -- Tire.test.ts
```

### WebGL Issues

- Ensure browser supports WebGL 2.0
- Check console for shader compilation errors
- Verify GPU drivers are up to date

---

## Documentation References

- [README.md](./README.md) - Project overview & quick start
- [ROADMAP.md](./ROADMAP.md) - Development roadmap & future plans
- [DEPLOY.md](./DEPLOY.md) - Detailed deployment guide
- [MIGRATION_BABYLON.md](./MIGRATION_BABYLON.md) - Three.js to Babylon.js migration

---

## License

MIT License - See [LICENSE](./LICENSE) for details.

---

*Built with ❤️ by the TIRE CHAOS team*
