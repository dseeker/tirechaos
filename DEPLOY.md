# GitHub Pages Deployment Guide

This document provides step-by-step instructions for deploying TIRE CHAOS to GitHub Pages.

## One-Time Setup

### 1. Configure GitHub Pages in Repository Settings

1. Go to your repository on GitHub: https://github.com/dseeker/tirechaos
2. Click on **Settings** (top navigation bar)
3. In the left sidebar, click on **Pages** (under "Code and automation")
4. Under **Source**, select **GitHub Actions** from the dropdown
   - ⚠️ Do NOT select "Deploy from a branch" - we're using GitHub Actions instead
5. Save the changes

That's it! GitHub Pages is now configured to deploy using the workflow.

## Automatic Deployment

Once the setup is complete, the site automatically deploys whenever you push to the `main` branch:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

The GitHub Actions workflow will:
1. 📦 Install dependencies (`npm install` - no lock file required)
2. ✅ Run unit tests (`npm test`)
3. 🏗️ Build the project with `GITHUB_PAGES=true` environment variable
4. 📦 Split the bundle into optimized chunks:
   - `vendor-babylon.js` - All Babylon.js packages (~3.5MB)
   - `vendor-cannon.js` - Cannon-es physics engine
   - `vendor.js` - Other dependencies
   - `game.js` - Your game code
5. 🚀 Deploy the `dist/` folder to GitHub Pages

**Note:** This project intentionally excludes lock files (`package-lock.json`, `yarn.lock`) from version control.
The workflow caches `node_modules` based on `package.json` hash for faster builds.

## Manual Deployment

You can also trigger a deployment manually without pushing code:

1. Go to the **Actions** tab in your GitHub repository
2. Click on **Deploy to GitHub Pages** workflow (left sidebar)
3. Click the **Run workflow** button (top right)
4. Select the `main` branch
5. Click **Run workflow**

## Accessing Your Deployed Site

Once the deployment completes (usually 1-2 minutes), your site will be available at:

**https://dseeker.github.io/tirechaos/**

## Local Testing Before Deploy

To test the production build locally with the correct base path:

```bash
# Build with GitHub Pages configuration
npm run deploy

# Preview the production build
npm run preview
```

Note: The preview server will serve from `/` not `/tirechaos/`, so some paths may not work exactly as they will on GitHub Pages. For the most accurate test, you can temporarily change the `base` in `vite.config.ts` to `'/tirechaos/'`.

## Troubleshooting

### "Branch is not allowed to deploy to github-pages" (environment protection error)

This is the most common first-time failure. GitHub automatically creates a `github-pages`
environment with branch-protection rules that may not include `main`.

**Fix — two options (pick one):**

**Option A — Recommended: remove the restriction entirely**
1. In your repo → **Settings** → **Environments** → click **github-pages**
2. Under **Deployment branches and tags** → change to **No restriction**
3. Click **Save protection rules**
4. Re-run the failed workflow from the **Actions** tab → **Re-run all jobs**

**Option B — allow only `main`**
1. In your repo → **Settings** → **Environments** → click **github-pages**
2. Under **Deployment branches and tags** → **Add deployment branch or tag rule**
3. Enter `main` → **Add rule** → **Save protection rules**
4. Re-run the failed workflow

> If you don't see a `github-pages` environment yet, first complete the
> **Pages source** step below — GitHub creates the environment automatically
> when you switch the source to "GitHub Actions".

### Deployment Fails

1. Check the **Actions** tab to see the error logs
2. Common issues:
   - **Tests failing**: Fix the failing tests before deploying
   - **Build errors**: Run `npm run build` locally to reproduce
   - **Permission errors**: Ensure Pages has write permissions in Settings

### Site Shows 404

1. Verify GitHub Pages is set to **GitHub Actions** source (not branch)
2. Wait a few minutes - DNS propagation can take time on first deploy
3. Check the Actions tab to confirm deployment succeeded

### Assets Not Loading

If you see 404s for CSS/JS files:
1. Verify `GITHUB_PAGES=true` is set during build
2. Check that `base: '/tirechaos/'` is configured in `vite.config.ts`
3. Clear your browser cache

### Slow Initial Load

The first load will download ~4-5MB of JavaScript (primarily Babylon.js). The bundle is split into chunks that are cached by the browser:
- Subsequent visits load from cache
- Consider adding a loading screen in `index.html`
- The physics engine and rendering libraries are large but necessary for 3D gameplay

## Technical Details

### Bundle Splitting

The build configuration splits dependencies into optimized chunks:

- **vendor-babylon**: All `@babylonjs/*` packages (core, materials, loaders, etc.)
- **vendor-cannon**: `cannon-es` physics engine
- **vendor**: Other npm dependencies
- **game**: Your game code (main, UI, physics wrapper, etc.)

This allows browsers to cache the large vendor libraries separately from your frequently-changing game code.

### Base Path Configuration

The `vite.config.ts` uses an environment variable to set the correct base path:

```typescript
base: process.env.GITHUB_PAGES === 'true' ? '/tirechaos/' : '/'
```

- Local dev (`npm run dev`): Uses `/` for simplicity
- GitHub Pages build: Uses `/tirechaos/` to match the repository subdirectory

### 404 Fallback for SPA

The `public/404.html` file handles client-side routing for single-page applications:
- GitHub Pages serves `404.html` for unknown routes
- The script redirects to `index.html` while preserving the path
- This allows direct navigation to routes like `/tirechaos/game` to work correctly

## Monitoring Deployments

Each deployment creates a new workflow run visible in the **Actions** tab:
- ✅ Green checkmark = Successful deployment
- ❌ Red X = Failed deployment (click to see logs)
- ⏱️ Yellow dot = Deployment in progress

Typical deployment time: **2-3 minutes** from push to live site.

## Need Help?

- Check GitHub Actions logs for detailed error messages
- Verify all environment variables are set correctly
- Test the build locally with `npm run deploy` before pushing
- Ensure your repository settings allow GitHub Pages deployment
