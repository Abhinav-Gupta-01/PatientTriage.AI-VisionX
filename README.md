# PatientTriage.AI

AI-Powered Emergency Department Command Center (Hackathon Prototype).

> **WARNING**: PatientTriage.ai is a clinical decision-support prototype using **simulated data**. It does not diagnose, prescribe treatment, or replace qualified clinical judgment.

## Table of Contents
- [Implementation Approach](#implementation-approach)
- [Solution Architecture](#solution-architecture)
- [Dependencies](#dependencies)
- [Execution Instructions](#execution-instructions)
- [Demo Flow](#demo-flow)
- [Known Limitations](#known-limitations)

---

## Implementation Approach

PatientTriage.AI is built as a distributed application with clear separation of concerns across a frontend client, an API gateway/backend, a machine learning microservice, and a cloud database. 

1. **Microservices-inspired Design**: The core logic is split into a Node.js API backend and a Python ML service. This allows the machine learning components (which rely heavily on data science libraries like Pandas and XGBoost) to scale and be updated independently of the core CRUD and business logic APIs.
2. **Type Safety & Rapid UI Development**: The frontend and backend are written in TypeScript to ensure end-to-end type safety. The UI is built with React and Vite for fast rendering, while styling is handled dynamically via TailwindCSS.
3. **Real-time Data & State Management**: The frontend relies on TanStack React Query for efficient data fetching, caching, and state synchronization.
4. **Cloud-Native Database**: Supabase (PostgreSQL) is utilized as a backend-as-a-service to quickly bootstrap the database schema and handle robust data storage.

## Solution Architecture

The solution consists of four primary components:

- **Frontend (Client)**: A single-page application built with React, Vite, and TypeScript. It features interactive analytics dashboards using Recharts and Framer Motion, and connects to the Backend API.
- **Backend (API Server)**: A Node.js and Express server that manages business logic, routing, authentication, and database operations. It acts as the orchestrator, requesting predictions from the ML Service when assessing patients.
- **ML Service (Prediction Engine)**: A standalone Python API powered by FastAPI. It loads a pre-trained XGBoost model to evaluate patient vitals and symptoms, returning a calculated risk score and confidence metrics. 
- **Database**: PostgreSQL hosted on Supabase, which stores patient records, users, audit logs, and operational data.

## Dependencies

### Frontend
- **Framework**: React 18.2.0, Vite 5.0.11
- **Language**: TypeScript 5.3.3
- **Styling**: TailwindCSS 3.4.1
- **State/Fetching**: @tanstack/react-query 5.17.0, Axios 1.6.5
- **UI Libraries**: Recharts 2.10.4 (charts), Framer Motion 10.18.0 (animations), Lucide React (icons)
- **Routing**: React Router DOM 6.21.1

### Backend
- **Framework**: Node.js, Express 4.18.2
- **Language**: TypeScript 5.3.3
- **Database Client**: @supabase/supabase-js 2.39.0
- **Validation & Auth**: Zod 3.22.4, jsonwebtoken 9.0.2, bcryptjs 2.4.3
- **Utilities**: dotenv, cors

### ML Service
- **API Framework**: FastAPI 0.109.0, Uvicorn 0.27.0
- **Machine Learning**: XGBoost 2.0.3, scikit-learn 1.4.0
- **Data Processing**: pandas 2.1.4, numpy 1.26.3
- **Testing**: pytest 7.4.4

---

## Execution Instructions

Follow these steps to run the application locally.

### 1. Database Setup (Supabase)
1. Create a new Supabase project at [https://supabase.com](https://supabase.com).
2. Navigate to the SQL Editor in your Supabase dashboard.
3. Paste and run the contents of `database/migrations/001_schema.sql` (if present) to initialize the tables.
4. Go to Project Settings -> API and copy your **Project URL**, **anon key**, and **service role key**.

### 2. Environment Variables
1. Copy the `.env.example` file in the project root to a new file named `.env`.
2. Fill in the Supabase values you copied earlier in the `.env` file.
3. The Frontend environment uses `frontend/.env` (ensure `VITE_API_URL=http://localhost:4000/api` is set if running the backend on port 4000).

### 3. Install & Run Services

You will need three terminal windows to run the full stack simultaneously.

**Terminal 1: ML Service**
```bash
cd ml-service
python -m venv venv
# On Windows: venv\Scripts\activate
# On Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python training/train.py # Train the XGBoost model
uvicorn app.main:app --reload --port 8000
```

**Terminal 2: Backend API**
```bash
cd backend
npm install
npm run seed # Seed the database with demo data
npm run dev  # Starts the server on port 4000
```

**Terminal 3: Frontend Client**
```bash
cd frontend
npm install
npm run dev # Starts the Vite dev server
```

Once all services are running, open your browser and navigate to `http://localhost:5173`.

---

## Demo Flow
1. Login as nurse - see 20 seeded patients.
2. Open Command Center, review KPIs and charts.
3. Open a patient - see AI risk, confidence, explanation, key factors.
4. Click Reassess or wait for simulation to trigger deterioration.
5. Login as doctor - Accept / Modify / Override recommendations.
6. Open Audit Logs to see full history.
7. Open Simulation Center - click SIMULATE 3x SURGE.
8. Watch queue growth, alerts, and analytics update live.

**Demo Accounts (password: `demo1234`)**
- nurse@demo.com
- doctor@demo.com
- admin@demo.com

## Testing
- **Backend**: `cd backend && npm test`
- **ML Service**: `cd ml-service && pytest`

## Known Limitations
- ML model trained on synthetic data (labeled prototype).
- Not clinically validated.
- Simulated patients only.
- LLM (AI Explanation) is optional; falls back to a deterministic template if not configured.
