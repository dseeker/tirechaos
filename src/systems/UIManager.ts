import { GameFlowState, UIElements, RoundData } from '../types/gameState';
import { LeaderboardEntry } from './LeaderboardManager';

/**
 * UIManager - Handles all UI elements, HUD updates, and screen overlays
 */
export class UIManager {
  private elements: UIElements;
  private currentState: GameFlowState = GameFlowState.MENU;

  constructor() {
    this.elements = this.initializeElements();
    this.createHUD();
    this.createMenuScreens();
    console.log('🎨 UI Manager initialized');
  }

  /**
   * Initialize UI element references
   */
  private initializeElements(): UIElements {
    return {
      scoreDisplay: document.getElementById('score-value'),
      comboDisplay: document.getElementById('combo-value'),
      roundDisplay: document.getElementById('round-value'),
      tiresDisplay: document.getElementById('tires-value'),
      timeDisplay: document.getElementById('time-value'),
      powerMeter: document.getElementById('power-meter'),
      fpsDisplay: document.getElementById('fps-value'),
      messageDisplay: document.getElementById('message-display'),
    };
  }

  /**
   * Create HUD overlay with score, combo, etc.
   */
  private createHUD(): void {
    const existingHUD = document.getElementById('game-hud');
    if (existingHUD) return;

    const hud = document.createElement('div');
    hud.id = 'game-hud';
    hud.className = 'game-hud hidden';
    hud.innerHTML = `
      <div class="hud-top">
        <div class="hud-section">
          <div class="hud-label">SCORE</div>
          <div id="score-value" class="hud-value">0</div>
        </div>
        <div class="hud-section">
          <div class="hud-label">ROUND</div>
          <div id="round-value" class="hud-value">1</div>
        </div>
        <div class="hud-section">
          <div class="hud-label">COMBO</div>
          <div id="combo-value" class="hud-value combo">0x</div>
        </div>
      </div>

      <div class="hud-bottom">
        <div class="hud-section">
          <div class="hud-label">TIRES</div>
          <div id="tires-value" class="hud-value">3</div>
        </div>
        <div class="hud-section">
          <div class="hud-label">TIME</div>
          <div id="time-value" class="hud-value">60</div>
        </div>
        <div class="hud-section">
          <div class="hud-label">FPS</div>
          <div id="fps-value" class="hud-value">60</div>
        </div>
      </div>

      <div class="power-meter-container">
        <div class="power-label">POWER</div>
        <div class="power-bar">
          <div id="power-meter" class="power-fill"></div>
        </div>
        <div class="power-angle">
          <span id="angle-value">45°</span>
        </div>
      </div>

      <div id="trajectory-indicator" class="trajectory-indicator hidden">
        <div class="trajectory-arrow">↗</div>
      </div>

      <div id="message-display" class="message-display"></div>
    `;

    document.body.appendChild(hud);

    // Update element references
    this.elements = this.initializeElements();
  }

  /**
   * Create menu and overlay screens
   */
  private createMenuScreens(): void {
    this.createMainMenu();
    this.createInstructionsScreen();
    this.createPauseMenu();
    this.createSettingsScreen();
    this.createRoundEndScreen();
    this.createGameOverScreen();
    this.createLeaderboardScreen();
  }

