/**
 * SoundManager - Web Audio API stub for TIRE CHAOS
 *
 * Provides a complete interface for music and sound effects.
 * All methods are stubbed with TODO comments for future implementation.
 *
 * TODO: Integrate a full audio engine (e.g., Howler.js, Tone.js, or raw Web Audio API)
 *       once audio assets are available.
 */

// ---------------------------------------------------------------------------
// Sound name constants
// ---------------------------------------------------------------------------

/**
 * All named sound effects used throughout the game.
 * Each key maps to a logical audio event; the string value is used as the
 * asset identifier when loading real audio files.
 *
 * TODO: Replace placeholder string values with actual asset file paths,
 *       e.g. 'sounds/sfx/tire_launch.ogg'.
 */
export const SOUND_DEFINITIONS = {
  // Tire events
  tire_launch: 'tire_launch',       // TODO: Woosh / catapult release
  tire_impact: 'tire_impact',       // TODO: Thud / rubber slam on surface

  // Destruction events
  object_destroyed: 'object_destroyed', // TODO: Crash / shatter
  combo_hit: 'combo_hit',               // TODO: Satisfying chime / power chord

  // Round / game flow
  round_complete: 'round_complete', // TODO: Fanfare / jingle
  game_over: 'game_over',          // TODO: Deflation / sad trombone variant

  // UI
  button_click: 'button_click',    // TODO: Short tick / pop
} as const;

/** Union of all valid SFX names derived from the definitions above. */
export type SoundName = keyof typeof SOUND_DEFINITIONS;

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/**
 * Configuration used when (eventually) loading a sound asset.
 *
 * TODO: Expand with loop, sprite sheet offsets, decode priority, etc.
 */
export interface SoundConfig {
  /** Logical name identifying the sound. */
  name: SoundName;
  /** Relative path to the audio file (populated when assets are ready). */
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
// Placeholder sound configs
// ---------------------------------------------------------------------------

/**
 * Placeholder definitions for every named sound effect.
 * Mirrors SOUND_DEFINITIONS so callers have typed metadata.
 *
 * TODO: Fill in real filePath values once audio assets are produced.
 */
export const SOUND_CONFIGS: Record<SoundName, SoundConfig> = {
  tire_launch: {
    name: 'tire_launch',
    filePath: '', // TODO: 'sounds/sfx/tire_launch.ogg'
    baseVolume: 0.8,
    loop: false,
  },
  tire_impact: {
    name: 'tire_impact',
    filePath: '', // TODO: 'sounds/sfx/tire_impact.ogg'
    baseVolume: 0.9,
    loop: false,
  },
  object_destroyed: {
    name: 'object_destroyed',
    filePath: '', // TODO: 'sounds/sfx/object_destroyed.ogg'
    baseVolume: 1.0,
    loop: false,
  },
  combo_hit: {
    name: 'combo_hit',
    filePath: '', // TODO: 'sounds/sfx/combo_hit.ogg'
    baseVolume: 0.85,
    loop: false,
  },
  round_complete: {
    name: 'round_complete',
    filePath: '', // TODO: 'sounds/sfx/round_complete.ogg'
    baseVolume: 1.0,
    loop: false,
  },
  game_over: {
    name: 'game_over',
    filePath: '', // TODO: 'sounds/sfx/game_over.ogg'
    baseVolume: 1.0,
    loop: false,
  },
  button_click: {
    name: 'button_click',
    filePath: '', // TODO: 'sounds/sfx/button_click.ogg'
    baseVolume: 0.6,
    loop: false,
  },
};

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
 *
 * TODO: Instantiate and wire up these nodes once the AudioContext is
 *       created during initialisation.
 */
export class SoundManager {
  // -------------------------------------------------------------------------
  // Web Audio API nodes (all null until init() is called)
  // -------------------------------------------------------------------------

  /**
   * Root Web Audio context.
   * TODO: Create with `new AudioContext()` inside init().
   */
  private audioContext: AudioContext | null = null;

  /**
   * Top-level gain node; setting gain to 0 implements global mute.
   * TODO: Connect to audioContext.destination inside init().
   */
  private masterGainNode: GainNode | null = null;

  /**
   * Dedicated gain node for background music.
   * TODO: Connect masterGainNode -> musicGainNode -> music source.
   */
  private musicGainNode: GainNode | null = null;

  /**
   * Dedicated gain node for sound effects.
   * TODO: Connect masterGainNode -> sfxGainNode -> sfx sources.
   */
  private sfxGainNode: GainNode | null = null;

  // -------------------------------------------------------------------------
  // Music state
  // -------------------------------------------------------------------------

  /**
   * Currently playing music source node.
   * TODO: Store the AudioBufferSourceNode returned by
   *       audioContext.createBufferSource() so it can be stopped cleanly.
   */
  private currentMusicSource: AudioBufferSourceNode | null = null;

