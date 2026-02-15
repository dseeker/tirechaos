/**
 * Jest test setup file
 * Configures test environment and mocks
 */

// Mock WebGL context for Three.js
class MockWebGLRenderingContext {
  canvas = {
    width: 800,
    height: 600,
    getContext: () => this,
  };

  getParameter() {
    return 'WebGL';
  }
  getExtension() {
    return null;
  }
  createProgram() {
    return {};
  }
  createShader() {
    return {};
  }
  shaderSource() {}
  compileShader() {}
  attachShader() {}
  linkProgram() {}
  getProgramParameter() {
    return true;
  }
  getShaderParameter() {
    return true;
  }
  useProgram() {}
  enable() {}
  disable() {}
  clear() {}
  clearColor() {}
  viewport() {}
  getUniformLocation() {
    return {};
  }
  getAttribLocation() {
    return 0;
  }
  uniform1f() {}
  uniform1i() {}
  uniform3fv() {}
  uniformMatrix4fv() {}
  createBuffer() {
    return {};
  }
  bindBuffer() {}
  bufferData() {}
  vertexAttribPointer() {}
  enableVertexAttribArray() {}
  drawArrays() {}
  drawElements() {}
}

// Mock 2D Canvas Context
class Mock2DContext {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;

  fillRect() {}
  strokeRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  fill() {}
  clearRect() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  getImageData() {
    return {
      data: new Uint8ClampedArray(256 * 256 * 4),
      width: 256,
      height: 256,
    };
  }
  putImageData() {}
  createImageData() {
    return {
      data: new Uint8ClampedArray(256 * 256 * 4),
      width: 256,
      height: 256,
    };
  }
}

// Mock HTMLCanvasElement
global.HTMLCanvasElement.prototype.getContext = function (contextId: string) {
  if (contextId === 'webgl' || contextId === 'webgl2') {
    return new MockWebGLRenderingContext() as any;
  }
  if (contextId === '2d') {
    return new Mock2DContext() as any;
  }
  return null;
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return setTimeout(() => callback(Date.now()), 16) as any;
};

global.cancelAnimationFrame = (id: number): void => {
  clearTimeout(id);
};

// Mock performance.now
global.performance = {
  now: () => Date.now(),
} as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

// Suppress console logs in tests (optional)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
};

// Mock document methods
document.getElementById = jest.fn((id: string) => {
  const element = document.createElement('div');
  element.id = id;
  return element;
});

console.info('✅ Test environment setup complete');
