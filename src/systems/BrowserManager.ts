/**
 * BrowserManager - Handles browser-specific features for TIRE CHAOS
 *
 * Manages fullscreen API (with vendor prefix fallbacks), pointer lock,
 * context menu prevention, and text selection prevention. Emits custom
 * events so other systems can react to browser state changes.
 */

/** Custom event detail payload for fullscreen change events. */
export interface FullscreenChangeDetail {
  isFullscreen: boolean;
}

/** Custom event detail payload for pointer lock change events. */
export interface PointerLockChangeDetail {
  isLocked: boolean;
}

/**
 * Vendor-prefixed fullscreen element descriptor, covering all major
 * historical browser implementations.
 */
interface FullscreenDocument extends Document {
  // Standard
  fullscreenElement: Element | null;
  exitFullscreen(): Promise<void>;
  // Firefox (legacy)
  mozFullScreenElement?: Element | null;
  mozCancelFullScreen?(): Promise<void>;
  // WebKit / Safari (legacy)
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?(): Promise<void>;
  // IE / Edge (legacy)
  msFullscreenElement?: Element | null;
  msExitFullscreen?(): Promise<void>;
}

/**
 * Vendor-prefixed fullscreen request descriptor for HTMLElement.
 */
interface FullscreenElement extends HTMLElement {
  // Standard
  requestFullscreen(options?: FullscreenOptions): Promise<void>;
  // Firefox (legacy)
  mozRequestFullScreen?(): Promise<void>;
  // WebKit / Safari (legacy)
  webkitRequestFullscreen?(options?: FullscreenOptions): Promise<void>;
  // IE / Edge (legacy)
  msRequestFullscreen?(): Promise<void>;
}

/**
 * Vendor-prefixed pointer lock request descriptor.
 * Does not extend HTMLElement to avoid conflicting with the built-in
 * requestPointerLock signature (Promise<void> vs void discrepancy across lib versions).
 */
interface PointerLockElement {
  requestPointerLock(): void | Promise<void>;
  // Firefox (legacy)
  mozRequestPointerLock?(): void;
  // WebKit (legacy)
  webkitRequestPointerLock?(): void;
}

/**
 * Vendor-prefixed pointer lock release descriptor on Document.
 */
interface PointerLockDocument extends Document {
  // Standard
  pointerLockElement: Element | null;
  exitPointerLock(): void;
  // Firefox (legacy)
  mozPointerLockElement?: Element | null;
  mozExitPointerLock?(): void;
  // WebKit (legacy)
  webkitPointerLockElement?: Element | null;
  webkitExitPointerLock?(): void;
}

export class BrowserManager {
  private canvas: HTMLCanvasElement;

  // Bound listener references kept for clean teardown.
  private readonly onFullscreenChangeBound: () => void;
  private readonly onPointerLockChangeBound: () => void;
  private readonly onPointerLockErrorBound: () => void;
  private readonly onContextMenuBound: (event: Event) => void;
  private readonly onSelectStartBound: (event: Event) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.onFullscreenChangeBound = this.onFullscreenChange.bind(this);
    this.onPointerLockChangeBound = this.onPointerLockChange.bind(this);
    this.onPointerLockErrorBound = this.onPointerLockError.bind(this);
    this.onContextMenuBound = this.onContextMenu.bind(this);
    this.onSelectStartBound = this.onSelectStart.bind(this);

    this.registerFullscreenListeners();
    this.registerPointerLockListeners();

