# Lumina Insight Web App

This folder contains:
- `src/`: React + Vite dashboard UI
- `backend/`: Flask + SQLAlchemy API for dashboard and federated endpoints

## Frontend

```bash
npm install
npm run dev
```

Useful commands:
- `npm test`
- `npm run build`

## Backend

```bash
cd backend
pip install -r requirements.txt
python seed_data.py
python app.py
```

API base URL: `http://localhost:5000/api`.
