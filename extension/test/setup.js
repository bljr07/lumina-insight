/**
 * Global test setup for Lumina Insight MV3 Extension
 *
 * Provides Chrome API mocks that mimic the MV3 runtime environment.
 * All mocks are reset between tests to ensure isolation.
 */
import { vi, beforeEach, afterEach } from 'vitest';

// ─── Chrome Storage Mock ───────────────────────────────────────────────────────

function createStorageMock() {
  let store = {};

  return {
    get: vi.fn((keys) => {
      return new Promise((resolve) => {
        if (keys === null || keys === undefined) {
          resolve({ ...store });
          return;
        }
        const result = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          if (key in store) {
            result[key] = store[key];
          }
        }
        resolve(result);
      });
    }),

    set: vi.fn((items) => {
      return new Promise((resolve) => {
        Object.assign(store, items);
        resolve();
      });
    }),

    remove: vi.fn((keys) => {
      return new Promise((resolve) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          delete store[key];
        }
        resolve();
      });
    }),

    clear: vi.fn(() => {
      return new Promise((resolve) => {
        store = {};
        resolve();
      });
    }),

    // Expose internal store for test assertions
    _getStore: () => ({ ...store }),
    _reset: () => { store = {}; },
  };
}

// ─── Chrome Runtime Mock ───────────────────────────────────────────────────────

function createRuntimeMock() {
  const listeners = {
    onMessage: [],
    onInstalled: [],
  };

  return {
    sendMessage: vi.fn(),

    onMessage: {
      addListener: vi.fn((cb) => listeners.onMessage.push(cb)),
      removeListener: vi.fn((cb) => {
        const idx = listeners.onMessage.indexOf(cb);
        if (idx > -1) listeners.onMessage.splice(idx, 1);
      }),
      hasListener: vi.fn((cb) => listeners.onMessage.includes(cb)),
      // Test helper: simulate receiving a message
      _emit: (message, sender = {}) => {
        return listeners.onMessage.map((cb) => {
          let responseValue;
          const sendResponse = vi.fn((val) => { responseValue = val; });
          const result = cb(message, sender, sendResponse);
          return { result, sendResponse, responseValue };
        });
      },
    },

    onInstalled: {
      addListener: vi.fn((cb) => listeners.onInstalled.push(cb)),
      _emit: (details) => listeners.onInstalled.forEach((cb) => cb(details)),
    },

    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
    id: 'mock-extension-id',

    _listeners: listeners,
  };
}

// ─── Chrome Offscreen Mock (MV3 Specific) ──────────────────────────────────────

function createOffscreenMock() {
  let hasDocument = false;

  return {
    createDocument: vi.fn(({ url, reasons, justification }) => {
      return new Promise((resolve, reject) => {
        if (hasDocument) {
          reject(new Error('Only one offscreen document may be created at a time.'));
          return;
        }
        hasDocument = true;
        resolve();
      });
    }),

    closeDocument: vi.fn(() => {
      return new Promise((resolve) => {
        hasDocument = false;
        resolve();
      });
    }),

    hasDocument: vi.fn(() => {
      return new Promise((resolve) => {
        resolve(hasDocument);
      });
    }),

    Reason: {
      WORKERS: 'WORKERS',
      DOM_SCRAPING: 'DOM_SCRAPING',
      BLOBS: 'BLOBS',
      DOM_PARSER: 'DOM_PARSER',
      AUDIO_PLAYBACK: 'AUDIO_PLAYBACK',
      USER_MEDIA: 'USER_MEDIA',
      DISPLAY_MEDIA: 'DISPLAY_MEDIA',
      WEB_RTC: 'WEB_RTC',
      CLIPBOARD: 'CLIPBOARD',
      LOCAL_STORAGE: 'LOCAL_STORAGE',
      TESTING: 'TESTING',
    },

    _reset: () => { hasDocument = false; },
  };
}

// ─── Chrome Idle Mock ──────────────────────────────────────────────────────────

function createIdleMock() {
  let idleState = 'active';

  return {
    queryState: vi.fn((detectionIntervalInSeconds) => {
      return new Promise((resolve) => {
        resolve(idleState);
      });
    }),

    onStateChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },

    IdleState: {
      ACTIVE: 'active',
      IDLE: 'idle',
      LOCKED: 'locked',
    },

    _setState: (state) => { idleState = state; },
    _reset: () => { idleState = 'active'; },
  };
}

// ─── Chrome Tabs Mock ──────────────────────────────────────────────────────────

function createTabsMock() {
  return {
    query: vi.fn(() => Promise.resolve([])),
    sendMessage: vi.fn(() => Promise.resolve()),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  };
}

// ─── Assemble Global Chrome Object ─────────────────────────────────────────────

const storageMock = createStorageMock();
const runtimeMock = createRuntimeMock();
const offscreenMock = createOffscreenMock();
const idleMock = createIdleMock();
const tabsMock = createTabsMock();

const chromeMock = {
  storage: {
    local: storageMock,
  },
  runtime: runtimeMock,
  offscreen: offscreenMock,
  idle: idleMock,
  tabs: tabsMock,
};

// Attach to globalThis so extension code can access `chrome.*`
globalThis.chrome = chromeMock;

// ─── Reset Between Tests ───────────────────────────────────────────────────────

beforeEach(() => {
  // Clear all mock call histories
  vi.clearAllMocks();

  // Reset internal state
  storageMock._reset();
  offscreenMock._reset();
  idleMock._reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Exports for Direct Use in Tests ───────────────────────────────────────────

export { chromeMock, storageMock, runtimeMock, offscreenMock, idleMock, tabsMock };
