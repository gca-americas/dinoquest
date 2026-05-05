<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7f360f2d-e7f3-4a5e-9a4c-e74d5934593a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## DinoQuest Architecture
The DinoQuest application operates seamlessly using a single-page application (SPA) architecture combined with cloud-based Backend-as-a-Service (BaaS) and AI services. Below is the high-level architecture diagram.


```mermaid
graph TD
    %% Define Styles
    classDef frontend fill:#3498db,stroke:#2980b9,stroke-width:2px,color:white;
    classDef firebase fill:#f39c12,stroke:#d68910,stroke-width:2px,color:white;
    classDef genai fill:#8e44ad,stroke:#71368a,stroke-width:2px,color:white;
    
    %% Components
    subgraph Client ["Client Interface (Vite + React)"]
        UI[React UI Components]:::frontend
        AI_SVC[Gemini Service<br>geminiService.ts]:::frontend
        FB_SVC[Firebase Service<br>firebase.ts]:::frontend
    end

    subgraph Firebase ["Firebase Backend (BaaS)"]
        Auth[Firebase Authentication<br>Google Auth]:::firebase
        DB[(Cloud Firestore<br>Database)]:::firebase
    end

    subgraph GoogleGenAI ["Google Gemini"]
        GeminiFlash[Gemini 3 Flash<br>JSON Generation]:::genai
        GeminiImage[Gemini 2.5 Image<br>Image Generation]:::genai
    end

    %% Relationships
    UI <--> FB_SVC
    UI <--> AI_SVC

    FB_SVC -->|Authenticates User| Auth
    FB_SVC -->|Reads/Writes User Dinos| DB
    
    AI_SVC -->|1. Prompts for Dino Stats| GeminiFlash
    AI_SVC -->|2. Prompts for Character Art| GeminiImage
```




Core Components
- Client Application (Vite + React): Handles the user interface, routing, and user interactions.
- Firebase Authentication: Leverages Google Provider (signInWithPopup) to ensure users can securely sign in and manage their collections.
- Cloud Firestore: A NoSQL cloud database storing connection states and saved user-generated dinosaurs.
- Google Gen AI (Gemini):
  - Generates the text-based attributes and stats of a dinosaur using the gemini-3-flash-preview model.
  - It also manages image generation for the dinosaurs with gemini-2.5-flash-image and compresses the base64 responses locally via the HTML5 canvas before they are managed by the application.



# FOR MCP SETUP 

gcloud services enable \
        developerknowledge.googleapis.com \
        bigquery.googleapis.com \
        bigquerydatatransfer.googleapis.com \
        logging.googleapis.com \
        monitoring.googleapis.com \
        run.googleapis.com \
        sqladmin.googleapis.com \
        cloudtrace.googleapis.com \
        clouderrorreporting.googleapis.com \
        firestore.googleapis.com \
        chronicle.googleapis.com \
        redis.googleapis.com \
        cloudresourcemanager.googleapis.com \
        aiplatform.googleapis.com