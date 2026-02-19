import { GameManager } from './core/GameManager';

/**
 * Main entry point for TIRE CHAOS
 * Initializes and starts the game
 */

async function main() {
  console.log(`
  ████████╗██╗██████╗ ███████╗     ██████╗██╗  ██╗ █████╗  ██████╗ ███████╗
  ╚══██╔══╝██║██╔══██╗██╔════╝    ██╔════╝██║  ██║██╔══██╗██╔═══██╗██╔════╝
     ██║   ██║██████╔╝█████╗      ██║     ███████║███████║██║   ██║███████╗
     ██║   ██║██╔══██╗██╔══╝      ██║     ██╔══██║██╔══██║██║   ██║╚════██║
     ██║   ██║██║  ██║███████╗    ╚██████╗██║  ██║██║  ██║╚██████╔╝███████║
     ╚═╝   ╚═╝╚═╝  ╚═╝╚══════╝     ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝

                    Physics. Mayhem. Tires.
                  NOW POWERED BY BABYLON.JS! 🎨
                         Let's roll! 🛞
  `);

  try {
    // Get game manager instance
    const gameManager = GameManager.getInstance();

    // Initialize game
    await gameManager.init();

    // Setup object destruction event listener
    window.addEventListener('objectDestroyed', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { points } = customEvent.detail;

      // Add score with combo
      gameManager.addScore(points, true);
      gameManager.gameState.objectsDestroyed++;
    });

    // Expose singleton for e2e tests — read-only reference, never written to.
    (window as any).__gameManager = gameManager;

    console.log('🎉 TIRE CHAOS is ready! Click and drag to aim, release to launch!');
  } catch (error) {
    console.error('❌ Failed to initialize game:', error);

    // Show error to user
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `
        <h1>TIRE CHAOS</h1>
        <p style="color: #ff6b35;">Error loading game</p>
        <p style="font-size: 14px;">Please refresh the page</p>
      `;
    }
  }
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// Handle unload
window.addEventListener('beforeunload', () => {
  const gameManager = GameManager.getInstance();
  gameManager.destroy();
});
