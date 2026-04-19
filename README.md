# Luffy-Laser-Dodge

3D dodge game with webcam head-tilt control via Python + WebRTC + OpenCV.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Backend (FastAPI + aiortc + OpenCV)


```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```


If using Conda instead:

```bash
conda run -n luffy-vision python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```


### Backend URL Configuration

The frontend expects backend signaling at the URL specified by the environment variable `VITE_BACKEND_OFFER_URL` (default: `http://localhost:8000/offer`).

To configure the backend URL for different environments, copy `.env.example` to `.env` in the `frontend` directory and set your backend URL:

```bash
cp frontend/.env.example frontend/.env
# Edit frontend/.env and set VITE_BACKEND_OFFER_URL as needed
```

Example `.env`:

```
VITE_BACKEND_OFFER_URL=https://your-backend-domain.com/offer
```

## Conda test environment

```bash
conda create -y -n luffy-vision python=3.11
conda run -n luffy-vision pip install -r backend/requirements.txt
conda run -n luffy-vision python -m py_compile backend/main.py
```