import os
import logging
import asyncio
import json
import io
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Optional

# --- SUPABASE & STRIPE ---
from supabase import create_client, Client
import stripe

# --- DEEPGRAM ---
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)

# --- DOCUMENT PARSERS ---
from pypdf import PdfReader  # Reverted back to your original pypdf
from docx import Document

# --- INTERNAL MODULES ---
from core.brain import Brain
from core.llm import stream_completion

# --- NEW: AI CLIENT FOR COACH ---
from groq import Groq 

load_dotenv()

print("👀 PYTHON SEES THESE VARIABLES:", list(os.environ.keys()))

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger("backend")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- IN-MEMORY SESSION MANAGEMENT ---
user_sessions = {}

def get_brain_for_user(user_id: str):
    """Retrieves or creates a unique Brain instance for a specific user."""
    if user_id not in user_sessions:
        logger.info(f"🧠 Creating new Brain instance for user: {user_id}")
        user_sessions[user_id] = Brain()
    return user_sessions[user_id]


# --- API KEYS & CLIENTS SETUP ---
raw_api_key = os.getenv("DEEPGRAM_API_KEY")
DEEPGRAM_API_KEY = raw_api_key.strip() if raw_api_key else None

if not DEEPGRAM_API_KEY:
    logger.error("❌ Deepgram API Key missing! Check .env file.")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("🟢 Supabase Admin Client Connected")
else:
    logger.error("❌ Supabase URL or Service Key missing from .env!")

# STRIPE SETUP
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Initialize the AI Client for the Coach feature
# Ensure GROQ_API_KEY is in your .env
coach_llm_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


# --- HELPER FUNCTIONS ---
def extract_text_from_file(file_content: bytes, filename: str) -> str:
    text = ""
    try:
        if filename.endswith(".pdf"):
            reader = PdfReader(io.BytesIO(file_content))
            for page in reader.pages:
                text += page.extract_text() + "\n"
        elif filename.endswith(".docx"):
            doc = Document(io.BytesIO(file_content))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            text = file_content.decode("utf-8")
    except Exception as e:
        logger.error(f"Error parsing file: {e}")
        return "Error reading resume."
    return text

def get_difficulty_instruction(level: str):
    if level == "Easy":
        return "Ask standard behavioral questions (e.g., 'Tell me about yourself'). Be encouraging."
    elif level == "Medium":
        return "Ask standard technical questions relevant to the resume. Be professional."
    elif level == "Hard":
        return "Ask very difficult, deep technical questions and edge cases. Be skeptical."
    return "Ask standard questions."


# --- DATA MODELS ---
class CheckoutRequest(BaseModel):
    token: str
    return_url: str

class CoachReply(BaseModel):
    history: List[dict]
    resume_text: str  
    job_description: str
    user_answer: str
    difficulty: str

class SyncTimeReq(BaseModel):
    user_id: str
    minutes_to_deduct: int


# ==========================================
#         REST ENDPOINTS (CORE & BILLING)
# ==========================================

@app.post("/sync-time")
async def sync_time(req: SyncTimeReq):
    """Officially deducts minutes from the database during Coach sessions."""
    try:
        curr_res = await asyncio.to_thread(
            lambda: supabase.table("user_credits").select("balance_minutes").eq("user_id", req.user_id).single().execute()
        )
        curr_bal = curr_res.data.get("balance_minutes", 0)
        
        if curr_bal > 0:
            new_bal = curr_bal - req.minutes_to_deduct
            await asyncio.to_thread(
                lambda: supabase.table("user_credits").update({"balance_minutes": new_bal}).eq("user_id", req.user_id).execute()
            )
            return {"status": "success", "new_balance": new_bal}
        return {"status": "insufficient_funds"}
    except Exception as e:
        logger.error(f"Sync time error: {e}")
        return {"error": str(e)}

@app.post("/submit-context")
async def submit_context(
    user_id: str = Form(...),  
    resume: UploadFile = File(...), 
    job_description: str = Form(default="")
):
    """Used for the Live Copilot Context Setup"""
    try:
        user_brain = get_brain_for_user(user_id)
        content = await resume.read()
        resume_text = extract_text_from_file(content, resume.filename)
        
        user_brain.set_context(resume_text, job_description)
        logger.info(f"✅ Context updated for User {user_id}. Resume length: {len(resume_text)}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/create-checkout-session")
async def create_checkout_session(req: CheckoutRequest):
    try:
        user_res = await asyncio.to_thread(supabase.auth.get_user, req.token)
        user_id = user_res.user.id
        user_email = user_res.user.email

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': 'price_1T4pnAEFLEZAHwelrTvPR1Os', 
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{req.return_url}/?success=true",
            cancel_url=f"{req.return_url}/?canceled=true",
            customer_email=user_email,
            client_reference_id=user_id, 
        )
        return {"url": session.url}
    except Exception as e:
        logger.error(f"Stripe error: {str(e)}")
        return {"error": str(e)}

