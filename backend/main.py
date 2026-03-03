import os
import logging
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# --- SUPABASE ---
from supabase import create_client, Client

# Deepgram SDK
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)

# Document Parsers
from pypdf import PdfReader
from docx import Document
import io

# Internal Modules
from core.brain import Brain
from core.llm import stream_completion
import stripe
from pydantic import BaseModel

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

# --- NEW: MULTI-USER SESSION MANAGEMENT ---
# Instead of one global brain, we store a dictionary of brains.
# Format: { "user_123": Brain_Instance, "user_456": Brain_Instance }
user_sessions = {}

def get_brain_for_user(user_id: str):
    """Retrieves or creates a unique Brain instance for a specific user."""
    if user_id not in user_sessions:
        logger.info(f"🧠 Creating new Brain instance for user: {user_id}")
        user_sessions[user_id] = Brain()
    return user_sessions[user_id]

# --- API KEYS & CLIENTS ---
raw_api_key = os.getenv("DEEPGRAM_API_KEY")
DEEPGRAM_API_KEY = raw_api_key.strip() if raw_api_key else None

if not DEEPGRAM_API_KEY:
    logger.error("❌ Deepgram API Key missing! Check .env file.")
else:
    logger.info(f"🔑 Deepgram Key Loaded: {DEEPGRAM_API_KEY[:4]}...{DEEPGRAM_API_KEY[-4:]}")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("🟢 Supabase Admin Client Connected")
else:
    logger.error("❌ Supabase URL or Service Key missing from .env!")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
if not stripe.api_key:
    logger.error("❌ Stripe Secret Key missing from .env!")


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

# --- ENDPOINTS ---

@app.post("/submit-context")
async def submit_context(
    user_id: str = Form(...),  # <--- NEW: Required to identify the user
    resume: UploadFile = File(...), 
    job_description: str = Form(default="")
):
    try:
        # 1. Get the specific brain for THIS user
        user_brain = get_brain_for_user(user_id)

        # 2. Process the file
        content = await resume.read()
        resume_text = extract_text_from_file(content, resume.filename)
        
        # 3. Save to THEIR specific brain
        user_brain.set_context(resume_text, job_description)
        
        logger.info(f"✅ Context updated for User {user_id}. Resume length: {len(resume_text)}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        return {"status": "error", "message": str(e)}

class CheckoutRequest(BaseModel):
    token: str
    return_url: str

@app.post("/create-checkout-session")
async def create_checkout_session(req: CheckoutRequest):
    try:
        user_res = await asyncio.to_thread(supabase.auth.get_user, req.token)
        user_id = user_res.user.id
        user_email = user_res.user.email

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': 'price_1T4pnAEFLEZAHwelrTvPR1Os', # <--- Ensure this is your Live Price ID
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
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        return {"error": "Invalid payload"}, 400
    except stripe.error.SignatureVerificationError as e:
        return {"error": "Invalid signature"}, 400

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id') 

        if user_id:
            logger.info(f"💰 Payment success for {user_id}. Adding 60 mins.")
            try:
                # Add 60 minutes logic
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

# --- WEBSOCKET: THE BRIDGE ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    await websocket.accept()
    logger.info("🚀 NEW CONNECTION ATTEMPT")

    if not token:
        logger.error("❌ No token provided. Closing.")
        await websocket.close(code=1008)
        return

    loop = asyncio.get_event_loop()

    # --- 1. AUTH & SESSION SETUP ---
    try:
        user_res = await asyncio.to_thread(supabase.auth.get_user, token)
        user_id = user_res.user.id

        # LOAD THE CORRECT BRAIN FOR THIS USER
        current_brain = get_brain_for_user(user_id)

        # Check credits
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

    # --- 2. BACKGROUND CREDIT TASK ---
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

    # --- 3. DEEPGRAM SETUP ---
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
    
    # --- 4. AI LOGIC (USING USER'S BRAIN) ---
    async def trigger_ai_response(text):
        if len(text.strip()) < 2: return

        logger.info(f"🚀 AI Triggered for {user_id}: '{text[:30]}...'")
        await websocket.send_json({"event": "ai_start"})
        
        # USE THE USER-SPECIFIC BRAIN HERE
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

    # --- 5. EVENT HANDLERS ---
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

    # --- 6. KEEP-ALIVE LOOP ---
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