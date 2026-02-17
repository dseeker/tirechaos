/**
 * AchievementManager - Tracks and unlocks achievements for TIRE CHAOS
 * Persists unlocked state via localStorage key `tireChaosAchievements`
 */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;        // emoji
  unlocked: boolean;
  unlockedAt?: number; // timestamp
}

export enum GameEvent {
  TIRE_LAUNCHED,
  OBJECT_DESTROYED,
  COMBO_HIT,
  ROUND_SCORE,
  ROUND_COMPLETE,
  GAME_VICTORY,
  HIGH_SCORE_BEATEN,
}

export interface EventData {
  // TIRE_LAUNCHED
  tireType?: string;
  tiresRemaining?: number;

  // OBJECT_DESTROYED
  totalDestroyed?: number;

  // COMBO_HIT
  comboCount?: number;

  // ROUND_SCORE
  score?: number;
  isLastTire?: boolean;

  // ROUND_COMPLETE
  roundNumber?: number;
  tiresLeft?: number;
  timeRemaining?: number;
  tiresUsedTypes?: string[];

  // GAME_VICTORY
  // (no extra fields beyond roundNumber)

  // HIGH_SCORE_BEATEN
  // (no extra fields)
}

const STORAGE_KEY = 'tireChaosAchievements';

const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlocked' | 'unlockedAt'>[] = [
  {
    id: 'first_launch',
    title: 'First Roll',
    description: 'Launch your first tire',
    icon: '🛞',
  },
  {
    id: 'destruction_10',
    title: 'Wreaking Havoc',
    description: 'Destroy 10 objects',
    icon: '💥',
  },
  {
    id: 'destruction_50',
    title: 'Chaos Agent',
    description: 'Destroy 50 objects total',
    icon: '🌪️',
  },
  {
    id: 'combo_3',
    title: 'Hat Trick',
    description: 'Get a 3x combo',
    icon: '🎩',
  },
  {
    id: 'combo_5',
    title: 'Combo King',
    description: 'Get a 5x combo',
    icon: '👑',
  },
  {
    id: 'score_1000',
    title: 'Rookie',
    description: 'Score 1,000 points in one round',
    icon: '⭐',
  },
  {
    id: 'score_5000',
    title: 'Pro',
    description: 'Score 5,000 points in one round',
    icon: '🌟',
  },
  {
    id: 'perfect_round',
    title: 'Flawless',
    description: 'Complete a round with all tires remaining',
    icon: '💎',
  },
  {
    id: 'speed_run',
    title: 'Speed Demon',
    description: 'Complete a round with 30 seconds or more remaining',
    icon: '⚡',
  },
  {
    id: 'all_types',
    title: 'Collector',
    description: 'Use all 5 tire types',
    icon: '🏆',
  },
  {
    id: 'round_1',
    title: 'Survivor',
    description: 'Complete Round 1',
    icon: '🎯',
  },
  {
    id: 'round_3',
    title: 'Halfway There',
    description: 'Complete Round 3',
    icon: '🔥',
  },
  {
    id: 'round_5',
    title: 'Champion',
    description: 'Complete all 5 rounds',
    icon: '🥇',
  },
  {
    id: 'high_score',
    title: 'Record Breaker',
    description: 'Beat your own high score',
    icon: '📈',
  },
  {
    id: 'lucky_shot',
    title: 'Lucky Shot',
    description: 'Score 500+ points with your last tire',
    icon: '🍀',
  },
];

export class AchievementManager {
  private achievements: Achievement[];

