# Secure Python Backend

This is the secure proxy engine that replaces the client-side Gemini execution in the old VibeCode architecture. It intercepts HTTP requests from the React frontend, builds the AI prompts securely on the server, natively generates both the JSON statistics and the Image from Vertex AI, and perfectly safely returns it to the client.

## How to Boot Locally

1. Create a secure, isolated Python environment identically to a production Linux VM:
```bash
python3 -m venv venv
```

2. Activate the environment:
```bash
source venv/bin/activate
```

3. Install the heavily-secured Google GenAI SDK and FastAPI web server:
```bash
pip install -r requirements.txt
```

4. Boot the Uvicorn web server natively:
```bash
python3 main.py
```

The server is now actively listening on `http://localhost:8000` waiting for the Frontend to send a payload!
