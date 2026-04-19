# Frontend (Vite + React)

## Run

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed.

```bash
cp .env.example .env
```

- `VITE_BACKEND_OFFER_URL`: full backend WebRTC offer endpoint used by the camera mode.
	- Local default: `http://localhost:8000/offer`

If not set, the app falls back to `http://localhost:8000/offer`.
