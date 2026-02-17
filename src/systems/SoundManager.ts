/**
 * SoundManager - Web Audio API implementation for TIRE CHAOS
 *
 * Provides a complete interface for music and sound effects using procedural synthesis.
 * All sounds are generated using oscillators, noise, and filters - no audio files required.
 */

// ---------------------------------------------------------------------------
// Sound name constants
// ---------------------------------------------------------------------------

/**
 * All named sound effects used throughout the game.
 * Each key maps to a logical audio event synthesized procedurally.
 */
export const SOUND_DEFINITIONS = {
  // Tire events
  tire_launch: 'tire_launch',       // Woosh / catapult release
  tire_impact: 'tire_impact',       // Thud / rubber slam on surface

  // Destruction events
  object_destroyed: 'object_destroyed', // Crash / shatter
  combo_hit: 'combo_hit',               // Satisfying chime / power chord

  // Round / game flow
  round_complete: 'round_complete', // Fanfare / jingle
  game_over: 'game_over',          // Deflation / sad trombone variant

  // UI
  button_click: 'button_click',    // Short tick / pop
} as const;

/** Union of all valid SFX names derived from the definitions above. */
export type SoundName = keyof typeof SOUND_DEFINITIONS;

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/**
 * Configuration used when synthesizing a sound.
 */
export interface SoundConfig {
  /** Logical name identifying the sound. */
  name: SoundName;
  /** Relative path to the audio file (unused for synthesis). */
  filePath: string;
  /** Base volume in the range [0, 1]. */
  baseVolume: number;
  /** Whether this clip loops by default. */
  loop: boolean;
}

/**
 * Snapshot of volume and mute state, useful for serialisation / settings
 * screens.
 */
export interface AudioState {
  musicVolume: number;
  sfxVolume: number;
  isMuted: boolean;
}

// ---------------------------------------------------------------------------
// Sound configs
// ---------------------------------------------------------------------------

/**
 * Configuration for every named sound effect.
 */
export const SOUND_CONFIGS: Record<SoundName, SoundConfig> = {
  tire_launch: {
    name: 'tire_launch',
    filePath: '',
    baseVolume: 0.8,
    loop: false,
  },
  tire_impact: {
    name: 'tire_impact',
    filePath: '',
    baseVolume: 0.9,
    loop: false,
  },
  object_destroyed: {
    name: 'object_destroyed',
    filePath: '',
    baseVolume: 1.0,
    loop: false,
  },
  combo_hit: {
    name: 'combo_hit',
    filePath: '',
    baseVolume: 0.85,
    loop: false,
  },
  round_complete: {
    name: 'round_complete',
    filePath: '',
    baseVolume: 1.0,
    loop: false,
  },
  game_over: {
    name: 'game_over',
    filePath: '',
    baseVolume: 1.0,
    loop: false,
  },
  button_click: {
    name: 'button_click',
    filePath: '',
    baseVolume: 0.6,
    loop: false,
  },
};

// ---------------------------------------------------------------------------
// Helper types for music scheduling
// ---------------------------------------------------------------------------

interface MusicNode {
  oscillator?: OscillatorNode;
  gainNode?: GainNode;
  filterNode?: BiquadFilterNode;
  noiseSource?: AudioBufferSourceNode;
}

interface ScheduledEvent {
  time: number;
  action: () => void;
}

// ---------------------------------------------------------------------------
// SoundManager class
// ---------------------------------------------------------------------------

/**
 * SoundManager provides a single access point for all audio in TIRE CHAOS.
 *
 * Architecture overview (Web Audio API):
 *
 *   AudioContext
 *     ├─ masterGainNode          (global mute / unmute)
 *     │    ├─ musicGainNode      (music volume)
 *     │    │    └─ <music source nodes>
 *     │    └─ sfxGainNode        (SFX volume)
 *     │         └─ <sfx source nodes>
 */
export class SoundManager {
  // -------------------------------------------------------------------------
  // Web Audio API nodes
  // -------------------------------------------------------------------------

  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;

  // -------------------------------------------------------------------------
  // Music state
  // -------------------------------------------------------------------------

  private musicNodes: MusicNode[] = [];
  private currentMusicTrack: string | null = null;
  private musicScheduler: number | null = null;
  private musicStartTime: number = 0;

  // -------------------------------------------------------------------------
  // Volume / mute state
  // -------------------------------------------------------------------------

  private musicVolume: number = 0.7;
  private sfxVolume: number = 1.0;
  private muted: boolean = false;
  private preMuteVolume: number = 1.0;

  // -------------------------------------------------------------------------
  // LocalStorage key
  // -------------------------------------------------------------------------

