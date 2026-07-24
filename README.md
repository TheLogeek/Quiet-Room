# MindMirror
[Live Demo](mindmirror-app.vercel.app)
**MindMirror** is a high-privacy, intelligent mental health check-in journal built for the GDG Lagos Hackathon. Accessible live at [mindmirror-app.vercel.app](mindmirror-app.vercel.app), it pairs local-first client storage with Google's **Gemma 4** model to deliver low-friction emotional tracking, instant neutral reflections, and streak-based pattern detection without building permanent database profiles on user activity.
## Key Features
 * **Gemma-Powered Emotional Extraction:** Automatically parses journal entries to extract mood scores, identify topic tags, and provide an instant, neutral reflection (*"Gemma noticed..."*) directly within the entry.
 * **Local-First History Storage:** Journal entries, mood histories, and structural pattern data remain strictly stored inside the user's browser via IndexedDB.
 * **Deterministic Pattern & Support System:** Built-in rule engine detects extended low-mood trends without exposing users to model hallucination or unverified psychological advice.
 * **Localized Emergency Safety Net:** Integrated support nudges and direct contacts for Nigerian mental health resources (including national emergency line **112** and **SURPIN**).
 * **Data Sovereignty Controls:** Instant one-click JSON data export and double-confirmation local database wipes.
## Product Architecture
MindMirror combines local browser performance with hosted AI processing to keep resource consumption minimal while maintaining model fidelity.
```
[ User Input ]
      │
      ├──> (1) Processing ──> Hosted Gemma 4 API ──> Mood, Tags & Reflection
      │                                                     │
      └──> (2) Storage ────> Browser IndexedDB <───────────┘

```
 * **Processing Engine:** Entries are processed via Google AI Studio's direct generateContent endpoint using gemma-4-26b-a4b-it with structured JSON extraction and low-latency thinking optimization.
 * **Persistence Layer:** Raw entries, historical scores, and app state live entirely within client-side IndexedDB (src/lib/storage.js).
 * **Safety & Crisis Interventions:** Pattern detection and crisis resources are strictly rule-based (src/lib/patterns.js), ensuring zero model drift or non-deterministic behavior during sensitive interactions.
## Getting Started
### Prerequisites
 * Node.js (v18 or higher recommended)
 * A Google AI Studio API Key (aistudio.google.com)
### Installation
 1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/your-username/mindmirror.git
   cd mindmirror
   npm install
   
   ```
 2. **Configure Environment Variables:**
   Copy the example environment file and add your Google AI Studio API key:
   ```bash
   cp .env.example .env.local
   
   ```
   Add your key in .env.local:
   ```env
   VITE_GOOGLE_API_KEY=your_google_ai_studio_key_here
   
   ```
 3. **Run Development Server:**
   ```bash
   npm run dev
   
   ```
## Crisis Resources & Localization
MindMirror defaults to localized crisis intervention tools for Nigeria:
 * **National Emergency:** 112
 * **SURPIN (Suicide Research and Prevention Initiative):** 24/7 National Helpline
> **Note on Forking:** If deploying MindMirror for regions outside Nigeria, update the crisis contact constants inside src/lib/patterns.js to match local health authorities.
> 
## Privacy & Security Considerations
 * **Transient AI Requests:** Journal entries are sent transiently to Google's API endpoints for structured processing and reflection extraction. Text is not retained in a custom external backend database.
 * **Client-Only Architecture:** This build operates without an explicit backend middleware layer. For enterprise production deployments, API key handling should be proxied through a server-side route (e.g., Vercel Edge Functions or AWS Lambda) to keep client keys unexposed.
## Tech Stack
 * **Frontend:** React, Vite, Tailwind CSS
 * **Deployment:** Vercel (mindmirror-app.vercel.app)
 * **Model Engine:** Gemma 4 (gemma-4-26b-a4b-it) via Google AI Studio API
 * **Local Storage:** IndexedDB
 * **Icons & UI:** Lucide React
## Team
Built for the **GDG Lagos Hackathon** by:
 * **Solomon Adenuga**
 * **Zakarriya Temitope**
## License
Distributed under the MIT License. See LICENSE for more information.
