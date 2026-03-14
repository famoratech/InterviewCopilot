🚀 Interview Copilot (Full-Stack SaaS)
Interview Copilot is a comprehensive, AI-powered interview prep and real-time assistance platform. It acts as an end-to-end toolkit for job seekers—helping them tailor their resumes, practice with a strict AI coach, and receive real-time, teleprompter-style answers during live interviews.

This is a fully monetized, production-ready SaaS application.

💸 The Business Model
For an interview tool, we utilize a highly effective hybrid pricing strategy based on "Interview Minutes":

The "Pay-Per-Minute" Model (Live & Practice Sessions)

How it works: Users buy "credits" (e.g., $5 for 120 minutes). As they use the Live Copilot or the Mock Interview Coach, a background timer securely deducts minutes from their account in real-time.

Why it works: Job hunting is temporary. People prefer a la carte pricing over monthly subscriptions if they only have three interviews this week.

The Math: Deepgram and Groq cost roughly $0.20 to $0.30 per hour of live processing. Charging $5 for 2 hours yields an 80%+ profit margin.

The "Flat-Fee" Model (Resume Optimizer - Coming Soon)

How it works: Instead of a running stopwatch, the system deducts a flat chunk of minutes (e.g., 10, 25, or 50 minutes) for instant, one-click resume tailoring based on the complexity of the AI generation.

🌟 The 4 Core Pillars (Features)

1. 🎥 Video Copilot
   Listens to system audio via screen-sharing. It actively transcribes the interviewer's questions and streams teleprompter-style, strategic answers to the user's screen in real-time, based on their uploaded resume and job description.

2. 📞 Phone Copilot
   Listens directly to the user's microphone. Ideal for initial recruiter phone screens. It provides the same real-time, ultra-low latency teleprompter assistance.

3. 🤖 AI Interview Coach (Mock Interviews)
   An interactive practice environment. The user inputs their resume and target job description, selects a difficulty (Easy, Medium, Hard), and engages in a back-and-forth verbal interview.

Continuous Audio: Users answer verbally using their microphone.

Granular Feedback: After every answer, the AI provides a specific Rating (Poor/Good/Excellent), 1 sentence of actionable feedback, and the next question.

Final Scorecard: At the end of the session, the AI generates a beautiful UI card with an overall score out of 100, an executive summary, and 3 actionable areas for improvement.

4. 📄 Resume Optimizer (Coming Soon!)
   A tiered, AI-driven resume revision tool designed to beat Applicant Tracking Systems (ATS) and bridge experience gaps without inventing fake credentials.

Tier 1 (10 mins): Basic ATS keyword matching, formatting, and grammar fixes.

Tier 2 (25 mins): Deep polish and aggressive phrasing to infer industry duties and elevate real experience.

Tier 3 (50 mins): The Aspirational Gap Bridger. Identifies missing skills from the JD and generates a custom, realistic "Weekend Project" the user can build, complete with pre-written resume bullets to legitimately fill their experience gap.

🏗️ The Tech Stack
This project is divided into a modern frontend, a high-performance streaming backend, and a suite of third-party cloud integrations.

💻 Frontend (Client)
Framework: React.js / Next.js

Styling: Tailwind CSS (for the UI, teleprompter display, and JSON-parsed feedback cards)

State Management: React Hooks (managing live WebSocket data, continuous audio streams, and local timers)

⚙️ Backend (Server)
Framework: Python / FastAPI

Real-Time Communication: WebSockets (handling continuous bidirectional audio streaming for Copilots)

REST APIs: Standard HTTP endpoints for structured JSON data generation (Coach & Optimizer).

Document Parsing: PyPDF2 and python-docx (extracting context from uploaded resumes)

🧠 AI & Audio Processing
Speech-to-Text (STT): Deepgram (Nova-2 model via live WebSocket for sub-second transcription and Voice Activity Detection)

Large Language Model (LLM): Groq API (Llama 3.3 70B for ultra-low latency AI inference and strict JSON schema generation)

🗄️ Database & Authentication
Provider: Supabase (PostgreSQL)

Auth: Secure user JWT authentication and session management

Ledger: Real-time database table (user_credits) to track and deduct available interview minutes securely from the server.

💳 Monetization & Payments
Provider: Stripe

Checkout: Stripe Hosted Checkout Sessions (handling secure credit card processing)

Webhooks: Automated server-to-server communication to fulfill credit balances upon successful payment.

🔄 How It Works (The Data Flow)
The Live Copilot Flow:
Context Loading: The user uploads their resume and pastes a job description. The FastAPI backend parses the text and loads it into the AI's "Brain" (System Prompt).

The Connection: The React frontend opens a secure WebSocket connection to the Python backend, passing the Supabase Auth Token.

Credit Verification: The backend verifies the token. If the user has a balance > 0, the connection is accepted and a background task begins deducting 1 minute per minute connected.

Live Audio Streaming: The browser captures audio, chunking it into bytes, and sending it through the WebSocket. FastAPI pipes this directly to Deepgram.

AI Inference: When Deepgram detects the end of a sentence, FastAPI hands the transcribed text to the Groq LLM. Groq generates a strategic answer.

The Teleprompter: The AI answer is streamed back through the WebSocket, rendering instantly on the user's screen.

The Coach / Optimizer Flow:
Strict JSON: For non-live features, the frontend makes standard POST requests to FastAPI.

Schema Enforcement: FastAPI instructs Groq to respond using response_format={"type": "json_object"}, ensuring the output perfectly matches a predefined schema (Ratings, Feedback, Scorecards).

Syncing: The frontend manages a local UI timer, but makes periodic POST /sync-time requests to securely deduct elapsed minutes from the Supabase ledger.

🛠️ Local Setup & Installation
Want to run Interview Copilot on your own machine? Follow these steps to get the local development environment up and running.

Prerequisites
Node.js (v16+)

Python (v3.9+)

Accounts & API Keys for: Supabase, Stripe, Deepgram, and Groq

1. Clone the Repository
   Bash
   git clone https://github.com/your-username/interview-copilot.git
   cd interview-copilot
2. Backend Setup (FastAPI)
   Open a terminal and navigate to the backend folder:

Bash
cd backend

# Create and activate a virtual environment

python -m venv venv
source venv/bin/activate # On Windows use: venv\Scripts\activate

# Install dependencies

pip install -r requirements.txt
Create a .env file in the backend directory and add your private keys:

Code snippet
DEEPGRAM*API_KEY=your_deepgram_key
GROQ_API_KEY=your_groq_key
STRIPE_SECRET_KEY=sk_test*...
STRIPE*WEBHOOK_SECRET=whsec*...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
Start the Python server:

Bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000 3. Frontend Setup (React/Next.js)
Open a new terminal window and navigate to your frontend folder:

Bash
cd frontend

# Install dependencies

npm install
Create a .env.local file in the frontend directory with your public keys:

Code snippet
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Set these to localhost for local testing!

NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
Start the React development server:

Bash
npm run dev
Your frontend should now be running on http://localhost:3000 and successfully communicating with your local Python backend!

4. Testing Webhooks Locally (Stripe)
   To test the payment top-up system locally without deploying, install the Stripe CLI and forward webhooks to your local FastAPI server:

Bash
stripe listen --forward-to localhost:8000/webhook
