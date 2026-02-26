Phase 1: The Business Model
For an interview copilot, you have two highly effective pricing strategies:

1. The "Pay-Per-Interview" Model (Recommended for launch)
   • How it works: Users buy "credits." $5 gets you 2 hours of interview time.
   • Why it works: Job hunting is temporary. People might not want a monthly subscription if they only have three interviews this week.
   • The Math: Deepgram and Groq cost you roughly $0.20 to $0.30 per hour of live processing. If you charge $5 for 2 hours, your profit margin is over 80%.
2. The "Pro Subscription" Model
   • How it works: $15/month for unlimited interviews, saving chat histories, and advanced AI models (like allowing them to choose a harsher/stricter AI persona).
   • Why it works: Predictable recurring revenue for you while they are actively job hunting.

# 🚀 Interview Copilot

Interview Copilot is a real-time, AI-powered interview assistant. It actively listens to your live job interviews and instantly provides teleprompter-style, highly tailored answers based on your specific resume and the target job description.

This is a fully monetized, full-stack SaaS application.

## 🏗️ The Tech Stack

This project is divided into a modern frontend, a high-performance streaming backend, and a suite of third-party cloud integrations.

### 💻 Frontend (Client)

- **Framework:** React.js
- **Styling:** CSS / Tailwind (for the UI and teleprompter display)
- **Hosting:** Vercel (for lightning-fast global edge delivery)
- **State Management:** React Hooks (managing live WebSocket data, transcriptions, and AI responses)

### ⚙️ Backend (Server)

- **Framework:** Python / FastAPI
- **Real-Time Communication:** WebSockets (handling continuous bidirectional audio streaming)
- **Hosting:** Railway (Dockerized container deployment)
- **Document Parsing:** `PyPDF` and `python-docx` (extracting context from uploaded resumes)

### 🧠 AI & Audio Processing

- **Speech-to-Text (STT):** Deepgram (Nova-2 model via live WebSocket for sub-second transcription and Voice Activity Detection)
- **Large Language Model (LLM):** Groq API (for ultra-low latency AI inference to generate real-time answers without awkward pauses)

### 🗄️ Database & Authentication

- **Provider:** Supabase (PostgreSQL)
- **Auth:** Secure user JWT authentication and session management
- **Ledger:** Real-time database table (`user_credits`) to track and deduct available interview minutes.

### 💳 Monetization & Payments

- **Provider:** Stripe
- **Checkout:** Stripe Hosted Checkout Sessions (handling secure credit card processing)
- **Webhooks:** Automated server-to-server communication to fulfill credit balances upon successful payment.

---

## 🔄 How It Works (The Data Flow)

1. **Context Loading:** The user logs in via **Supabase Auth**, uploads their resume (PDF/Word), and pastes the job description. The **FastAPI** backend parses the text and loads it into the AI's "Brain" (System Prompt).
2. **The Connection:** When the user clicks "Start", the React frontend opens a secure **WebSocket** connection to the Python backend, passing the Supabase Auth Token.
3. **Credit Verification:** The backend verifies the token and checks the Supabase database. If the user has a balance > 0, the connection is accepted and a background task begins deducting 1 minute per minute connected.
4. **Live Audio Streaming:** The user's browser captures microphone audio, chunking it into bytes, and sending it through the WebSocket to FastAPI. FastAPI pipes this directly to **Deepgram**.
5. **VAD & Transcription:** Deepgram processes the audio. When it detects the end of a sentence (Utterance End), it sends the final transcribed text back to FastAPI.
6. **AI Inference:** FastAPI hands the transcribed question to the **Groq LLM**. Groq references the user's Resume and Job Description, and generates a short, punchy, strategic answer.
7. **The Teleprompter:** The AI answer is streamed back through the WebSocket to the **React frontend**, rendering instantly on the user's screen.
8. **Top-Ups:** If a user runs out of time, the WebSocket drops. They click "Add Time", which hits a **Stripe** Checkout URL. Upon payment, Stripe fires a Webhook to the FastAPI server, which updates the Supabase credit table, allowing the user to reconnect.

## 🛠️ Local Setup & Installation

Want to run Interview Copilot on your own machine? Follow these steps to get the local development environment up and running.

### Prerequisites

- Node.js (v16+)
- Python (v3.9+)
- Accounts & API Keys for: Supabase, Stripe, Deepgram, and Groq

### 1. Clone the Repository

```bash
git clone [https://github.com/your-username/interview-copilot.git](https://github.com/your-username/interview-copilot.git)
cd interview-copilot

2. Backend Setup (FastAPI)
Open a terminal and navigate to the backend folder (assuming your Python code is in a backend directory):

Bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
Create a .env file in the backend directory and add your private keys:

Code snippet
DEEPGRAM_API_KEY=your_deepgram_key
GROQ_API_KEY=your_groq_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=[https://your-project.supabase.co](https://your-project.supabase.co)
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
Start the Python server:

Bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
3. Frontend Setup (React)
Open a new terminal window and navigate to your frontend folder:

Bash
cd frontend

# Install dependencies
npm install
Create a .env.local (or .env) file in the frontend directory with your public keys:

Code snippet
NEXT_PUBLIC_SUPABASE_URL=[https://your-project.supabase.co](https://your-project.supabase.co)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
Start the React development server:

Bash
npm start  # or npm run dev
Your frontend should now be running on http://localhost:3000 and successfully communicating with your local Python backend!

4. Testing Webhooks Locally (Stripe)
To test the payment top-up system locally without deploying, install the Stripe CLI and forward webhooks to your local FastAPI server:

Bash
stripe listen --forward-to localhost:8000/webhook
```
