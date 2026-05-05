#!/bin/bash

echo "🚀 Booting DinoQuest2 Unified Monolith..."

trap 'kill 0' EXIT

echo "=========================================="
echo "⚛️ 1) Compiling React Thin-Client..."
echo "=========================================="
cd frontend
npm install -q
# Build the extremely fast Vite static output mapping to /dist
npm run build
cd ..

echo ""
echo "=========================================="
echo "🐍 2) Booting Unified Python Gateway..."
echo "=========================================="
cd backend
#python3 -m venv venv
source venv/bin/activate
#pip install -r requirements.txt -q
# Start the FastAPI backend server completely independently in the FOREGROUND carrying the full weight of the application
python3 main.py
