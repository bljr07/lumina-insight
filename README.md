# Lumina Insight

Privacy-first learning analytics platform with:
- `extension/`: Chrome MV3 extension (content script, service worker, offscreen inference, sidepanel)
- `web_app/`: React dashboard + Flask backend API

## Quick Start

### Extension
```bash
cd extension
npm install
npm run build
npm test
```

### Web App (Frontend)
```bash
cd web_app
npm install
npm run dev
```

### Web App (Backend)
```bash
cd web_app/backend
pip install -r requirements.txt
python seed_data.py
python app.py
```

The frontend proxies `/api/*` calls to `http://localhost:5000`.

## Quality Gates

- Extension tests: `cd extension && npm test`
- Web app tests: `cd web_app && npm test`
- Web app production build: `cd web_app && npm run build`
- CI workflow enforces `npm ci && npm run build` for `web_app`.