  constructor() {
    this.achievements = this.loadFromStorage();
    console.log('🏅 Achievement Manager initialized');
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Check an event against all achievement conditions.
   * Returns the list of newly-unlocked achievements (empty if none).
   */
  public check(event: GameEvent, data: EventData): Achievement[] {
    const newly: Achievement[] = [];

    const tryUnlock = (id: string) => {
      const achievement = this.achievements.find((a) => a.id === id);
      if (achievement && !achievement.unlocked) {
        achievement.unlocked = true;
        achievement.unlockedAt = Date.now();
        newly.push(achievement);
      }
    };

    switch (event) {
      case GameEvent.TIRE_LAUNCHED:
        tryUnlock('first_launch');
        break;

      case GameEvent.OBJECT_DESTROYED: {
        const total = data.totalDestroyed ?? 0;
        if (total >= 10) tryUnlock('destruction_10');
        if (total >= 50) tryUnlock('destruction_50');
        break;
      }

      case GameEvent.COMBO_HIT: {
        const combo = data.comboCount ?? 0;
        if (combo >= 3) tryUnlock('combo_3');
        if (combo >= 5) tryUnlock('combo_5');
        break;
      }

      case GameEvent.ROUND_SCORE: {
        const score = data.score ?? 0;
        if (score >= 1000) tryUnlock('score_1000');
        if (score >= 5000) tryUnlock('score_5000');
        if (data.isLastTire && score >= 500) tryUnlock('lucky_shot');
        break;
      }

      case GameEvent.ROUND_COMPLETE: {
        const round = data.roundNumber ?? 0;
        if (round >= 1) tryUnlock('round_1');
        if (round >= 3) tryUnlock('round_3');

        if ((data.tiresLeft ?? 0) > 0) tryUnlock('perfect_round');
        if ((data.timeRemaining ?? 0) >= 30) tryUnlock('speed_run');

        const types = data.tiresUsedTypes ?? [];
        const uniqueTypes = new Set(types);
        if (uniqueTypes.size >= 5) tryUnlock('all_types');
        break;
      }

      case GameEvent.GAME_VICTORY:
        tryUnlock('round_5');
        break;

      case GameEvent.HIGH_SCORE_BEATEN:
        tryUnlock('high_score');
        break;
    }

    if (newly.length > 0) {
      this.saveToStorage();
      newly.forEach((a) => {
        console.log(`🏅 Achievement unlocked: ${a.icon} ${a.title}`);
        this.showToast(a);
      });
    }

    return newly;
  }

  /** Return a copy of all achievements (locked and unlocked). */
  public getAll(): Achievement[] {
    return this.achievements.map((a) => ({ ...a }));
  }

  /** Return only unlocked achievements. */
  public getUnlocked(): Achievement[] {
    return this.achievements.filter((a) => a.unlocked).map((a) => ({ ...a }));
  }

  /** Check if a specific achievement is unlocked. */
  public isUnlocked(id: string): boolean {
    return this.achievements.find((a) => a.id === id)?.unlocked ?? false;
  }

  /**
   * Reset all achievements (clears localStorage too).
   * Use with care — this wipes the entire unlocked history.
   */
  public reset(): void {
    this.achievements = ACHIEVEMENT_DEFINITIONS.map((def) => ({
      ...def,
      unlocked: false,
    }));
    localStorage.removeItem(STORAGE_KEY);
    console.log('🏅 Achievements reset');
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private loadFromStorage(): Achievement[] {
    const base: Achievement[] = ACHIEVEMENT_DEFINITIONS.map((def) => ({
      ...def,
      unlocked: false,
    }));

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;

      const saved: Record<string, { unlocked: boolean; unlockedAt?: number }> = JSON.parse(raw);

      return base.map((a) => {
        const entry = saved[a.id];
        if (entry?.unlocked) {
          return { ...a, unlocked: true, unlockedAt: entry.unlockedAt };
        }
        return a;
      });
    } catch {
      console.warn('AchievementManager: failed to parse localStorage, starting fresh');
      return base;
    }
  }

  private saveToStorage(): void {
    const payload: Record<string, { unlocked: boolean; unlockedAt?: number }> = {};
    for (const a of this.achievements) {
      if (a.unlocked) {
        payload[a.id] = { unlocked: true, unlockedAt: a.unlockedAt };
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  /**
   * Inject an achievement toast element into the DOM.
   * CSS handles the slide-in and fade-out animation; we only set the stacking
   * offset so multiple toasts don't overlap.
   */
  private showToast(achievement: Achievement): void {
    const existingToasts = document.querySelectorAll('.achievement-toast');
    const stackOffset = existingToasts.length * 110; // px gap between stacked toasts

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.style.top = `${20 + stackOffset}px`;
    toast.innerHTML = `
      <span class="achievement-toast__icon" aria-hidden="true">${achievement.icon}</span>
      <div class="achievement-toast__text">
        <div class="achievement-toast__title">${achievement.title}</div>
        <div class="achievement-toast__desc">${achievement.description}</div>
      </div>
    `;

    document.body.appendChild(toast);

    // Remove from DOM after animation completes (3s slide + 0.4s fade = 3.4s)
    setTimeout(() => toast.remove(), 3600);
  }
}
