# Lumina Insight Testbench Setup & Run Guide

This document provides a step-by-step guide for graders to set up and test the Lumina Insight platform, which consists of a Chrome Extension, a Flask Backend, and a React Web App Dashboard.

## Prerequisites

- **Google Chrome** (Browser for the extension)
- **Node.js** (v16+)
- **Python** (v3.9+)
- **Docker** (For running RabbitMQ)

## Step 1: Start the RabbitMQ Broker

Lumina uses RabbitMQ to queue behavioral packets before ingestion.
1. Open a terminal in the project root.
2. Run the Docker compose command:
   ```bash
   docker-compose up -d
   ```
   *This starts the RabbitMQ broker with the `lumina.events` exchange and `Lumina_Event` queue.*

## Step 2: Set up and Run the Flask Backend

The backend handles federated learning updates, telemetry ingestion, and serves API data.
1. Navigate to the backend directory:
   ```bash
   cd web_app/backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Seed dummy data into the SQLite database:
   ```bash
   python seed_data.py
   ```
4. Start the Flask server:
   ```bash
   python app.py
   ```
   *The server runs on `http://localhost:5000`.*

## Step 3: Set up and Run the Web App Dashboard

The dashboard visualizes student states, nudges, and skill mastery.
1. Open a new terminal and navigate to the web app directory:
   ```bash
   cd web_app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Access the dashboard at the local URL provided (usually `http://localhost:5173`).*

## Step 4: Install and Load the Chrome Extension

The extension collects telemetry and runs local on-device inference using ONNX.
1. Open a new terminal and navigate to the extension directory:
   ```bash
   cd extension
   ```
2. Install dependencies & build:
   ```bash
   npm install
   npm run build
   ```
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Enable **"Developer mode"** in the top right corner.
5. Click **"Load unpacked"** and select the `extension/` directory.

## Testing the Application

### 1. Test Extension Inference
- Open any web page (e.g., a Wikipedia article or an LMS page like Canvas).
- Pin the Lumina Insight extension to your browser toolbar.
- Click the extension icon to view the real-time inference state.
- **Simulate "Focused"**: Read normally, scrolling down slowly.
- **Simulate "Struggling/Stalled"**: Move your mouse rapidly or switch tabs back and forth. Open the extension popup to see the state adapt based on the temporal sequence metrics running through our `ONNX` model.

### 2. Test Federated Hub Update
- When the extension calculates states, it simulates federated learning by sending local gradient weights to the backend.
- Check the terminal where `app.py` is running. You will see logs indicating *Federated Push*:
  `Aggregated X client weights into Global Model vX`

### 3. Dashboard Visualization
- Go to the running React dashboard (`http://localhost:5173`).
- Navigate through the "Skill Radar", "Temporal Analytics", or "Pulse Heatmap". 
- Data ingested from the telemetry simulator and the database seed script is displayed comprehensively.
