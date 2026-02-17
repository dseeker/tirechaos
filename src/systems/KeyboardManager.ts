import { CameraType } from '../types';

/**
 * KeyboardManager - Handles all keyboard shortcuts and hotkeys
 */
export class KeyboardManager {
  private keyStates: Map<string, boolean> = new Map();
  private callbacks: Map<string, () => void> = new Map();

  constructor() {
    this.setupEventListeners();
    console.log('⌨️  Keyboard Manager initialized');
  }

  /**
   * Setup keyboard event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  /**
   * Handle key down
   */
  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keyStates.set(key, true);

    // Trigger callback if registered
    const callback = this.callbacks.get(key);
    if (callback) {
      event.preventDefault();
      callback();
    }
  }

  /**
   * Handle key up
   */
  private onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keyStates.set(key, false);
  }

  /**
   * Register a keyboard shortcut
   */
  public registerShortcut(key: string, callback: () => void): void {
    this.callbacks.set(key.toLowerCase(), callback);
  }

  /**
   * Unregister a keyboard shortcut
   */
  public unregisterShortcut(key: string): void {
    this.callbacks.delete(key.toLowerCase());
  }

  /**
   * Check if key is currently pressed
   */
  public isKeyPressed(key: string): boolean {
    return this.keyStates.get(key.toLowerCase()) || false;
  }

  /**
   * Clear all shortcuts
   */
  public clearAll(): void {
    this.callbacks.clear();
  }

  /**
   * Setup default game shortcuts
   */
  public setupDefaultShortcuts(callbacks: {
    onPause?: () => void;
    onReset?: () => void;
    onCycleCamera?: () => void;
    onSelectCamera?: (cameraType: CameraType) => void;
    onToggleFPS?: () => void;
    onToggleFullscreen?: () => void;
    onQuickLaunch?: () => void;
    onCycleTire?: () => void;
  }): void {
    // Pause/Resume
    if (callbacks.onPause) {
      this.registerShortcut('p', callbacks.onPause);
      this.registerShortcut('escape', callbacks.onPause);
    }

    // Reset level
    if (callbacks.onReset) {
      this.registerShortcut('r', callbacks.onReset);
    }

    // Camera controls
    if (callbacks.onCycleCamera) {
      this.registerShortcut('c', callbacks.onCycleCamera);
    }

    if (callbacks.onSelectCamera) {
      this.registerShortcut('1', () => callbacks.onSelectCamera!(CameraType.LAUNCH));
      this.registerShortcut('2', () => callbacks.onSelectCamera!(CameraType.DRONE));
      this.registerShortcut('3', () => callbacks.onSelectCamera!(CameraType.GOPRO));
      this.registerShortcut('4', () => callbacks.onSelectCamera!(CameraType.OVERHEAD));
      this.registerShortcut('5', () => callbacks.onSelectCamera!(CameraType.HERO_TIRE));
    }

    // Toggle displays
    if (callbacks.onToggleFPS) {
      this.registerShortcut('tab', callbacks.onToggleFPS);
    }

    if (callbacks.onToggleFullscreen) {
      this.registerShortcut('f', callbacks.onToggleFullscreen);
    }

    // Quick launch
    if (callbacks.onQuickLaunch) {
      this.registerShortcut(' ', callbacks.onQuickLaunch); // Spacebar
    }

    // Cycle tire type
    if (callbacks.onCycleTire) {
      this.registerShortcut('t', callbacks.onCycleTire);
    }

    console.log('⌨️  Default shortcuts registered:');
    console.log('   P/ESC: Pause');
    console.log('   R: Reset');
    console.log('   C: Cycle Camera');
    console.log('   1-5: Select Camera');
    console.log('   TAB: Toggle FPS');
    console.log('   F: Fullscreen');
    console.log('   SPACE: Quick Launch');
    console.log('   T: Cycle Tire Type');
  }

  /**
   * Get help text for shortcuts
   */
  public getShortcutsHelp(): string[] {
    return [
      'KEYBOARD SHORTCUTS:',
      '  P / ESC - Pause game',
      '  R - Reset level',
      '  C - Cycle camera',
      '  1-5 - Select camera',
      '  TAB - Toggle FPS',
      '  F - Fullscreen',
      '  SPACE - Quick launch',
      '  T - Cycle tire type',
    ];
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
    this.callbacks.clear();
    this.keyStates.clear();
  }
}
