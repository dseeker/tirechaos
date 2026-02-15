import { ScoreEvent, ComboChain } from '../types';

/**
 * ScoringSystem - Manages score calculation, combos, and multipliers
 */
export class ScoringSystem {
  private totalScore: number = 0;
  private currentCombo: ComboChain = {
    count: 0,
    multiplier: 1,
    lastHitTime: 0,
    timeWindow: 2000, // 2 seconds to maintain combo
  };
  private scoreEvents: ScoreEvent[] = [];
  private highScore: number = 0;

  constructor() {
    // Load high score from localStorage
    const savedHighScore = localStorage.getItem('tireChaosHighScore');
    if (savedHighScore) {
      this.highScore = parseInt(savedHighScore, 10);
    }

    console.log('📊 Scoring system initialized');
  }

  /**
   * Add score with optional combo multiplier
   */
  public addScore(points: number, isCombo: boolean = false): number {
    const currentTime = performance.now();

    // Check if combo window has expired
    if (currentTime - this.currentCombo.lastHitTime > this.currentCombo.timeWindow) {
      this.resetCombo();
    }

    // Update combo if applicable
    if (isCombo) {
      this.currentCombo.count++;
      this.currentCombo.lastHitTime = currentTime;
      this.currentCombo.multiplier = this.calculateComboMultiplier(this.currentCombo.count);
    } else {
      this.resetCombo();
    }

    // Calculate final score with multiplier
    const finalPoints = Math.floor(points * this.currentCombo.multiplier);
    this.totalScore += finalPoints;

    // Record score event
    const event: ScoreEvent = {
      type: 'object_destroyed',
      points: finalPoints,
      multiplier: this.currentCombo.multiplier,
      timestamp: currentTime,
    };
    this.scoreEvents.push(event);

    // Update high score if needed
    if (this.totalScore > this.highScore) {
      this.highScore = this.totalScore;
      this.saveHighScore();
    }

    console.log(
      `💰 +${finalPoints} points (${this.currentCombo.multiplier}x multiplier) | Total: ${this.totalScore}`,
    );

    return finalPoints;
  }

  /**
   * Calculate combo multiplier based on combo count
   */
  private calculateComboMultiplier(comboCount: number): number {
    if (comboCount <= 1) return 1;
    if (comboCount <= 3) return 1.5;
    if (comboCount <= 5) return 2;
    if (comboCount <= 10) return 3;
    return Math.min(5, 3 + (comboCount - 10) * 0.2); // Cap at 5x
  }

  /**
   * Add distance bonus
   */
  public addDistanceBonus(distance: number): number {
    const points = Math.floor(distance * 2); // 2 points per meter
    return this.addScore(points, false);
  }

  /**
   * Add style bonus for trick shots
   */
  public addStyleBonus(styleType: string, basePoints: number): number {
    const multiplier = this.getStyleMultiplier(styleType);
    const points = Math.floor(basePoints * multiplier);

    const event: ScoreEvent = {
      type: 'style',
      points: points,
      multiplier: multiplier,
      timestamp: performance.now(),
    };
    this.scoreEvents.push(event);

    this.totalScore += points;

    console.log(`🎯 Style bonus: ${styleType} +${points} points`);

    return points;
  }

  /**
   * Get style multiplier for different trick types
   */
  private getStyleMultiplier(styleType: string): number {
    const styleMultipliers: Record<string, number> = {
      perfect_release: 1.5,
      ricochet: 2.0,
      through_hoop: 2.5,
      off_ramp: 1.8,
      chain_reaction: 3.0,
    };

    return styleMultipliers[styleType] || 1.0;
  }

  /**
   * Reset combo chain
   */
  private resetCombo(): void {
    if (this.currentCombo.count > 0) {
      console.log(`🔗 Combo ended at ${this.currentCombo.count}x`);
    }

    this.currentCombo.count = 0;
    this.currentCombo.multiplier = 1;
  }

  /**
   * Get current combo count
   */
  public getComboCount(): number {
    return this.currentCombo.count;
  }

  /**
   * Get current combo multiplier
   */
  public getComboMultiplier(): number {
    return this.currentCombo.multiplier;
  }

  /**
   * Get total score
   */
  public getTotalScore(): number {
    return this.totalScore;
  }

  /**
   * Get high score
   */
  public getHighScore(): number {
    return this.highScore;
  }

  /**
   * Get all score events
   */
  public getScoreEvents(): ScoreEvent[] {
    return [...this.scoreEvents];
  }

  /**
   * Reset current game score (keep high score)
   */
  public reset(): void {
    this.totalScore = 0;
    this.scoreEvents = [];
    this.resetCombo();
    console.log('📊 Score reset');
  }

  /**
   * Save high score to localStorage
   */
  private saveHighScore(): void {
    localStorage.setItem('tireChaosHighScore', this.highScore.toString());
    console.log(`🏆 New high score: ${this.highScore}`);
  }

  /**
   * Get score statistics
   */
  public getStatistics(): {
    totalScore: number;
    highScore: number;
    averageCombo: number;
    maxCombo: number;
    totalEvents: number;
  } {
    let maxCombo = 0;
    let totalCombo = 0;
    let comboCount = 0;

    this.scoreEvents.forEach((event) => {
      if (event.multiplier > 1) {
        totalCombo += event.multiplier;
        comboCount++;
        maxCombo = Math.max(maxCombo, event.multiplier);
      }
    });

    return {
      totalScore: this.totalScore,
      highScore: this.highScore,
      averageCombo: comboCount > 0 ? totalCombo / comboCount : 0,
      maxCombo,
      totalEvents: this.scoreEvents.length,
    };
  }
}