    console.log('BrowserManager initialized');
  }

  // ---------------------------------------------------------------------------
  // Fullscreen API
  // ---------------------------------------------------------------------------

  /**
   * Request fullscreen on the game canvas.
   * Falls back through vendor-prefixed implementations for broad compatibility.
   */
  public async requestFullscreen(): Promise<void> {
    const el = this.canvas as unknown as FullscreenElement;

    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      } else {
        console.warn('BrowserManager: Fullscreen API is not supported in this browser.');
      }
    } catch (error) {
      console.error('BrowserManager: Failed to enter fullscreen:', error);
    }
  }

  /**
   * Exit fullscreen mode.
   * Falls back through vendor-prefixed implementations for broad compatibility.
   */
  public async exitFullscreen(): Promise<void> {
    const doc = document as FullscreenDocument;

    if (!this.isFullscreen()) {
      return;
    }

    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      } else {
        console.warn('BrowserManager: Exit fullscreen API is not supported in this browser.');
      }
    } catch (error) {
      console.error('BrowserManager: Failed to exit fullscreen:', error);
    }
  }

  /**
   * Toggle fullscreen state. Enters fullscreen if not currently fullscreen,
   * exits if already fullscreen.
   */
  public async toggleFullscreen(): Promise<void> {
    if (this.isFullscreen()) {
      await this.exitFullscreen();
    } else {
      await this.requestFullscreen();
    }
  }

  /**
   * Returns true if the document is currently in fullscreen mode.
   * Checks all vendor-prefixed element properties for compatibility.
   */
  public isFullscreen(): boolean {
    const doc = document as FullscreenDocument;

    return !!(
      doc.fullscreenElement ||
      doc.mozFullScreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement
    );
  }

  /**
   * Register all fullscreen-related event listeners, including vendor-prefixed
   * variants used by older browsers.
   */
  private registerFullscreenListeners(): void {
    document.addEventListener('fullscreenchange', this.onFullscreenChangeBound);
    document.addEventListener('mozfullscreenchange', this.onFullscreenChangeBound);
    document.addEventListener('webkitfullscreenchange', this.onFullscreenChangeBound);
    document.addEventListener('MSFullscreenChange', this.onFullscreenChangeBound);
  }

  /**
   * Remove all registered fullscreen event listeners.
   */
  private removeFullscreenListeners(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChangeBound);
    document.removeEventListener('mozfullscreenchange', this.onFullscreenChangeBound);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreenChangeBound);
    document.removeEventListener('MSFullscreenChange', this.onFullscreenChangeBound);
  }

  /**
   * Internal fullscreen change handler. Dispatches a custom
   * 'browserFullscreenChange' event on `window` with the current state.
   */
  private onFullscreenChange(): void {
    const isFullscreen = this.isFullscreen();

    const detail: FullscreenChangeDetail = { isFullscreen };
    const event = new CustomEvent<FullscreenChangeDetail>('browserFullscreenChange', {
      detail,
      bubbles: false,
    });
    window.dispatchEvent(event);

    console.log(`BrowserManager: Fullscreen changed -> ${isFullscreen ? 'ENTERED' : 'EXITED'}`);
  }

  // ---------------------------------------------------------------------------
  // Pointer Lock API
  // ---------------------------------------------------------------------------

  /**
   * Request pointer lock on the game canvas.
   * Falls back through vendor-prefixed implementations for broad compatibility.
   */
  public lockPointer(): void {
    const el = this.canvas as unknown as PointerLockElement;

    try {
      if (el.requestPointerLock) {
        el.requestPointerLock();
      } else if (el.mozRequestPointerLock) {
        el.mozRequestPointerLock();
      } else if (el.webkitRequestPointerLock) {
        el.webkitRequestPointerLock();
      } else {
        console.warn('BrowserManager: Pointer Lock API is not supported in this browser.');
      }
    } catch (error) {
      console.error('BrowserManager: Failed to lock pointer:', error);
    }
  }

  /**
   * Release pointer lock, returning the cursor to normal behaviour.
   * Falls back through vendor-prefixed implementations for broad compatibility.
   */
  public unlockPointer(): void {
    const doc = document as PointerLockDocument;

    if (!this.isPointerLocked()) {
      return;
    }

    try {
      if (doc.exitPointerLock) {
        doc.exitPointerLock();
      } else if (doc.mozExitPointerLock) {
        doc.mozExitPointerLock();
      } else if (doc.webkitExitPointerLock) {
        doc.webkitExitPointerLock();
      } else {
        console.warn('BrowserManager: Exit pointer lock API is not supported in this browser.');
      }
    } catch (error) {
      console.error('BrowserManager: Failed to unlock pointer:', error);
    }
  }

  /**
   * Returns true if the pointer is currently locked to the canvas element.
   */
  public isPointerLocked(): boolean {
    const doc = document as PointerLockDocument;

    const lockedElement: Element | null =
      doc.pointerLockElement ??
      doc.mozPointerLockElement ??
      doc.webkitPointerLockElement ??
      null;

    return lockedElement === (this.canvas as unknown as Element);
  }

  /**
   * Register all pointer lock related event listeners.
   */
  private registerPointerLockListeners(): void {
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    document.addEventListener('mozpointerlockchange', this.onPointerLockChangeBound);
    document.addEventListener('webkitpointerlockchange', this.onPointerLockChangeBound);

    document.addEventListener('pointerlockerror', this.onPointerLockErrorBound);
    document.addEventListener('mozpointerlockerror', this.onPointerLockErrorBound);
    document.addEventListener('webkitpointerlockerror', this.onPointerLockErrorBound);
  }

  /**
   * Remove all registered pointer lock event listeners.
   */
  private removePointerLockListeners(): void {
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    document.removeEventListener('mozpointerlockchange', this.onPointerLockChangeBound);
    document.removeEventListener('webkitpointerlockchange', this.onPointerLockChangeBound);

    document.removeEventListener('pointerlockerror', this.onPointerLockErrorBound);
    document.removeEventListener('mozpointerlockerror', this.onPointerLockErrorBound);
    document.removeEventListener('webkitpointerlockerror', this.onPointerLockErrorBound);
  }

  /**
   * Internal pointer lock change handler. Dispatches a custom
   * 'browserPointerLockChange' event on `window` with the current state.
   */
  private onPointerLockChange(): void {
    const isLocked = this.isPointerLocked();

    const detail: PointerLockChangeDetail = { isLocked };
    const event = new CustomEvent<PointerLockChangeDetail>('browserPointerLockChange', {
      detail,
      bubbles: false,
    });
    window.dispatchEvent(event);

    console.log(`BrowserManager: Pointer lock changed -> ${isLocked ? 'LOCKED' : 'UNLOCKED'}`);
  }

  /**
   * Internal pointer lock error handler. Dispatches a custom
   * 'browserPointerLockError' event on `window`.
   */
  private onPointerLockError(): void {
    console.error('BrowserManager: Pointer lock request failed.');

    const event = new CustomEvent('browserPointerLockError', { bubbles: false });
    window.dispatchEvent(event);
  }

  // ---------------------------------------------------------------------------
  // Context Menu Prevention
  // ---------------------------------------------------------------------------

  /**
   * Suppress the browser right-click context menu on the game canvas.
   * This prevents the default menu from appearing mid-game.
   */
  public preventContextMenu(): void {
    this.canvas.addEventListener('contextmenu', this.onContextMenuBound);
  }

  /**
   * Re-enable the browser right-click context menu on the game canvas.
   */
  public allowContextMenu(): void {
    this.canvas.removeEventListener('contextmenu', this.onContextMenuBound);
  }

  /**
   * Internal handler that cancels the context menu event.
   */
  private onContextMenu(event: Event): void {
    event.preventDefault();
  }

  // ---------------------------------------------------------------------------
  // Text Selection Prevention
  // ---------------------------------------------------------------------------

  /**
   * Prevent the browser from selecting text when the user clicks or drags
   * on the game canvas. Also applies CSS user-select:none to the canvas
   * to suppress selection highlights on supporting browsers.
   */
  public preventSelection(): void {
    this.canvas.addEventListener('selectstart', this.onSelectStartBound);

    // CSS-level suppression (covers drag-select on the element itself).
    this.canvas.style.userSelect = 'none';
    // Legacy prefixed versions for older browsers.
    (this.canvas.style as any)['-webkit-user-select'] = 'none';
    (this.canvas.style as any)['-moz-user-select'] = 'none';
    (this.canvas.style as any)['-ms-user-select'] = 'none';
  }

  /**
   * Re-enable text selection on the game canvas.
   */
  public allowSelection(): void {
    this.canvas.removeEventListener('selectstart', this.onSelectStartBound);

    this.canvas.style.userSelect = '';
    (this.canvas.style as any)['-webkit-user-select'] = '';
    (this.canvas.style as any)['-moz-user-select'] = '';
    (this.canvas.style as any)['-ms-user-select'] = '';
  }

  /**
   * Internal handler that cancels text selection events.
   */
  private onSelectStart(event: Event): void {
    event.preventDefault();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Apply the recommended set of browser restrictions for an in-game experience:
   * context menu prevention and text selection prevention.
   *
   * Call this once after the game canvas is ready.
   */
  public applyGameRestrictions(): void {
    this.preventContextMenu();
    this.preventSelection();
    console.log('BrowserManager: Game restrictions applied (no context menu, no selection).');
  }

  /**
   * Remove all event listeners registered by BrowserManager and restore any
   * canvas style overrides. Call this when the game is shutting down.
   */
  public destroy(): void {
    this.removeFullscreenListeners();
    this.removePointerLockListeners();
    this.allowContextMenu();
    this.allowSelection();

    // Exit fullscreen if we own it.
    if (this.isFullscreen()) {
      this.exitFullscreen().catch(() => {
        // Swallow – document may already be unloading.
      });
    }

    // Release pointer lock if we own it.
    if (this.isPointerLocked()) {
      this.unlockPointer();
    }

    console.log('BrowserManager: Destroyed, all listeners removed.');
  }
}