@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return {"error": "Invalid payload"}, 400
    except stripe.error.SignatureVerificationError:
        return {"error": "Invalid signature"}, 400

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id') 

        if user_id:
            logger.info(f"💰 Payment success for {user_id}. Adding 60 mins.")
            try:
                curr_res = await asyncio.to_thread(
                    lambda: supabase.table("user_credits").select("balance_minutes").eq("user_id", user_id).single().execute()
                )
                curr_bal = curr_res.data.get("balance_minutes", 0)
                new_bal = curr_bal + 60
                await asyncio.to_thread(
                    lambda: supabase.table("user_credits").update({"balance_minutes": new_bal}).eq("user_id", user_id).execute()
                )
                logger.info(f"✅ Balance updated to {new_bal}")
            except Exception as e:
                logger.error(f"❌ Failed to update Supabase: {e}")

    return {"status": "success"}


# ==========================================
#         AI COACH ENDPOINTS
# ==========================================

@app.post("/coach/start")
async def start_coaching(
    user_id: str = Form(...),
    job_description: str = Form(""),
    difficulty: str = Form("Medium"),
    resume_text: str = Form(""),
    resume_file: UploadFile = File(None)
):
    print(f"--- STARTING COACH SESSION FOR USER: {user_id} ---")
    final_resume_text = resume_text

    if resume_file:
        print(f"Received file: {resume_file.filename}")
        try:
            content = await resume_file.read()
            final_resume_text = extract_text_from_file(content, resume_file.filename)
            print(f"Successfully extracted {len(final_resume_text)} characters from file.")
        except Exception as e:
            logger.error(f"File extraction failed: {str(e)}")
            return {"error": f"Could not read file: {str(e)}"}

    if not final_resume_text.strip():
        print("Warning: No resume text provided or extracted.")
        final_resume_text = "No resume provided. Ask general interview questions."

    diff_instruction = get_difficulty_instruction(difficulty)
    
    prompt = f"""
    You are an expert technical interviewer. 
    Difficulty Level: {difficulty}
    {diff_instruction}
    
    User Resume: {final_resume_text[:2000]}
    Job Description: {job_description[:2000]}
    
    Start the interview. Output JUST the opening question.
    """
    
    print("Calling Groq API...")
    try:
        response = coach_llm_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": prompt}],
            temperature=0.7,
            max_tokens=200
        )
        print("Groq API returned successfully.")
        
        return {
            "message": response.choices[0].message.content,
            "extracted_resume": final_resume_text 
        }
    except Exception as e:
        logger.error(f"Groq API Error: {str(e)}")
        # Return a 500 error structure that the frontend can at least read
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/coach/reply")
async def reply_coaching(data: CoachReply):
    diff_instruction = get_difficulty_instruction(data.difficulty)

    # UPDATED: We explicitly demand a JSON structure.
    messages = [
        {"role": "system", "content": f"""
        You are a strict but helpful Interview Coach.
        Difficulty Level: {data.difficulty}
        {diff_instruction}
        
        Job Description: {data.job_description[:500]}
        Resume: {data.resume_text[:1000]}
        
        The user just answered your question.
        1. Analyze their answer against their resume.
        2. Give a short rating (Poor/Good/Excellent).
        3. Provide 1 sentence of specific feedback.
        4. Ask the NEXT question based on the difficulty level.
        
        CRITICAL: You MUST respond ONLY with a valid JSON object in the exact format below. Do not include markdown code blocks, just raw JSON.
        {{
            "rating": "[Poor/Good/Excellent]",
            "feedback": "Your 1 sentence feedback here.",
            "next_question": "Your next question here."
        }}
        """}
    ]
    
    for msg in data.history:
        messages.append(msg)
    
    messages.append({"role": "user", "content": data.user_answer})

    response = coach_llm_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.7,
        max_tokens=500,
        response_format={"type": "json_object"} # FORCING JSON OUTPUT (Groq supports this)
    )
    
    return {"message": response.choices[0].message.content}

@app.post("/coach/end")
async def end_coaching(data: CoachReply):
    messages = [
        {"role": "system", "content": f"""
        You are a strict but helpful Interview Coach. The interview is now OVER.
        Generate a final Scorecard based on the candidate's answers.
        Resume Context: {data.resume_text[:500]}
        
        CRITICAL: You MUST respond ONLY with a valid JSON object in the exact format below. 
        Do not ask any more questions. Do not include markdown code blocks.
        {{
            "overall_score": 75,
            "summary": "A 2-sentence overall summary of their performance highlighting their main strength.",
            "areas_of_improvement": [
                "First specific actionable bullet point.",
                "Second specific actionable bullet point.",
                "Third specific actionable bullet point."
            ]
        }}
        """}
    ]
    
    # Append the history so it knows what to grade
    for msg in data.history:
        messages.append(msg)

    response = coach_llm_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.7,
        max_tokens=600,
        response_format={"type": "json_object"} # Force strict JSON
    )
    return {"message": response.choices[0].message.content}


