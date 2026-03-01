# Lumina Insight

A privacy-first browser plugin for students to learn better.

A full-stack project featuring a Chrome browser extension (Manifest V3), a web frontend, a backend API, and database scripts.

## Project Structure

```
lumina-insight/
├── extension/       ← Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── background/
│   │   └── service-worker.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── content/
│   │   ├── content.js
│   │   └── content.css
│   └── icons/
├── frontend/        ← Web frontend
├── backend/         ← Backend API
└── database/        ← Database migrations & scripts
```

## Getting Started

### Browser Extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.

### Frontend / Backend / Database

_Coming soon._