  private readonly STORAGE_KEY = 'tireChaosAudio';

  // -------------------------------------------------------------------------
  // Initialisation flag
  // -------------------------------------------------------------------------

  private initialised: boolean = false;

  // =========================================================================
  // Lifecycle
  // =========================================================================

  constructor() {
    console.log('[SoundManager] Instance created (audio not yet initialised)');
  }

  /**
   * Initialise the Web Audio API context and gain node graph.
   *
   * Must be called from a user-gesture handler (click / keydown) to satisfy
   * browser autoplay policies.
   */
  public async init(): Promise<void> {
    if (this.initialised) {
      console.warn('[SoundManager] init() called more than once; skipping');
      return;
    }

    try {
      // Create AudioContext
      this.audioContext = new AudioContext();

      // Create gain nodes
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);

      this.musicGainNode = this.audioContext.createGain();
      this.musicGainNode.connect(this.masterGainNode);

      this.sfxGainNode = this.audioContext.createGain();
      this.sfxGainNode.connect(this.masterGainNode);

      // Load persisted settings from localStorage
      this.loadPersistedSettings();

      // Apply current volume/mute state to gain nodes
      this.masterGainNode.gain.value = this.muted ? 0 : this.preMuteVolume;
      this.musicGainNode.gain.value = this.musicVolume;
      this.sfxGainNode.gain.value = this.sfxVolume;

      this.initialised = true;
      console.log('[SoundManager] Initialised with Web Audio API (procedural synthesis)');
    } catch (error) {
      console.error('[SoundManager] Failed to initialise AudioContext:', error);
      throw error;
    }
  }

  /**
   * Load persisted audio settings from localStorage.
   */
  private loadPersistedSettings(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state: AudioState = JSON.parse(stored);
        this.musicVolume = Math.max(0, Math.min(1, state.musicVolume ?? 0.7));
        this.sfxVolume = Math.max(0, Math.min(1, state.sfxVolume ?? 1.0));
        this.muted = state.isMuted ?? false;
        this.preMuteVolume = this.muted ? 1.0 : this.masterGainNode?.gain.value ?? 1.0;
        console.log('[SoundManager] Loaded persisted settings:', state);
      }
    } catch (error) {
      console.warn('[SoundManager] Failed to load persisted settings:', error);
    }
  }

  /**
   * Save current audio settings to localStorage.
   */
  private savePersistedSettings(): void {
    try {
      const state = this.getAudioState();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('[SoundManager] Failed to save settings:', error);
    }
  }

  /**
   * Release all audio resources and close the AudioContext.
   */
  public dispose(): void {
    this.stopMusic(0);

    if (this.audioContext) {
      this.audioContext.close().catch(err => {
        console.warn('[SoundManager] Error closing AudioContext:', err);
      });
    }

    this.musicNodes = [];
    this.initialised = false;
    console.log('[SoundManager] Disposed');
  }

  // =========================================================================
  // Music - Procedural generation
  // =========================================================================

  /**
   * Start playing procedurally generated background music.
   *
   * @param trackId - Identifier for the music track (e.g., 'game_music').
   * @param loop    - Whether the track should loop (default true).
   */
  public playMusic(trackId: string, loop: boolean = true): void {
    if (!this.initialised || !this.audioContext) {
      console.warn('[SoundManager] playMusic() called before init()');
      return;
    }

    if (this.currentMusicTrack === trackId) {
      return; // Already playing
    }

    // Stop any currently playing music
    this.stopMusic(0);

    this.currentMusicTrack = trackId;
    this.musicStartTime = this.audioContext.currentTime;

    // Generate procedural music based on track ID
    if (trackId === 'game_music') {
      this.generateGameMusic(loop);
    }

    console.log(`[SoundManager] Playing procedural music: ${trackId}`);
  }

  /**
   * Generate a looping ambient/energetic game track procedurally.
   */
  private generateGameMusic(loop: boolean): void {
    if (!this.audioContext || !this.musicGainNode) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const bpm = 120;
    const beatDuration = 60 / bpm;

    // Create ambient pad (continuous sawtooth with heavy lowpass)
    const padOsc = ctx.createOscillator();
    const padFilter = ctx.createBiquadFilter();
    const padGain = ctx.createGain();

    padOsc.type = 'sawtooth';
    padOsc.frequency.value = 110; // A2
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 400;
    padFilter.Q.value = 5;
    padGain.gain.value = 0.15;

    padOsc.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.musicGainNode);

    padOsc.start(now);
    this.musicNodes.push({ oscillator: padOsc, filterNode: padFilter, gainNode: padGain });

    // Schedule kick drum pattern (120 BPM)
    this.scheduleKickPattern(now, beatDuration, loop);

    // Schedule melody pattern
    this.scheduleMelodyPattern(now, beatDuration, loop);
  }

  /**
   * Schedule kick drum pattern using Web Audio API scheduling.
   */
  private scheduleKickPattern(startTime: number, beatDuration: number, loop: boolean): void {
    if (!this.audioContext || !this.musicGainNode) return;

    const ctx = this.audioContext;
    const scheduleAhead = 0.5; // Schedule 0.5 seconds ahead
    let nextKickTime = startTime;
    let beatCount = 0;

    const scheduleKicks = () => {
      if (!this.audioContext || this.currentMusicTrack === null) return;

      const currentTime = this.audioContext.currentTime;

      // Schedule kicks up to scheduleAhead
      while (nextKickTime < currentTime + scheduleAhead) {
        this.synthesizeKick(nextKickTime);
        nextKickTime += beatDuration;
        beatCount++;
      }

      if (loop) {
        this.musicScheduler = window.setTimeout(scheduleKicks, 100);
      }
    };

    scheduleKicks();
  }

  /**
   * Schedule melody pattern (pentatonic scale).
   */
  private scheduleMelodyPattern(startTime: number, beatDuration: number, loop: boolean): void {
    if (!this.audioContext || !this.musicGainNode) return;

    const ctx = this.audioContext;
    const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00]; // C4, D4, E4, G4, A4
    let melodyIndex = 0;
    let nextNoteTime = startTime + beatDuration * 0.5; // Offset from kick

    const scheduleMelody = () => {
      if (!this.audioContext || this.currentMusicTrack === null) return;

      const currentTime = this.audioContext.currentTime;

      while (nextNoteTime < currentTime + 0.5) {
        const freq = pentatonic[melodyIndex % pentatonic.length];
        this.synthesizeMelodyNote(nextNoteTime, freq, beatDuration * 0.8);

        melodyIndex++;
        nextNoteTime += beatDuration;
      }

      if (loop && this.currentMusicTrack !== null) {
        window.setTimeout(scheduleMelody, 100);
      }
    };

    scheduleMelody();
  }

  /**
   * Synthesize a kick drum sound.
   */
  private synthesizeKick(time: number): void {
    if (!this.audioContext || !this.musicGainNode) return;

    const ctx = this.audioContext;

    // Kick: sine wave pitch drop + noise burst
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const noise = this.createNoiseBuffer(0.05);
    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.1);

    oscGain.gain.setValueAtTime(0.4, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noiseSource.buffer = noise;
    noiseGain.gain.setValueAtTime(0.3, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    osc.connect(oscGain);
    oscGain.connect(this.musicGainNode);

    noiseSource.connect(noiseGain);
    noiseGain.connect(this.musicGainNode);

    osc.start(time);
    osc.stop(time + 0.2);
    noiseSource.start(time);
    noiseSource.stop(time + 0.05);
  }

  /**
   * Synthesize a melody note.
   */
  private synthesizeMelodyNote(time: number, frequency: number, duration: number): void {
    if (!this.audioContext || !this.musicGainNode) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Stop the currently playing music track.
   *
   * @param fadeOutMs - Duration of fade-out in milliseconds (default 500 ms).
   */
  public stopMusic(fadeOutMs: number = 500): void {
    if (!this.currentMusicTrack || !this.audioContext || !this.musicGainNode) {
      return;
    }

    const ctx = this.audioContext;
    const fadeOutSec = fadeOutMs / 1000;
    const now = ctx.currentTime;

    // Clear scheduler
    if (this.musicScheduler !== null) {
      clearTimeout(this.musicScheduler);
      this.musicScheduler = null;
    }

    // Fade out music gain
    if (fadeOutMs > 0) {
      this.musicGainNode.gain.linearRampToValueAtTime(0.01, now + fadeOutSec);
    } else {
      this.musicGainNode.gain.setValueAtTime(0.01, now);
    }

    // Stop all music nodes
    const stopTime = fadeOutMs > 0 ? now + fadeOutSec : now;
    this.musicNodes.forEach(node => {
      try {
        if (node.oscillator) {
          node.oscillator.stop(stopTime);
        }
        if (node.noiseSource) {
          node.noiseSource.stop(stopTime);
        }
      } catch (e) {
        // Already stopped or never started
      }
    });

    // Clean up after fade
    setTimeout(() => {
      this.musicNodes = [];
      if (this.musicGainNode && this.audioContext) {
        this.musicGainNode.gain.setValueAtTime(this.musicVolume, this.audioContext.currentTime);
      }
    }, fadeOutMs + 50);

    this.currentMusicTrack = null;
    console.log(`[SoundManager] Music stopped (fadeOut: ${fadeOutMs}ms)`);
  }

  // =========================================================================
  // Sound effects - Procedural synthesis
  // =========================================================================

  /**
   * Play a one-shot sound effect by name.
   *
   * @param soundName - Key from SOUND_DEFINITIONS (type-safe).
   * @param volume    - Optional per-play volume override in [0, 1].
   */
  public playSFX(soundName: SoundName, volume: number = 1.0): void {
    if (!this.initialised || !this.audioContext || !this.sfxGainNode) {
      console.warn('[SoundManager] playSFX() called before init()');
      return;
    }

    if (this.muted) {
      return;
    }

    const config = SOUND_CONFIGS[soundName];
    const effectiveVolume = config.baseVolume * volume;

    // Dispatch to appropriate synthesis function
    switch (soundName) {
      case 'tire_launch':
        this.synthesizeTireLaunch(effectiveVolume);
        break;
      case 'tire_impact':
        this.synthesizeTireImpact(effectiveVolume);
        break;
      case 'object_destroyed':
        this.synthesizeObjectDestroyed(effectiveVolume);
        break;
      case 'combo_hit':
        this.synthesizeComboHit(effectiveVolume);
        break;
      case 'round_complete':
        this.synthesizeRoundComplete(effectiveVolume);
        break;
      case 'game_over':
        this.synthesizeGameOver(effectiveVolume);
        break;
      case 'button_click':
        this.synthesizeButtonClick(effectiveVolume);
        break;
    }
  }

  /**
   * tire_launch: Ascending whoosh
   * Start at 200Hz, ramp to 800Hz over 0.3s, sawtooth + bandpass, quick attack + long release
   */
  private synthesizeTireLaunch(volume: number): void {
    if (!this.audioContext || !this.sfxGainNode) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.3);

    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 2;

    // Envelope: quick attack (0.01s), long release (0.5s)
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * tire_impact: Thud
   * 80Hz sine + noise burst, very short attack (0.005s), decay (0.15s)
   */
  private synthesizeTireImpact(volume: number): void {
    if (!this.audioContext || !this.sfxGainNode) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Low sine thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 80;

    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(volume * 0.8, now + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGainNode);

    // Noise burst
    const noise = this.createNoiseBuffer(0.1);
    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();

    noiseSource.buffer = noise;
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    noiseSource.connect(noiseGain);
    noiseGain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.15);
    noiseSource.start(now);
    noiseSource.stop(now + 0.1);
  }

  /**
   * object_destroyed: Crash/shatter
   * Noise burst filtered through lowpass at 2000Hz, attack (0.01s), decay (0.3s), slight pitch drop
   */
  private synthesizeObjectDestroyed(volume: number): void {
    if (!this.audioContext || !this.sfxGainNode) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const noise = this.createNoiseBuffer(0.4);
    const noiseSource = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    noiseSource.buffer = noise;
    noiseSource.playbackRate.setValueAtTime(1.0, now);
    noiseSource.playbackRate.linearRampToValueAtTime(0.7, now + 0.3);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + 0.3);
    filter.Q.value = 1;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);

    noiseSource.start(now);
    noiseSource.stop(now + 0.3);
  }

  /**
   * combo_hit: Chime
   * Sine wave at 880Hz * combo_level, short attack (0.01s), medium release (0.3s)
   * For simplicity, we'll use a base frequency and add harmonics
   */
  private synthesizeComboHit(volume: number): void {
    if (!this.audioContext || !this.sfxGainNode) return;

    const ctx = this.audioContext;
    const sfxOut = this.sfxGainNode;
    const now = ctx.currentTime;

    // Create a bell-like sound with multiple harmonics
    const frequencies = [880, 1320, 1760]; // Base + harmonics

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const harmonicVolume = volume / (index + 1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(harmonicVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(sfxOut);

      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  /**
   * round_complete: Fanfare
   * 3-note sequence (C5→E5→G5, 0.15s each), sine waves
   */
  private synthesizeRoundComplete(volume: number): void {
    if (!this.audioContext || !this.sfxGainNode) return;

    const ctx = this.audioContext;
    const sfxOut = this.sfxGainNode;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const noteDuration = 0.15;

    notes.forEach((freq, index) => {
      const startTime = now + index * noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration);

      osc.connect(gain);
      gain.connect(sfxOut);

      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });
  }

  /**
   * game_over: Sad descending
   * 440Hz→220Hz sawtooth over 1.5s with tremolo
   */
  private synthesizeGameOver(volume: number): void {
    if (!this.audioContext || !this.sfxGainNode) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const tremolo = ctx.createOscillator();
    const tremoloGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 1.5);

    // Tremolo effect
    tremolo.type = 'sine';
    tremolo.frequency.value = 5; // 5 Hz tremolo
    tremoloGain.gain.value = 0.3;

    tremolo.connect(tremoloGain);
    tremoloGain.connect(gain.gain);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    tremolo.start(now);
    osc.stop(now + 1.5);
    tremolo.stop(now + 1.5);
  }

  /**
   * button_click: Short click
   * 1000Hz sine, 0.005s attack, 0.05s decay
   */
  private synthesizeButtonClick(volume: number): void {
    if (!this.audioContext || !this.sfxGainNode) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 1000;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Create a noise buffer for synthesis.
   */
  private createNoiseBuffer(duration: number): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  // =========================================================================
  // Volume control
  // =========================================================================

  /**
   * Set the background music volume.
   *
   * @param volume - Normalised value in [0, 1].
   */
  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));

    if (this.musicGainNode && this.audioContext) {
      const ctx = this.audioContext;
      const now = ctx.currentTime;
      this.musicGainNode.gain.cancelScheduledValues(now);
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);
      this.musicGainNode.gain.linearRampToValueAtTime(this.musicVolume, now + 0.05);
    }

    this.savePersistedSettings();
    console.log(`[SoundManager] Music volume: ${this.musicVolume}`);
  }

  /**
   * Get the current music volume setting.
   */
  public getMusicVolume(): number {
    return this.musicVolume;
  }

  /**
   * Set the sound effects volume.
   *
   * @param volume - Normalised value in [0, 1].
   */
  public setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));

    if (this.sfxGainNode && this.audioContext) {
      const ctx = this.audioContext;
      const now = ctx.currentTime;
      this.sfxGainNode.gain.cancelScheduledValues(now);
      this.sfxGainNode.gain.setValueAtTime(this.sfxGainNode.gain.value, now);
      this.sfxGainNode.gain.linearRampToValueAtTime(this.sfxVolume, now + 0.05);
    }

    this.savePersistedSettings();
    console.log(`[SoundManager] SFX volume: ${this.sfxVolume}`);
  }

  /**
   * Get the current SFX volume setting.
   */
  public getSFXVolume(): number {
    return this.sfxVolume;
  }

  // =========================================================================
  // Mute / unmute
  // =========================================================================

  /**
   * Mute all audio output instantly.
   */
  public mute(): void {
    if (this.muted) {
      return;
    }

    this.preMuteVolume = this.masterGainNode?.gain.value ?? 1.0;
    this.muted = true;

    if (this.masterGainNode) {
      this.masterGainNode.gain.value = 0;
    }

    this.savePersistedSettings();
    console.log('[SoundManager] Muted');
  }

  /**
   * Restore audio output to the pre-mute volume.
   */
  public unmute(): void {
    if (!this.muted) {
      return;
    }

    this.muted = false;

    if (this.masterGainNode) {
      this.masterGainNode.gain.value = this.preMuteVolume;
    }

    this.savePersistedSettings();
    console.log('[SoundManager] Unmuted');
  }

  /**
   * Toggle the current mute state.
   *
   * @returns The new muted state.
   */
  public toggleMute(): boolean {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.muted;
  }

  /**
   * Whether the audio system is currently muted.
   */
  public isMuted(): boolean {
    return this.muted;
  }

  // =========================================================================
  // State / persistence
  // =========================================================================

  /**
   * Return a snapshot of the current audio state (for settings persistence).
   */
  public getAudioState(): AudioState {
    return {
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      isMuted: this.muted,
    };
  }

  /**
   * Apply a previously persisted audio state.
   *
   * @param state - Audio state snapshot produced by getAudioState().
   */
  public applyAudioState(state: AudioState): void {
    this.setMusicVolume(state.musicVolume);
    this.setSFXVolume(state.sfxVolume);

    if (state.isMuted) {
      this.mute();
    } else {
      this.unmute();
    }

    this.savePersistedSettings();
    console.log('[SoundManager] Applied audio state:', state);
  }

  /**
   * Resume the AudioContext if it was suspended by the browser.
   *
   * Browsers suspend AudioContext until a user gesture occurs. Call this
   * method inside any user-interaction handler.
   */
  public async resumeContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('[SoundManager] AudioContext resumed');
      } catch (error) {
        console.error('[SoundManager] Failed to resume AudioContext:', error);
      }
    }
  }
}
