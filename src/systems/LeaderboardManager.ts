export interface LeaderboardEntry {
  name: string;    // max 12 chars
  score: number;
  rounds: number;  // rounds completed
  combo: number;   // best combo
  date: string;    // ISO date string
}

const STORAGE_KEY = 'tireChaosLeaderboard';
const MAX_ENTRIES = 5;

export class LeaderboardManager {
  /**
   * Retrieve the top-5 entries sorted by score descending.
   */
  getEntries(): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as LeaderboardEntry[];
    } catch {
      return [];
    }
  }

  /**
   * Returns true if the given score would appear in the top 5.
   */
  isTopScore(score: number): boolean {
    const entries = this.getEntries();
    if (entries.length < MAX_ENTRIES) return true;
    return score > entries[entries.length - 1].score;
  }

  /**
   * Insert a new entry, re-sort by score descending, slice to 5, and persist.
   */
  addEntry(entry: LeaderboardEntry): void {
    const entries = this.getEntries();
    entries.push(entry);
    entries.sort((a, b) => b.score - a.score);
    const top5 = entries.slice(0, MAX_ENTRIES);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(top5));
    } catch {
      // localStorage may be unavailable in some environments; fail silently
    }
  }

  /**
   * Remove all leaderboard entries from storage.
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // fail silently
    }
  }
}