  /**
   * Identifier of the music track currently loaded / playing.
   * TODO: Use to avoid re-loading the same track.
   */
  private currentMusicTrack: string | null = null;

  // -------------------------------------------------------------------------
  // Volume / mute state
  // -------------------------------------------------------------------------

  /** Normalised music volume in [0, 1]. */
  private musicVolume: number = 0.7;

  /** Normalised SFX volume in [0, 1]. */
  private sfxVolume: number = 1.0;

  /** Whether the audio system is globally muted. */
  private muted: boolean = false;

  /**
   * Volume stored before a mute call so it can be restored on unmute.
   * TODO: Use when implementing smooth fade-in on unmute.
   */
  private preMuteVolume: number = 1.0;

  // -------------------------------------------------------------------------
  // Asset cache
  // -------------------------------------------------------------------------

  /**
   * Decoded audio buffers keyed by SoundName.
   * TODO: Populate in preload() by fetching and decoding each asset.
   */
  private sfxBuffers: Map<SoundName, AudioBuffer> = new Map();

  /**
   * Decoded audio buffers for music tracks, keyed by track identifier.
   * TODO: Populate lazily or eagerly depending on memory budget.
   */
  private musicBuffers: Map<string, AudioBuffer> = new Map();

  // -------------------------------------------------------------------------
  // Initialisation flag
  // -------------------------------------------------------------------------

  /** True once init() has completed successfully. */
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
   *
   * TODO: Implement the body of this method:
   *   1. Create AudioContext.
   *   2. Create masterGainNode, musicGainNode, sfxGainNode.
   *   3. Connect: source -> sfxGainNode -> masterGainNode -> destination
   *                         musicGainNode -> masterGainNode
   *   4. Apply persisted volume/mute settings from localStorage.
   *   5. Call preload() to fetch and decode all SFX assets.
   */
  public async init(): Promise<void> {
    if (this.initialised) {
      console.warn('[SoundManager] init() called more than once; skipping');
      return;
    }

    // TODO: Uncomment and complete when implementing real audio:
    //
    // this.audioContext = new AudioContext();
    //
    // this.masterGainNode = this.audioContext.createGain();
    // this.masterGainNode.gain.value = this.muted ? 0 : this.preMuteVolume;
    // this.masterGainNode.connect(this.audioContext.destination);
    //
    // this.musicGainNode = this.audioContext.createGain();
    // this.musicGainNode.gain.value = this.musicVolume;
    // this.musicGainNode.connect(this.masterGainNode);
    //
    // this.sfxGainNode = this.audioContext.createGain();
    // this.sfxGainNode.gain.value = this.sfxVolume;
    // this.sfxGainNode.connect(this.masterGainNode);
    //
    // await this.preload();

    this.initialised = true;
    console.log('[SoundManager] Initialised (stub — no audio loaded yet)');
  }

  /**
   * Preload and decode all SFX defined in SOUND_CONFIGS.
   *
   * TODO: Implement:
   *   1. Iterate SOUND_CONFIGS entries.
   *   2. fetch(config.filePath) for entries with a non-empty filePath.
   *   3. arrayBuffer = await response.arrayBuffer()
   *   4. buffer = await this.audioContext!.decodeAudioData(arrayBuffer)
   *   5. this.sfxBuffers.set(name, buffer)
   *
   * Consider showing a loading-progress callback so the UI can display a
   * progress bar.
   */
  private async preload(): Promise<void> {
    // TODO: Implement asset loading loop (see JSDoc above).
    console.log('[SoundManager] preload() called (stub — nothing loaded)');
  }

  /**
   * Release all audio resources and close the AudioContext.
   *
   * TODO: Stop currentMusicSource, close audioContext, clear buffer maps.
   */
  public dispose(): void {
    // TODO: this.currentMusicSource?.stop();
    // TODO: await this.audioContext?.close();
    this.sfxBuffers.clear();
    this.musicBuffers.clear();
    this.initialised = false;
    console.log('[SoundManager] Disposed');
  }

  // =========================================================================
  // Music
  // =========================================================================

  /**
   * Start playing a background music track.
   *
   * @param trackId - Identifier / file path of the music track.
   * @param loop    - Whether the track should loop (default true).
   *
   * TODO: Implement:
   *   1. If trackId === currentMusicTrack, return early (already playing).
   *   2. Stop any currently playing track via stopMusic().
   *   3. Load / retrieve buffer from musicBuffers.
   *   4. Create AudioBufferSourceNode, set loop, connect to musicGainNode.
   *   5. source.start(0).
   *   6. Store in currentMusicSource / currentMusicTrack.
   *   7. Add a smooth fade-in via musicGainNode.gain.linearRampToValueAtTime.
   */
  public playMusic(trackId: string, loop: boolean = true): void {
    if (!this.initialised) {
      console.warn('[SoundManager] playMusic() called before init()');
      return;
    }

    if (this.muted) {
      console.log(`[SoundManager] playMusic('${trackId}') skipped — muted`);
      return;
    }

    // TODO: Load and play the track (see JSDoc above).
    console.log(`[SoundManager] playMusic('${trackId}', loop=${loop}) — stub`);
  }