  /**
   * Create main menu
   */
  private createMainMenu(): void {
    const existingMenu = document.getElementById('main-menu');
    if (existingMenu) return;

    const menu = document.createElement('div');
    menu.id = 'main-menu';
    menu.className = 'screen-overlay';
    menu.innerHTML = `
      <div class="menu-container">
        <h1 class="game-title">
          <span class="title-line">TIRE</span>
          <span class="title-line">CHAOS</span>
        </h1>
        <p class="game-tagline">Physics. Mayhem. Tires.</p>
        <div class="menu-buttons">
          <button id="btn-start" class="menu-button primary">START GAME</button>
          <button id="btn-leaderboard" class="menu-button">LEADERBOARD</button>
          <button id="btn-instructions" class="menu-button">HOW TO PLAY</button>
          <button id="btn-settings" class="menu-button">SETTINGS</button>
        </div>
        <div class="high-score">
          High Score: <span id="menu-high-score">0</span>
        </div>
        <div class="version">v0.2.0 - Babylon.js Edition</div>
      </div>
    `;

    document.body.appendChild(menu);

    // Add event listeners
    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.dispatchGameEvent('start-game');
    });

    document.getElementById('btn-leaderboard')?.addEventListener('click', () => {
      this.dispatchGameEvent('show-leaderboard');
    });

    document.getElementById('btn-instructions')?.addEventListener('click', () => {
      this.showInstructions();
    });
  }

  /**
   * Create instructions screen
   */
  private createInstructionsScreen(): void {
    const existingInstructions = document.getElementById('instructions-screen');
    if (existingInstructions) return;

    const instructions = document.createElement('div');
    instructions.id = 'instructions-screen';
    instructions.className = 'screen-overlay hidden';
    instructions.innerHTML = `
      <div class="menu-container">
        <h2>HOW TO PLAY</h2>
        <div class="instructions-content">
          <div class="instruction-section">
            <h3>🎯 OBJECTIVE</h3>
            <p>Launch tires to destroy objects and score points!<br>
            Complete rounds by hitting targets before time runs out.</p>
          </div>

          <div class="instruction-section">
            <h3>🖱️ CONTROLS</h3>
            <ul>
              <li><strong>Mouse:</strong> Click and drag to aim, release to launch</li>
              <li><strong>Spacebar:</strong> Quick launch with default power</li>
              <li><strong>R:</strong> Reset level</li>
              <li><strong>P:</strong> Pause game</li>
              <li><strong>1-5:</strong> Switch camera angles</li>
              <li><strong>C:</strong> Cycle camera modes</li>
            </ul>
          </div>

          <div class="instruction-section">
            <h3>🎮 SCORING</h3>
            <ul>
              <li><strong>Destroy Objects:</strong> Earn points and combos</li>
              <li><strong>Combo Chain:</strong> Hit multiple objects quickly for multipliers</li>
              <li><strong>Distance Bonus:</strong> Longer shots = more points</li>
              <li><strong>Style Points:</strong> Trick shots and ricochets</li>
            </ul>
          </div>

          <div class="instruction-section">
            <h3>🛞 TIRE TYPES</h3>
            <ul>
              <li><strong>Standard:</strong> Balanced performance</li>
              <li><strong>Monster Truck:</strong> Heavy, great for smashing</li>
              <li><strong>Racing Slick:</strong> Fast and light</li>
              <li><strong>Tractor:</strong> Maximum grip and power</li>
              <li><strong>Spare:</strong> Small but bouncy</li>
            </ul>
          </div>
        </div>
        <button id="btn-back" class="menu-button">BACK TO MENU</button>
      </div>
    `;

    document.body.appendChild(instructions);

    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.showMainMenu();
    });
  }

  /**
   * Create pause menu
   */
  private createPauseMenu(): void {
    const existingPause = document.getElementById('pause-menu');
    if (existingPause) return;

    const pause = document.createElement('div');
    pause.id = 'pause-menu';
    pause.className = 'screen-overlay hidden';
    pause.innerHTML = `
      <div class="menu-container">
        <h2>PAUSED</h2>
        <div class="menu-buttons">
          <button id="btn-resume" class="menu-button primary">RESUME</button>
          <button id="btn-restart" class="menu-button">RESTART</button>
          <button id="btn-pause-settings" class="menu-button">SETTINGS</button>
          <button id="btn-quit" class="menu-button">QUIT TO MENU</button>
        </div>
        <div class="pause-tip">Press P to resume</div>
      </div>
    `;

    document.body.appendChild(pause);

    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.dispatchGameEvent('resume-game');
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.dispatchGameEvent('restart-game');
    });

    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      this.showSettings();
    });

    document.getElementById('btn-quit')?.addEventListener('click', () => {
      this.dispatchGameEvent('quit-to-menu');
    });
  }

  /**
   * Create settings screen
   */
  private createSettingsScreen(): void {
    const existingSettings = document.getElementById('settings-screen');
    if (existingSettings) return;

    const settings = document.createElement('div');
    settings.id = 'settings-screen';
    settings.className = 'settings-screen hidden';
    settings.innerHTML = `
      <div class="menu-container">
        <h2>SETTINGS</h2>

        <div class="settings-group">
          <label class="settings-label" for="music-volume">MUSIC VOLUME</label>
          <input id="music-volume" class="slider-control" type="range" min="0" max="100" value="70">
        </div>

        <div class="settings-group">
          <label class="settings-label" for="sfx-volume">SFX VOLUME</label>
          <input id="sfx-volume" class="slider-control" type="range" min="0" max="100" value="100">
        </div>

        <div class="settings-group">
          <span class="settings-label">QUALITY</span>
          <div class="quality-buttons">
            <button class="quality-btn" data-level="low">LOW</button>
            <button class="quality-btn active" data-level="medium">MEDIUM</button>
            <button class="quality-btn" data-level="high">HIGH</button>
          </div>
        </div>

        <div class="settings-group">
          <span class="settings-label">AUDIO</span>
          <button id="mute-toggle" class="mute-btn menu-button">🔇 MUTE</button>
        </div>

        <div class="menu-buttons">
          <button id="btn-settings-back" class="menu-button primary">BACK</button>
        </div>
      </div>
    `;

    document.body.appendChild(settings);

    document.getElementById('music-volume')?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      window.dispatchEvent(new CustomEvent('music-volume-change', { detail: { value } }));
    });

    document.getElementById('sfx-volume')?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value, 10);
      window.dispatchEvent(new CustomEvent('sfx-volume-change', { detail: { value } }));
    });

    settings.querySelectorAll<HTMLButtonElement>('.quality-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        settings.querySelectorAll('.quality-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const level = btn.dataset.level as 'low' | 'medium' | 'high';
        window.dispatchEvent(new CustomEvent('quality-change', { detail: { level } }));
      });
    });

    const muteBtn = document.getElementById('mute-toggle');
    muteBtn?.addEventListener('click', () => {
      const isMuted = muteBtn.textContent?.includes('MUTE') && !muteBtn.textContent?.includes('UNMUTE');
      muteBtn.textContent = isMuted ? '🔊 UNMUTE' : '🔇 MUTE';
      window.dispatchEvent(new CustomEvent('mute-toggle'));
    });

    document.getElementById('btn-settings-back')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('settings-close'));
    });
  }

  /**
   * Create round end screen
   */
  private createRoundEndScreen(): void {
    const existingRoundEnd = document.getElementById('round-end-screen');
    if (existingRoundEnd) return;

    const roundEnd = document.createElement('div');
    roundEnd.id = 'round-end-screen';
    roundEnd.className = 'screen-overlay hidden';
    roundEnd.innerHTML = `
      <div class="menu-container">
        <h2 id="round-end-title">ROUND COMPLETE!</h2>
        <div class="round-stats">
          <div class="stat-item">
            <span class="stat-label">Score:</span>
            <span id="round-score" class="stat-value">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Objects Destroyed:</span>
            <span id="round-objects" class="stat-value">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Max Combo:</span>
            <span id="round-combo" class="stat-value">0x</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Time Remaining:</span>
            <span id="round-time" class="stat-value">0s</span>
          </div>
        </div>
        <button id="btn-next-round" class="menu-button primary">NEXT ROUND</button>
      </div>
    `;

    document.body.appendChild(roundEnd);

    document.getElementById('btn-next-round')?.addEventListener('click', () => {
      this.dispatchGameEvent('next-round');
    });
  }

  /**
   * Create game over screen
   */
  private createGameOverScreen(): void {
    const existingGameOver = document.getElementById('game-over-screen');
    if (existingGameOver) return;

    const gameOver = document.createElement('div');
    gameOver.id = 'game-over-screen';
    gameOver.className = 'screen-overlay hidden';
    gameOver.innerHTML = `
      <div class="menu-container">
        <h2 id="game-over-title">GAME OVER</h2>
        <div class="final-stats">
          <div class="stat-big">
            <div class="stat-label">FINAL SCORE</div>
            <div id="final-score" class="stat-value-big">0</div>
          </div>
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-label">Rounds Completed:</span>
              <span id="total-rounds" class="stat-value">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Objects:</span>
              <span id="total-objects" class="stat-value">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Best Combo:</span>
              <span id="best-combo" class="stat-value">0x</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">High Score:</span>
              <span id="game-high-score" class="stat-value">0</span>
            </div>
          </div>
          <div id="new-high-score" class="new-high-score hidden">
            🏆 NEW HIGH SCORE! 🏆
          </div>
        </div>
        <div class="menu-buttons">
          <button id="btn-play-again" class="menu-button primary">PLAY AGAIN</button>
          <button id="btn-main-menu" class="menu-button">MAIN MENU</button>
        </div>
      </div>
    `;

    document.body.appendChild(gameOver);

    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      this.dispatchGameEvent('play-again');
    });

    document.getElementById('btn-main-menu')?.addEventListener('click', () => {
      this.dispatchGameEvent('main-menu');
    });
  }

  /**
   * Dispatch custom game event
   */
  private dispatchGameEvent(eventName: string): void {
    const event = new CustomEvent(eventName);
    window.dispatchEvent(event);
  }

  /**
   * Update score display
   */
  public updateScore(score: number): void {
    if (this.elements.scoreDisplay) {
      this.elements.scoreDisplay.textContent = score.toLocaleString();
    }
  }

  /**
   * Update combo display
   */
  public updateCombo(combo: number, multiplier: number): void {
    if (this.elements.comboDisplay) {
      this.elements.comboDisplay.textContent = `${multiplier.toFixed(1)}x`;

      // Add pulse animation for new combos
      if (combo > 0) {
        this.elements.comboDisplay.classList.add('pulse');
        setTimeout(() => {
          this.elements.comboDisplay?.classList.remove('pulse');
        }, 300);
      }
    }
  }

  /**
   * Update round display
   */
  public updateRound(current: number, total: number): void {
    if (this.elements.roundDisplay) {
      this.elements.roundDisplay.textContent = `${current}/${total}`;
    }
  }

  /**
   * Update tires remaining
   */
  public updateTires(remaining: number): void {
    if (this.elements.tiresDisplay) {
      this.elements.tiresDisplay.textContent = remaining.toString();

      // Warning color if low
      if (remaining <= 1) {
        this.elements.tiresDisplay.classList.add('warning');
      } else {
        this.elements.tiresDisplay.classList.remove('warning');
      }
    }
  }

  /**
   * Update time remaining
   */
  public updateTime(seconds: number): void {
    if (this.elements.timeDisplay) {
      this.elements.timeDisplay.textContent = Math.ceil(seconds).toString();

      // Warning color if low
      if (seconds <= 10) {
        this.elements.timeDisplay.classList.add('warning');
      } else {
        this.elements.timeDisplay.classList.remove('warning');
      }
    }
  }

  /**
   * Update power meter
   */
  public updatePower(power: number, angle: number): void {
    if (this.elements.powerMeter) {
      this.elements.powerMeter.style.width = `${power * 100}%`;
    }

    const angleElement = document.getElementById('angle-value');
    if (angleElement) {
      angleElement.textContent = `${Math.round(angle)}°`;
    }
  }

  /**
   * Update FPS display
   */
  public updateFPS(fps: number): void {
    if (this.elements.fpsDisplay) {
      this.elements.fpsDisplay.textContent = Math.round(fps).toString();
    }
  }

  /**
   * Show floating message
   */
  public showMessage(message: string, duration: number = 2000, type: string = 'info'): void {
    if (!this.elements.messageDisplay) return;

    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = message;

    this.elements.messageDisplay.appendChild(messageEl);

    // Fade in
    setTimeout(() => messageEl.classList.add('show'), 10);

    // Fade out and remove
    setTimeout(() => {
      messageEl.classList.remove('show');
      setTimeout(() => messageEl.remove(), 300);
    }, duration);
  }

  /**
   * Show main menu
   */
  public showMainMenu(): void {
    this.hideAllScreens();
    document.getElementById('main-menu')?.classList.remove('hidden');
    this.currentState = GameFlowState.MENU;

    // Update high score
    const highScoreEl = document.getElementById('menu-high-score');
    if (highScoreEl) {
      const saved = localStorage.getItem('tireChaosHighScore');
      highScoreEl.textContent = saved || '0';
    }
  }

  /**
   * Show instructions
   */
  public showInstructions(): void {
    this.hideAllScreens();
    document.getElementById('instructions-screen')?.classList.remove('hidden');
    this.currentState = GameFlowState.INSTRUCTIONS;
  }

  /**
   * Show game HUD
   */
  public showGameHUD(): void {
    this.hideAllScreens();
    document.getElementById('game-hud')?.classList.remove('hidden');
    this.currentState = GameFlowState.PLAYING;
  }

  /**
   * Show pause menu
   */
  public showPauseMenu(): void {
    document.getElementById('pause-menu')?.classList.remove('hidden');
    this.currentState = GameFlowState.PAUSED;
  }

  /**
   * Hide pause menu
   */
  public hidePauseMenu(): void {
    document.getElementById('pause-menu')?.classList.add('hidden');
    this.currentState = GameFlowState.PLAYING;
  }

  /**
   * Show settings screen
   */
  public showSettings(): void {
    document.getElementById('settings-screen')?.classList.remove('hidden');
  }

  /**
   * Hide settings screen
   */
  public hideSettings(): void {
    document.getElementById('settings-screen')?.classList.add('hidden');
  }

  /**
   * Show round end screen
   */
  public showRoundEnd(roundData: RoundData, isLastRound: boolean): void {
    const screen = document.getElementById('round-end-screen');
    if (!screen) return;

    // Update title
    const title = document.getElementById('round-end-title');
    if (title) {
      title.textContent = isLastRound ? 'FINAL ROUND COMPLETE!' : `ROUND ${roundData.roundNumber} COMPLETE!`;
    }

    // Update stats
    document.getElementById('round-score')!.textContent = roundData.score.toLocaleString();
    document.getElementById('round-objects')!.textContent = roundData.objectsToDestroy.toString();
    document.getElementById('round-time')!.textContent = `${Math.ceil(roundData.timeRemaining)}s`;

    screen.classList.remove('hidden');
    this.currentState = GameFlowState.ROUND_END;
  }

  /**
   * Show game over screen
   */
  public showGameOver(
    finalScore: number,
    totalRounds: number,
    totalObjects: number,
    bestCombo: number,
    highScore: number,
    isNewHighScore: boolean
  ): void {
    const screen = document.getElementById('game-over-screen');
    if (!screen) return;

    // Update title based on success
    const title = document.getElementById('game-over-title');
    if (title) {
      title.textContent = totalRounds > 0 ? '🎉 VICTORY! 🎉' : 'GAME OVER';
    }

    // Update stats
    document.getElementById('final-score')!.textContent = finalScore.toLocaleString();
    document.getElementById('total-rounds')!.textContent = totalRounds.toString();
    document.getElementById('total-objects')!.textContent = totalObjects.toString();
    document.getElementById('best-combo')!.textContent = `${bestCombo}x`;
    document.getElementById('game-high-score')!.textContent = highScore.toLocaleString();

    // Show new high score banner
    if (isNewHighScore) {
      document.getElementById('new-high-score')?.classList.remove('hidden');
    }

    screen.classList.remove('hidden');
    this.currentState = GameFlowState.GAME_OVER;
  }

  /**
   * Hide all screen overlays
   */
  private hideAllScreens(): void {
    document.querySelectorAll('.screen-overlay').forEach((screen) => {
      screen.classList.add('hidden');
    });
    document.getElementById('game-hud')?.classList.add('hidden');
  }

  /**
   * Get current UI state
   */
  public getCurrentState(): GameFlowState {
    return this.currentState;
  }

  // ─── Leaderboard ────────────────────────────────────────────────────────────

  /**
   * Build the leaderboard screen DOM (hidden by default).
   */
  private createLeaderboardScreen(): void {
    if (document.getElementById('leaderboard-screen')) return;

    const screen = document.createElement('div');
    screen.id = 'leaderboard-screen';
    screen.className = 'screen-overlay hidden';
    screen.innerHTML = `
      <div class="menu-container leaderboard-container">
        <h2>LEADERBOARD</h2>
        <div class="leaderboard-table-wrapper">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>NAME</th>
                <th>SCORE</th>
                <th>ROUNDS</th>
                <th>BEST COMBO</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody id="leaderboard-tbody"></tbody>
          </table>
        </div>
        <button id="btn-leaderboard-back" class="menu-button">BACK</button>
      </div>
    `;

    document.body.appendChild(screen);

    document.getElementById('btn-leaderboard-back')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('leaderboard-close'));
    });
  }

  /**
   * Populate and display the leaderboard screen.
   */
  public showLeaderboard(entries: LeaderboardEntry[]): void {
    const screen = document.getElementById('leaderboard-screen');
    if (!screen) return;

    const tbody = document.getElementById('leaderboard-tbody');
    if (tbody) {
      if (entries.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="leaderboard-empty">No scores yet. Be the first!</td>
          </tr>
        `;
      } else {
        tbody.innerHTML = entries
          .map((entry, index) => {
            const rank = index + 1;
            const isGold = rank === 1;
            const dateStr = entry.date
              ? new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
              : '—';
            return `
              <tr class="leaderboard-row${isGold ? ' leaderboard-row--gold' : ''}">
                <td class="leaderboard-rank">#${rank}</td>
                <td class="leaderboard-name">${entry.name}</td>
                <td class="leaderboard-score">${entry.score.toLocaleString()}</td>
                <td>${entry.rounds}</td>
                <td>${entry.combo}x</td>
                <td class="leaderboard-date">${dateStr}</td>
              </tr>
            `;
          })
          .join('');
      }
    }

    this.hideAllScreens();
    screen.classList.remove('hidden');
  }

  /**
   * Hide the leaderboard screen.
   */
  public hideLeaderboard(): void {
    document.getElementById('leaderboard-screen')?.classList.add('hidden');
  }

  // ─── Name Entry Modal ────────────────────────────────────────────────────────

  /**
   * Show a modal prompting the player to enter their name for a high score.
   */
  public showNameEntry(score: number, onConfirm: (name: string) => void): void {
    // Remove any existing modal
    document.getElementById('name-entry-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'name-entry-overlay';
    overlay.className = 'name-entry-overlay';
    overlay.innerHTML = `
      <div class="name-entry-modal" role="dialog" aria-modal="true" aria-labelledby="name-entry-heading">
        <h2 id="name-entry-heading" class="name-entry-title">NEW HIGH SCORE!</h2>
        <p class="name-entry-score">${score.toLocaleString()} pts</p>
        <p class="name-entry-prompt">Enter your name:</p>
        <input
          id="name-entry-input"
          class="name-entry-input"
          type="text"
          maxlength="12"
          placeholder="YOUR NAME"
          autocomplete="off"
          spellcheck="false"
        />
        <button id="name-entry-submit" class="menu-button primary name-entry-submit">SUBMIT</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('name-entry-input') as HTMLInputElement;
    const submitBtn = document.getElementById('name-entry-submit') as HTMLButtonElement;

    // Force uppercase display
    input.addEventListener('input', () => {
      const pos = input.selectionStart ?? input.value.length;
      input.value = input.value.toUpperCase();
      input.setSelectionRange(pos, pos);
    });

    const submit = () => {
      const name = (input.value.trim().toUpperCase() || 'UNKNOWN').slice(0, 12);
      overlay.remove();
      onConfirm(name);
    };

    submitBtn.addEventListener('click', submit);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    // Auto-focus the input
    requestAnimationFrame(() => input.focus());
  }

  // ─── Clean up ────────────────────────────────────────────────────────────────

  /**
   * Clean up
   */
  public destroy(): void {
    // Remove all created elements
    document.getElementById('game-hud')?.remove();
    document.getElementById('main-menu')?.remove();
    document.getElementById('instructions-screen')?.remove();
    document.getElementById('pause-menu')?.remove();
    document.getElementById('settings-screen')?.remove();
    document.getElementById('round-end-screen')?.remove();
    document.getElementById('game-over-screen')?.remove();
    document.getElementById('leaderboard-screen')?.remove();
    document.getElementById('name-entry-overlay')?.remove();
  }
}
