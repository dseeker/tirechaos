import { RoundData, GameSession, GameFlowState } from '../types/gameState';

/**
 * RoundManager - Handles game rounds, progression, and difficulty scaling
 */
export class RoundManager {
  private session: GameSession;
  private roundStartTime: number = 0;
  private timerInterval?: number;

  constructor() {
    this.session = this.createNewSession();
    console.log('🎮 Round Manager initialized');
  }

  /**
   * Create a new game session
   */
  private createNewSession(): GameSession {
    const totalRounds = 5; // Campaign mode: 5 rounds
    const rounds: RoundData[] = [];

    // Generate progressive rounds with increasing difficulty
    for (let i = 1; i <= totalRounds; i++) {
      rounds.push({
        roundNumber: i,
        targetScore: 1000 * i, // Increasing target
        timeLimit: Math.max(60 - (i - 1) * 5, 30), // 60s to 30s
        tiresAvailable: Math.max(5 - Math.floor((i - 1) / 2), 2), // 5 to 2 tires
        objectsToDestroy: 5 + (i - 1) * 3, // 5 to 17 objects
        completed: false,
        score: 0,
        timeRemaining: 0,
      });
    }

    return {
      currentState: GameFlowState.MENU,
      currentRound: 0,
      totalRounds,
      totalScore: 0,
      highScore: this.loadHighScore(),
      rounds,
      startTime: 0,
    };
  }

  /**
   * Load high score from localStorage
   */
  private loadHighScore(): number {
    const saved = localStorage.getItem('tireChaosHighScore');
    return saved ? parseInt(saved, 10) : 0;
  }

  /**
   * Save high score to localStorage
   */
  private saveHighScore(): void {
    if (this.session.totalScore > this.session.highScore) {
      this.session.highScore = this.session.totalScore;
      localStorage.setItem('tireChaosHighScore', this.session.highScore.toString());
      console.log(`🏆 New high score: ${this.session.highScore}`);
    }
  }

  /**
   * Start a new game
   */
  public startNewGame(): void {
    this.session = this.createNewSession();
    this.session.currentState = GameFlowState.PLAYING;
    this.session.startTime = performance.now();
    this.startRound(1);
  }

  /**
   * Start a specific round
   */
  public startRound(roundNumber: number): void {
    if (roundNumber < 1 || roundNumber > this.session.totalRounds) {
      console.error(`Invalid round number: ${roundNumber}`);
      return;
    }

    this.session.currentRound = roundNumber;
    const round = this.session.rounds[roundNumber - 1];

    // Reset round data
    round.completed = false;
    round.score = 0;
    round.timeRemaining = round.timeLimit;

    // Start timer
    this.roundStartTime = performance.now();
    this.startTimer();

    console.log(`🎯 Starting Round ${roundNumber}/${this.session.totalRounds}`);
    console.log(`   Target Score: ${round.targetScore}`);
    console.log(`   Time Limit: ${round.timeLimit}s`);
    console.log(`   Tires Available: ${round.tiresAvailable}`);
    console.log(`   Objects to Destroy: ${round.objectsToDestroy}`);
  }

  /**
   * Start round timer
   */
  private startTimer(): void {
    this.stopTimer();

    this.timerInterval = window.setInterval(() => {
      const round = this.getCurrentRound();
      if (!round) return;

      const elapsed = (performance.now() - this.roundStartTime) / 1000;
      round.timeRemaining = Math.max(0, round.timeLimit - elapsed);

      // Emit time update event
      window.dispatchEvent(
        new CustomEvent('round-time-update', {
          detail: { timeRemaining: round.timeRemaining },
        })
      );

      // Check for time up
      if (round.timeRemaining <= 0) {
        this.stopTimer();
        this.checkRoundComplete();
      }
    }, 100);
  }

  /**
   * Stop round timer
   */
  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  /**
   * Get current round data
   */
  public getCurrentRound(): RoundData | null {
    if (this.session.currentRound < 1 || this.session.currentRound > this.session.totalRounds) {
      return null;
    }
    return this.session.rounds[this.session.currentRound - 1];
  }

  /**
   * Add score to current round
   */
  public addScore(points: number): void {
    const round = this.getCurrentRound();
    if (!round) return;

    round.score += points;
    this.session.totalScore += points;

    // Check for round completion
    this.checkRoundComplete();
  }

