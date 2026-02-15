import { ScoringSystem } from '../ScoringSystem';

describe('ScoringSystem', () => {
  let scoringSystem: ScoringSystem;

  beforeEach(() => {
    localStorage.clear();
    scoringSystem = new ScoringSystem();
  });

  describe('Score Management', () => {
    it('should initialize with zero score', () => {
      expect(scoringSystem.getTotalScore()).toBe(0);
    });

    it('should add score correctly', () => {
      scoringSystem.addScore(100);
      expect(scoringSystem.getTotalScore()).toBe(100);
    });

    it('should add multiple scores correctly', () => {
      scoringSystem.addScore(100);
      scoringSystem.addScore(50);
      scoringSystem.addScore(25);
      expect(scoringSystem.getTotalScore()).toBe(175);
    });

    it('should reset score correctly', () => {
      scoringSystem.addScore(1000);
      scoringSystem.reset();
      expect(scoringSystem.getTotalScore()).toBe(0);
    });
  });

  describe('Combo System', () => {
    it('should start with no combo', () => {
      expect(scoringSystem.getComboCount()).toBe(0);
      expect(scoringSystem.getComboMultiplier()).toBe(1);
    });

    it('should increase combo on consecutive hits', () => {
      scoringSystem.addScore(100, true); // 1x multiplier = 100
      expect(scoringSystem.getComboCount()).toBe(1);

      scoringSystem.addScore(100, true); // 1.5x multiplier = 150
      expect(scoringSystem.getComboCount()).toBe(2);

      scoringSystem.addScore(100, true); // 1.5x multiplier = 150
      expect(scoringSystem.getComboCount()).toBe(3);

      expect(scoringSystem.getTotalScore()).toBe(100 + 150 + 150);
    });

    it('should apply correct combo multipliers', () => {
      // First hit: 1x
      scoringSystem.addScore(100, true);
      expect(scoringSystem.getComboMultiplier()).toBe(1);

      // Second hit: still 1.5x for combo 2-3
      scoringSystem.addScore(100, true);
      expect(scoringSystem.getComboMultiplier()).toBe(1.5);

      // Keep building combo
      for (let i = 0; i < 3; i++) {
        scoringSystem.addScore(100, true);
      }

      // Should be at 2x multiplier now (combo 4-5)
      expect(scoringSystem.getComboMultiplier()).toBeGreaterThanOrEqual(1.5);
    });

    it('should reset combo on non-combo score', () => {
      scoringSystem.addScore(100, true);
      scoringSystem.addScore(100, true);
      expect(scoringSystem.getComboCount()).toBe(2);

      scoringSystem.addScore(100, false); // Reset combo
      expect(scoringSystem.getComboCount()).toBe(0);
      expect(scoringSystem.getComboMultiplier()).toBe(1);
    });
  });

  describe('High Score', () => {
    it('should track high score', () => {
      scoringSystem.addScore(1000);
      expect(scoringSystem.getHighScore()).toBe(1000);
    });

    it('should update high score when exceeded', () => {
      scoringSystem.addScore(500);
      scoringSystem.reset();

      scoringSystem.addScore(1000);
      expect(scoringSystem.getHighScore()).toBe(1000);
    });

    it('should not update high score when not exceeded', () => {
      scoringSystem.addScore(1000);
      scoringSystem.reset();

      scoringSystem.addScore(500);
      expect(scoringSystem.getHighScore()).toBe(1000);
    });

    it('should persist high score to localStorage', () => {
      scoringSystem.addScore(1500);

      // Verify it was saved to localStorage
      const savedScore = localStorage.getItem('tireChaosHighScore');
      expect(savedScore).toBe('1500');

      // Create new instance to test persistence
      const newScoringSystem = new ScoringSystem();
      expect(newScoringSystem.getHighScore()).toBe(1500);
    });
  });

  describe('Distance Bonus', () => {
    it('should calculate distance bonus correctly', () => {
      const points = scoringSystem.addDistanceBonus(10); // 10 meters = 20 points
      expect(points).toBe(20);
      expect(scoringSystem.getTotalScore()).toBe(20);
    });

    it('should round distance bonus to whole numbers', () => {
      const points = scoringSystem.addDistanceBonus(10.7); // Should be 21 points
      expect(points).toBe(21);
    });
  });

  describe('Style Bonus', () => {
    it('should apply perfect release multiplier', () => {
      const points = scoringSystem.addStyleBonus('perfect_release', 100);
      expect(points).toBe(150); // 1.5x multiplier
    });

    it('should apply ricochet multiplier', () => {
      const points = scoringSystem.addStyleBonus('ricochet', 100);
      expect(points).toBe(200); // 2.0x multiplier
    });

    it('should apply chain reaction multiplier', () => {
      const points = scoringSystem.addStyleBonus('chain_reaction', 100);
      expect(points).toBe(300); // 3.0x multiplier
    });

    it('should use 1x multiplier for unknown style types', () => {
      const points = scoringSystem.addStyleBonus('unknown_style', 100);
      expect(points).toBe(100); // 1.0x multiplier
    });
  });

  describe('Score Events', () => {
    it('should record score events', () => {
      scoringSystem.addScore(100);
      scoringSystem.addScore(50);

      const events = scoringSystem.getScoreEvents();
      expect(events.length).toBe(2);
      expect(events[0].points).toBe(100);
      expect(events[1].points).toBe(50);
    });

    it('should include timestamps in score events', () => {
      scoringSystem.addScore(100);

      const events = scoringSystem.getScoreEvents();
      expect(events[0].timestamp).toBeGreaterThan(0);
    });

    it('should clear events on reset', () => {
      scoringSystem.addScore(100);
      scoringSystem.reset();

      const events = scoringSystem.getScoreEvents();
      expect(events.length).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      scoringSystem.addScore(100, true);
      scoringSystem.addScore(100, true);
      scoringSystem.addScore(100, true);

      const stats = scoringSystem.getStatistics();
      expect(stats.totalScore).toBeGreaterThan(0);
      expect(stats.totalEvents).toBe(3);
      expect(stats.maxCombo).toBeGreaterThan(1);
    });

    it('should handle statistics with no events', () => {
      const stats = scoringSystem.getStatistics();
      expect(stats.totalScore).toBe(0);
      expect(stats.totalEvents).toBe(0);
      expect(stats.maxCombo).toBe(0);
      expect(stats.averageCombo).toBe(0);
    });
  });
});
