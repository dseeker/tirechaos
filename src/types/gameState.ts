/**
 * Game flow state types for TIRE CHAOS
 */

export enum GameFlowState {
  MENU = 'menu',
  INSTRUCTIONS = 'instructions',
  PLAYING = 'playing',
  PAUSED = 'paused',
  ROUND_END = 'round_end',
  GAME_OVER = 'game_over',
  VICTORY = 'victory',
}

export interface RoundData {
  roundNumber: number;
  targetScore: number;
  timeLimit: number; // seconds
  tiresAvailable: number;
  objectsToDestroy: number;
  completed: boolean;
  score: number;
  timeRemaining: number;
}

export interface GameSession {
  currentState: GameFlowState;
  currentRound: number;
  totalRounds: number;
  totalScore: number;
  highScore: number;
  rounds: RoundData[];
  startTime: number;
  endTime?: number;
}

export interface UIElements {
  scoreDisplay: HTMLElement | null;
  comboDisplay: HTMLElement | null;
  roundDisplay: HTMLElement | null;
  tiresDisplay: HTMLElement | null;
  timeDisplay: HTMLElement | null;
  powerMeter: HTMLElement | null;
  fpsDisplay: HTMLElement | null;
  messageDisplay: HTMLElement | null;
}