  /**
   * Stop the currently playing music track.
   *
   * @param fadeOutMs - Duration of fade-out in milliseconds (default 500 ms).
   *
   * TODO: Implement:
   *   1. Fade out musicGainNode.gain over fadeOutMs using linearRampToValueAtTime.
   *   2. After the fade, call currentMusicSource.stop() and set to null.
   *   3. Reset musicGainNode.gain to musicVolume for the next track.
   */
  public stopMusic(fadeOutMs: number = 500): void {
    if (!this.currentMusicSource) {
      return;
    }

    // TODO: Fade out and stop (see JSDoc above).
    this.currentMusicSource = null;
    this.currentMusicTrack = null;
    console.log(`[SoundManager] stopMusic(fadeOutMs=${fadeOutMs}) — stub`);
  }

  // =========================================================================
  // Sound effects
  // =========================================================================

  /**
   * Play a one-shot sound effect by name.
   *
   * @param soundName - Key from SOUND_DEFINITIONS (type-safe).
   * @param volume    - Optional per-play volume override in [0, 1].
   *
   * TODO: Implement:
   *   1. Guard: initialised && !muted && sfxBuffers.has(soundName).
   *   2. Create AudioBufferSourceNode from cached buffer.
   *   3. Create a per-play GainNode to apply volume override.
   *   4. Chain: sourceNode -> perPlayGain -> sfxGainNode.
   *   5. source.start(0); source.onended = () => source.disconnect().
   */
  public playSFX(soundName: SoundName, volume: number = 1.0): void {
    if (!this.initialised) {
      console.warn('[SoundManager] playSFX() called before init()');
      return;
    }

    if (this.muted) {
      return;
    }

    const config = SOUND_CONFIGS[soundName];

    // TODO: Look up buffer, create source node, apply volume, and start.
    console.log(
      `[SoundManager] playSFX('${soundName}', volume=${volume}) — stub` +
      ` | baseVolume=${config.baseVolume}`,
    );
  }

  // =========================================================================
  // Volume control
  // =========================================================================

  /**
   * Set the background music volume.
   *
   * @param volume - Normalised value in [0, 1].
   *
   * TODO: Apply value to musicGainNode.gain with a short ramp for smoothness:
   *   this.musicGainNode?.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05)
   */
  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));

    // TODO: Apply to musicGainNode (see JSDoc above).
    console.log(`[SoundManager] setMusicVolume(${this.musicVolume}) — stub`);
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
   *
   * TODO: Apply value to sfxGainNode.gain with a short ramp:
   *   this.sfxGainNode?.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05)
   */
  public setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));

    // TODO: Apply to sfxGainNode (see JSDoc above).
    console.log(`[SoundManager] setSFXVolume(${this.sfxVolume}) — stub`);
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
   *
   * TODO: Set masterGainNode.gain.value = 0 (no ramp — user expects instant
   *       silence from a mute action).
   */
  public mute(): void {
    if (this.muted) {
      return;
    }

    this.preMuteVolume = this.masterGainNode?.gain.value ?? 1.0;
    this.muted = true;

    // TODO: this.masterGainNode && (this.masterGainNode.gain.value = 0);
    console.log('[SoundManager] mute() — stub');
  }

  /**
   * Restore audio output to the pre-mute volume.
   *
   * TODO: Set masterGainNode.gain.value = preMuteVolume (or fade back in
   *       gently with linearRampToValueAtTime).
   */
  public unmute(): void {
    if (!this.muted) {
      return;
    }

    this.muted = false;

    // TODO: this.masterGainNode && (this.masterGainNode.gain.value = this.preMuteVolume);
    console.log('[SoundManager] unmute() — stub');
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
   *
   * TODO: Also save / restore state from localStorage so settings survive
   *       page reloads.
   */
  public applyAudioState(state: AudioState): void {
    this.setMusicVolume(state.musicVolume);
    this.setSFXVolume(state.sfxVolume);

    if (state.isMuted) {
      this.mute();
    } else {
      this.unmute();
    }

    // TODO: Persist to localStorage:
    //   localStorage.setItem('tireChaosAudioState', JSON.stringify(state));
    console.log('[SoundManager] applyAudioState() — stub applied in-memory');
  }

  /**
   * Resume the AudioContext if it was suspended by the browser.
   *
   * Browsers suspend AudioContext until a user gesture occurs. Call this
   * method inside any user-interaction handler.
   *
   * TODO: this.audioContext?.state === 'suspended' && await this.audioContext.resume()
   */
  public async resumeContext(): Promise<void> {
    // TODO: Implement resume (see JSDoc above).
    console.log('[SoundManager] resumeContext() — stub');
  }
}
