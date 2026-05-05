# Stage 1: Build the React Thin-Client
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Python Server
FROM python:3.11-slim
WORKDIR /app/backend

# Install python dependencies first for caching purposes
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the actual python logic
COPY backend/main.py ./

# Extract the purely built static files securely from the Node container stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Securely expose required Serverless port
ENV PORT=8080
EXPOSE 8080

# Execute the FastAPI server directly in production mode
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