  /**
   * Use a tire
   */
  public useTire(): boolean {
    const round = this.getCurrentRound();
    if (!round || round.tiresAvailable <= 0) {
      return false;
    }

    round.tiresAvailable--;

    // Emit tire used event
    window.dispatchEvent(
      new CustomEvent('tire-used', {
        detail: { remaining: round.tiresAvailable },
      })
    );

    // Check if no tires left
    if (round.tiresAvailable === 0) {
      this.checkRoundComplete();
    }

    return true;
  }

  /**
   * Increment objects destroyed
   */
  public incrementObjectsDestroyed(): void {
    const round = this.getCurrentRound();
    if (!round) return;

    // Track in round data (using objectsToDestroy as the counter)
    if (round.objectsToDestroy > 0) {
      round.objectsToDestroy--;
    }

    // Check for round completion
    this.checkRoundComplete();
  }

  /**
   * Check if round is complete
   */
  private checkRoundComplete(): void {
    const round = this.getCurrentRound();
    if (!round) return;

    // Check victory conditions
    const targetReached = round.score >= round.targetScore;
    const allDestroyed = round.objectsToDestroy <= 0;
    const outOfTime = round.timeRemaining <= 0;
    const outOfTires = round.tiresAvailable <= 0;

    // Round complete if target reached or all destroyed
    if (targetReached || allDestroyed) {
      this.completeRound(true);
    }
    // Round failed if out of time or tires without completing
    else if (outOfTime || outOfTires) {
      this.completeRound(false);
    }
  }

  /**
   * Complete current round
   */
  private completeRound(success: boolean): void {
    const round = this.getCurrentRound();
    if (!round) return;

    this.stopTimer();
    round.completed = success;

    // Save high score
    this.saveHighScore();

    if (success) {
      console.log(`✅ Round ${this.session.currentRound} completed!`);
      console.log(`   Score: ${round.score}`);
      console.log(`   Time Remaining: ${round.timeRemaining.toFixed(1)}s`);

      // Emit round complete event
      window.dispatchEvent(
        new CustomEvent('round-complete', {
          detail: {
            roundNumber: this.session.currentRound,
            isLastRound: this.session.currentRound === this.session.totalRounds,
            roundData: round,
          },
        })
      );
    } else {
      console.log(`❌ Round ${this.session.currentRound} failed!`);

      // Emit game over event
      window.dispatchEvent(
        new CustomEvent('game-over', {
          detail: {
            totalScore: this.session.totalScore,
            roundsCompleted: this.session.currentRound - 1,
            highScore: this.session.highScore,
          },
        })
      );
    }
  }

  /**
   * Advance to next round
   */
  public nextRound(): void {
    if (this.session.currentRound >= this.session.totalRounds) {
      // Game complete!
      this.completeGame();
      return;
    }

    this.startRound(this.session.currentRound + 1);
  }

  /**
   * Complete the entire game
   */
  private completeGame(): void {
    console.log('🎉 Game completed!');
    console.log(`   Final Score: ${this.session.totalScore}`);

    // Emit victory event
    window.dispatchEvent(
      new CustomEvent('game-victory', {
        detail: {
          finalScore: this.session.totalScore,
          totalRounds: this.session.totalRounds,
          highScore: this.session.highScore,
          isNewHighScore: this.session.totalScore > this.session.highScore,
        },
      })
    );
  }

  /**
   * Pause current round
   */
  public pause(): void {
    this.stopTimer();
  }

  /**
   * Resume current round
   */
  public resume(): void {
    // Adjust start time to account for pause
    const round = this.getCurrentRound();
    if (!round) return;

    const elapsed = round.timeLimit - round.timeRemaining;
    this.roundStartTime = performance.now() - elapsed * 1000;
    this.startTimer();
  }

  /**
   * Reset current round
   */
  public resetRound(): void {
    this.stopTimer();
    this.startRound(this.session.currentRound);
  }

  /**
   * Get session data
   */
  public getSession(): GameSession {
    return { ...this.session };
  }

  /**
   * Get high score
   */
  public getHighScore(): number {
    return this.session.highScore;
  }

  /**
   * Get total score
   */
  public getTotalScore(): number {
    return this.session.totalScore;
  }

  /**
   * Get current round number
   */
  public getCurrentRoundNumber(): number {
    return this.session.currentRound;
  }

  /**
   * Get total rounds
   */
  public getTotalRounds(): number {
    return this.session.totalRounds;
  }

  /**
   * Check if game is in progress
   */
  public isGameInProgress(): boolean {
    return (
      this.session.currentRound > 0 &&
      this.session.currentRound <= this.session.totalRounds &&
      this.session.currentState === GameFlowState.PLAYING
    );
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopTimer();
  }
}
