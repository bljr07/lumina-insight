# Lumina Insight (MV3 Extension)

A privacy-first browser extension that monitors student learning states (e.g., *Focused*, *Struggling*, *Deep Reading*) using on-device AI. Built strictly on Chrome Manifest V3 (MV3) architecture.

## 🏗️ Architecture

The extension is broken into three main Chrome entry points, all built from the `src/` directory using Rollup:

1. **Content Script (`src/content/`)**
   - Injected into all web pages.
   - Run behavioral *Sensors* (dwell time, scroll velocity, mouse jitter, tab switches).
   - Detects the learning platform (Kahoot, Canvas, Wooclap).
   - Emits throttled *Behavioral Packets* to the Service Worker.

2. **Service Worker (`src/background/`)**
   - The central message router and state manager.
   - Receives packets and delegates to the AI classification logic.
   - Manages session persistence via `chrome.storage.local`.
   - Generates anonymized Federated Learning weight updates when the browser is idle.

3. **Popup / Offscreen (`src/popup/`, `src/offscreen/`)**
   - **Popup**: Connects to the Service Worker to request current state and renders it.
   - **Offscreen**: (WIP) Will host the ONNX Runtime Web instance to execute the AI model securely off the main thread.

## 🛠️ Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Build the extension for Chrome (compiles src/ -> content/, background/, popup/)
npm run build

# 3. Watch mode (auto-rebuilds on file save)
npm run build:watch
```

## 🧪 Testing

The project uses strict Test-Driven Development (TDD) with **Vitest** (Unit/Integration) and **Playwright** (E2E).

```bash
# Run all unit & integration tests (141 tests)
npm test

# Run tests with coverage report
npm run test:coverage

# Run End-to-End browser tests (10 tests)
# Note: Requires `npm run build` to be run first!
npm run test:e2e
```

## 🚀 Loading in Chrome

1. Run `npm run build`
2. Open Chrome and navigate to `chrome://extensions`
3. Toggle on **Developer mode** in the top right.
4. Click **Load unpacked** and select the `lumina-insight/extension/` folder.
5. Browse to any page (like Kahoot or Canvas), click the Lumina puzzle piece icon, and observe your learning state!

## 🔒 Privacy & Data (Zero PII)

Lumina Insight operates completely on-device.
- **No URLs or page content are recorded.** Only high-level domains (e.g., `kahoot.it`).
- **Data stays on the machine.** Inference uses ONNX Web Runtime.
- **Federated Learning is anonymous.** Only aggregated model weights + a random session hash are synced to the cloud, and only when the browser is entirely idle.