# ==========================================
#         WEBSOCKET (LIVE COPILOT)
# ==========================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    await websocket.accept()
    logger.info("🚀 NEW CONNECTION ATTEMPT")

    if not token:
        logger.error("❌ No token provided. Closing.")
        await websocket.close(code=1008)
        return

    loop = asyncio.get_event_loop()

    try:
        user_res = await asyncio.to_thread(supabase.auth.get_user, token)
        user_id = user_res.user.id

        current_brain = get_brain_for_user(user_id)

        credit_res = await asyncio.to_thread(
            lambda: supabase.table("user_credits").select("balance_minutes").eq("user_id", user_id).single().execute()
        )
        balance = credit_res.data.get("balance_minutes", 0)

        if balance <= 0:
            logger.info(f"User {user_id} has 0 credits.")
            await websocket.send_json({"event": "out_of_credits"})
            await websocket.close()
            return

        logger.info(f"✅ User {user_id} Connected | Balance: {balance}m")

    except Exception as e:
        logger.error(f"❌ Auth Error: {e}")
        await websocket.close(code=1008)
        return

    countdown_active = True
    async def credit_countdown():
        while countdown_active:
            await asyncio.sleep(60)
            if not countdown_active: break
            
            try:
                curr_res = await asyncio.to_thread(
                    lambda: supabase.table("user_credits").select("balance_minutes").eq("user_id", user_id).single().execute()
                )
                curr_bal = curr_res.data.get("balance_minutes", 0)

                if curr_bal > 0:
                    new_bal = curr_bal - 1
                    await asyncio.to_thread(
                        lambda: supabase.table("user_credits").update({"balance_minutes": new_bal}).eq("user_id", user_id).execute()
                    )
                    await websocket.send_json({"event": "credit_update", "balance": new_bal})
                    
                    if new_bal <= 0:
                        await websocket.send_json({"event": "out_of_credits"})
                        await websocket.close()
                        break
            except Exception as e:
                logger.error(f"⚠️ Countdown error: {e}")

    countdown_task = asyncio.create_task(credit_countdown())

    try:
        config = DeepgramClientOptions(url="api.deepgram.com", verbose=logging.WARNING)
        deepgram = DeepgramClient(DEEPGRAM_API_KEY, config)
        dg_connection = deepgram.listen.live.v("1")
    except Exception as e:
        logger.error(f"Deepgram Init Failed: {e}")
        countdown_task.cancel()
        await websocket.close()
        return

    transcript_buffer = [] 
    
    async def trigger_ai_response(text):
        if len(text.strip()) < 2: return

        logger.info(f"🚀 AI Triggered for {user_id}: '{text[:30]}...'")
        await websocket.send_json({"event": "ai_start"})
        
        system_prompt = current_brain.build_system_prompt()
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(current_brain.history)
        messages.append({"role": "user", "content": text})

        full_answer = ""
        try:
            async for chunk in stream_completion(messages):
                full_answer += chunk
                await websocket.send_json({"event": "ai_chunk", "text": chunk})
            
            current_brain.add_interaction(text, full_answer)
            await websocket.send_json({"event": "ai_done"})
        except Exception as e:
            logger.error(f"AI Error: {e}")
            await websocket.send_json({"event": "ai_done"})

    # DEEPGRAM EVENT HANDLERS
    def on_message(self, result, **kwargs):
        sentence = result.channel.alternatives[0].transcript
        if len(sentence) > 0:
            is_final = result.is_final
            asyncio.run_coroutine_threadsafe(
                websocket.send_json({"event": "transcript", "text": sentence, "is_final": is_final}), loop
            )
            if is_final:
                transcript_buffer.append(sentence)
                if sentence.strip().endswith("?"):
                    full_text = " ".join(transcript_buffer)
                    transcript_buffer.clear()
                    asyncio.run_coroutine_threadsafe(trigger_ai_response(full_text), loop)

    def on_utterance_end(self, utterance_end, **kwargs):
        if len(transcript_buffer) > 0:
            full_text = " ".join(transcript_buffer)
            if len(full_text.split()) >= 2:
                transcript_buffer.clear()
                asyncio.run_coroutine_threadsafe(trigger_ai_response(full_text), loop)

    dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
    dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)
    
    options = LiveOptions(
        model="nova-2", 
        language="en-US", 
        smart_format=True, 
        interim_results=True, 
        utterance_end_ms="1000", 
        vad_events=True
    )
    
    if dg_connection.start(options) is False:
        logger.error("Failed to connect to Deepgram")
        countdown_task.cancel()
        await websocket.close()
        return

    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message:
                dg_connection.send(message["bytes"])
            if "text" in message:
                msg = json.loads(message["text"])
                if msg.get("text") == "stop": break
    except WebSocketDisconnect:
        logger.info(f"🔴 User {user_id} Disconnected")
    finally:
        countdown_active = False 
        countdown_task.cancel()
        dg_connection.finish()