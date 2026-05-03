# Luffy Laser Dodge 🏴‍☠️🤖

**Luffy Laser Dodge** is an interactive, browser-based 3D reflex game where you use your **actual head movements** via webcam to dodge laser beams shot by Kuma! 

Built with React, React Three Fiber, and MediaPipe AI, the game seamlessly melds computer vision with 3D web rendering to create a unique physically interactive experience—all running 100% locally in your browser.

![Luffy Laser Dodge](public/logo_nobg.png) *(Placeholder logo reference)*

---

## ✨ Features

- **Real-Time AI Head Tracking**: Uses Google's MediaPipe (`@mediapipe/tasks-vision`) via WebAssembly (WASM) to detect your face and lean angles instantly.
- **Dynamic 3D Scene**: Powered by `Three.js` and `@react-three/fiber`, featuring fully rigged 3D models with bone-level procedural animation (Luffy's neck physically bends as your real neck bends).
- **100% Client-Side Processing**: No video feeds are sent to any server. Your webcam data is processed entirely on your local GPU/CPU for zero latency and absolute privacy.
- **Responsive Gameplay**: Three difficulty tiers (Easy, Medium, Hard) that adjust laser speed, spawn rates, and scoring.
- **Persistent Progression**: LocalStorage-saved high scores mapped to each difficulty.
- **Fallback Controls**: Don't want to use a camera? Fully playable using Keyboard (`A`/`D` or `Arrow` keys) or Mobile touch screens (tap left/right).

---

## 🏛️ Architecture Evolution

### Current Architecture (V2 - Serverless / Client-Side)
To make the application infinitely scalable, zero-latency, and capable of being hosted on free serverless platforms (like Vercel), the architecture was migrated to a entirely client-side application.
- **Framework:** React + Vite
- **AI Inference:** `@mediapipe/tasks-vision` running the `blaze_face_short_range.tflite` model directly in the browser using WebAssembly.
- **Hosting:** Pure static site deployment.

### Legacy Architecture (V1 - WebRTC + Python Backend)
Originally, this project utilized a Client-Server architecture designed for heavy backend AI inference.
- **The Setup:** A React frontend streamed user webcam video over **WebRTC** using STUN servers to a Python FastAPI backend.
- **The Backend:** Used `aiortc` to ingest WebRTC video tracks, applied OpenCV and MediaPipe python libraries frame-by-frame, and sent `head_tilt` coordinates back to the client via WebRTC Data Channels.
- **Why we moved on:** Real-time reflex games require incredibly low latency. Network routing added input delay. Furthermore, serverless platforms like Vercel **do not support persistent UDP connections or WebSockets** required for WebRTC. Moving the AI to WASM within the browser eliminated server costs, simplified deployment, and eliminated network lag.
*(Note: The professional FastAPI WebRTC structure is preserved in the `backend/` directory for educational/legacy reference.)*

---

## 📂 Project Structure

```text
├── frontend/             # The active React V2 Client-Side Game
│   ├── src/
│   │   ├── components/   # React components (Game canvas, HUD, Menus)
│   │   ├── config/       # Difficulty & rule configurations
│   │   ├── hooks/        # Custom React hooks (Audio, WebRTC bounds)
│   │   ├── utils/        # Helper functions
│   │   └── App.jsx       # Main application entry point
│   ├── package.json
│   └── vite.config.js
│
└── backend/              # V1 Legacy Python API (Kept for reference)
    ├── app/
    │   ├── api/          # WebRTC Offer/Answer endpoints
    │   ├── core/         # Logging and Config
    │   ├── services/     # Video Stream ingestion and Vision Inference
    │   └── main.py       # FastAPI Entrypoint
    ├── models/           # Legacy tflite model binaries
    └── requirements.txt
```

---

## 🚀 Getting Started

Since the game is completely client-side, setup is incredibly straightforward!

### Prerequisites
- Node.js (v18+)
- A Webcam (Laptop internal or USB)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/halcyon-past/Luffy-Laser-Dodge.git
   cd Luffy-Laser-Dodge/frontend
   ```

2. Install NPM dependencies:
   ```bash
   npm install
   ```

3. Spin up the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`. Grant your browser webcam permissions when prompted, lean left and right, and dodge the lasers!

### Deployment
Because this relies on zero backend servers, you can easily deploy it by connecting the repository to Vercel, Netlify, or GitHub Pages. The build command is simply:
```bash
npm run build
```

---
**Created by Aritro Saha** • [aritro.cloud](https://aritro.cloud)
