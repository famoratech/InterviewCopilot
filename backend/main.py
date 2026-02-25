import os
import logging
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# --- NEW: SUPABASE ---
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

@app.get("/debug-env")
async def debug_env():
    import os
    return {
        "SUPABASE_URL_EXISTS": bool(os.getenv("SUPABASE_URL")),
        "SUPABASE_URL_LENGTH": len(os.getenv("SUPABASE_URL")) if os.getenv("SUPABASE_URL") else 0,
        "SUPABASE_KEY_EXISTS": bool(os.getenv("SUPABASE_SERVICE_KEY")),
        "STRIPE_EXISTS": bool(os.getenv("STRIPE_SECRET_KEY")),
        "DEEPGRAM_EXISTS": bool(os.getenv("DEEPGRAM_API_KEY")),
        "GHOST_KEYS_FOUND": [k for k in os.environ.keys() if "SUPA" in k or "STRIPE" in k]
    }
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL STATE ---
global_brain = Brain()
raw_api_key = os.getenv("DEEPGRAM_API_KEY")
DEEPGRAM_API_KEY = raw_api_key.strip() if raw_api_key else None

if not DEEPGRAM_API_KEY:
    logger.error("❌ Deepgram API Key missing! Check .env file.")
else:
    logger.info(f"🔑 Deepgram Key Loaded: {DEEPGRAM_API_KEY[:4]}...{DEEPGRAM_API_KEY[-4:]}")

# --- NEW: INITIALIZE SUPABASE ADMIN ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("🟢 Supabase Admin Client Connected")
else:
    logger.error("❌ Supabase URL or Service Key missing from .env!")


# --- NEW: INITIALIZE STRIPE ---
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
if not stripe.api_key:
    logger.error("❌ Stripe Secret Key missing from .env!")


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

@app.post("/submit-context")
async def submit_context(
    resume: UploadFile = File(...), 
    job_description: str = Form(default="")
):
    try:
        content = await resume.read()
        resume_text = extract_text_from_file(content, resume.filename)
        global_brain.set_context(resume_text, job_description)
        logger.info(f"✅ Brain Loaded: Resume ({len(resume_text)} chars)")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        return {"status": "error", "message": str(e)}
    


# --- NEW: STRIPE CHECKOUT ---
class CheckoutRequest(BaseModel):
    token: str
    return_url: str

@app.post("/create-checkout-session")
async def create_checkout_session(req: CheckoutRequest):
    try:
        # 1. Verify the user so we know who is trying to buy credits
        user_res = await asyncio.to_thread(supabase.auth.get_user, req.token)
        user_id = user_res.user.id
        user_email = user_res.user.email

        # 2. Tell Stripe to create a secure checkout page
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': 'price_1T487oEFLEZAHwelyaBQmwMA', # <--- PASTE YOUR PRICE ID HERE
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{req.return_url}/?success=true",
            cancel_url=f"{req.return_url}/?canceled=true",
            customer_email=user_email,
            # CRITICAL: We attach the user_id so we know who to credit later!
            client_reference_id=user_id, 
        )
        
        return {"url": session.url}
    except Exception as e:
        logger.error(f"Stripe error: {str(e)}")
        return {"error": str(e)}

# --- NEW: STRIPE WEBHOOK ---
@app.post("/webhook")
async def stripe_webhook(request: Request):
    # Stripe requires the raw body to verify the request is authentically from them
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET") # We will get this in the next step!

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        logger.error("Invalid payload")
        return {"error": "Invalid payload"}, 400
    except stripe.error.SignatureVerificationError as e:
        logger.error("Invalid signature")
        return {"error": "Invalid signature"}, 400

    # If the payment was successful...
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        # Remember when we attached the user_id as client_reference_id? Here it is!
        user_id = session.get('client_reference_id') 

        if user_id:
            logger.info(f"💰 Payment successful for user: {user_id}. Adding 60 minutes...")
            
            try:
                # 1. Get their current balance
                curr_res = await asyncio.to_thread(
                    lambda: supabase.table("user_credits").select("balance_minutes").eq("user_id", user_id).single().execute()
                )
                curr_bal = curr_res.data.get("balance_minutes", 0)

                # 2. Add 60 minutes
                new_bal = curr_bal + 60

                # 3. Save it to the database
                await asyncio.to_thread(
                    lambda: supabase.table("user_credits").update({"balance_minutes": new_bal}).eq("user_id", user_id).execute()
                )
                logger.info(f"✅ Account updated! New balance: {new_bal} minutes.")
            except Exception as e:
                logger.error(f"❌ Failed to update Supabase: {e}")

    return {"status": "success"}

# --- WEBSOCKET: THE BRIDGE ---
# Notice we added `token: str = None` so FastAPI catches it from the URL
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    await websocket.accept()
    logger.info("🚀 SERVER V26.0 (CREDIT SYSTEM) - CONNECTED")

    if not token:
        logger.error("❌ No token provided. Rejecting connection.")
        await websocket.close(code=1008)
        return

    loop = asyncio.get_event_loop()

    # --- NEW: VERIFY USER AND CHECK CREDITS ---
    try:
        # Get the user ID from the token
        user_res = await asyncio.to_thread(supabase.auth.get_user, token)
        user_id = user_res.user.id

        # Check initial balance
        credit_res = await asyncio.to_thread(
            lambda: supabase.table("user_credits").select("balance_minutes").eq("user_id", user_id).single().execute()
        )
        balance = credit_res.data.get("balance_minutes", 0)

        if balance <= 0:
            logger.info(f"User {user_id} has 0 credits. Booting them out.")
            await websocket.send_json({"event": "out_of_credits"})
            await websocket.close()
            return

        logger.info(f"✅ Authorized User: {user_id} | Balance: {balance} min")

    except Exception as e:
        logger.error(f"❌ Auth/Database Error: {e}")
        await websocket.close(code=1008)
        return


    # --- NEW: BACKGROUND CREDIT COUNTDOWN TASK ---
    countdown_active = True

    async def credit_countdown():
        while countdown_active:
            await asyncio.sleep(60) # Wait exactly 1 minute
            if not countdown_active:
                break
            
            try:
                # Deduct 1 minute in the database
                curr_res = await asyncio.to_thread(
                    lambda: supabase.table("user_credits").select("balance_minutes").eq("user_id", user_id).single().execute()
                )
                curr_bal = curr_res.data.get("balance_minutes", 0)

                if curr_bal > 0:
                    new_bal = curr_bal - 1
                    await asyncio.to_thread(
                        lambda: supabase.table("user_credits").update({"balance_minutes": new_bal}).eq("user_id", user_id).execute()
                    )
                    logger.info(f"⏳ Deducted 1 min from {user_id}. Remaining: {new_bal}")

                    # --- NEW: TELL REACT THE NEW BALANCE ---
                    await websocket.send_json({"event": "credit_update", "balance": new_bal})

                    # If they just hit 0, trigger the paywall!
                    if new_bal <= 0:
                        logger.info("🚨 User ran out of time! Sending out_of_credits event.")
                        await websocket.send_json({"event": "out_of_credits"})
                        await websocket.close()
                        break
            except Exception as e:
                logger.error(f"⚠️ Countdown loop error: {e}")

    # Start the timer parallel to the audio processing!
    countdown_task = asyncio.create_task(credit_countdown())


    # 1. Initialize Deepgram
    try:
        config = DeepgramClientOptions(url="api.deepgram.com", verbose=logging.WARNING)
        deepgram = DeepgramClient(DEEPGRAM_API_KEY, config)
        dg_connection = deepgram.listen.live.v("1")
    except Exception as e:
        logger.error(f"Deepgram Init Failed: {e}")
        countdown_task.cancel()
        await websocket.close()
        return

    # State
    transcript_buffer = [] 
    
    # 2. AI Logic
    async def trigger_ai_response(text):
        if len(text.strip()) < 2: return # Only ignore total noise

        logger.info(f"🚀 AI Executing on: '{text[:40]}...'")
        await websocket.send_json({"event": "ai_start"})
        
        system_prompt = global_brain.build_system_prompt()
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(global_brain.history)
        messages.append({"role": "user", "content": text})

        full_answer = ""
        try:
            async for chunk in stream_completion(messages):
                full_answer += chunk
                await websocket.send_json({"event": "ai_chunk", "text": chunk})
            
            global_brain.add_interaction(text, full_answer)
            await websocket.send_json({"event": "ai_done"})
        except Exception as e:
            logger.error(f"AI Error: {e}")
            await websocket.send_json({"event": "ai_done"})

    # 3. Handlers
    def on_message(self, result, **kwargs):
        sentence = result.channel.alternatives[0].transcript
        
        if len(sentence) > 0:
            is_final = result.is_final
            
            asyncio.run_coroutine_threadsafe(
                websocket.send_json({
                    "event": "transcript",
                    "text": sentence,
                    "is_final": is_final
                }), loop
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
                logger.info(f"⚡ Utterance End (Silence) -> Triggering AI")
                transcript_buffer.clear()
                asyncio.run_coroutine_threadsafe(trigger_ai_response(full_text), loop)

    def on_error(self, error, **kwargs):
        logger.error(f"Deepgram Error: {error}")

    dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
    dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)
    dg_connection.on(LiveTranscriptionEvents.Error, on_error)

    # 4. Connect
    options = LiveOptions(
        model="nova-2",
        language="en-US",
        smart_format=True,
        interim_results=True,
        utterance_end_ms="2500",
        vad_events=True,
    )
    
    if dg_connection.start(options) is False:
        logger.error("Failed to connect to Deepgram")
        countdown_task.cancel()
        await websocket.close()
        return

    # 5. Loop
    try:
        packet_count = 0
        while True:
            message = await websocket.receive()
            if "bytes" in message:
                packet_count += 1
                dg_connection.send(message["bytes"])
                
                if packet_count % 50 == 0:
                    print(f"📦 Bytes flowing... ({packet_count})", end="\r")

            if "text" in message:
                msg = json.loads(message["text"])
                if msg.get("text") == "stop": break

    except WebSocketDisconnect:
        logger.info("🔴 Client Disconnected")
    finally:
        # --- NEW: CLEANUP ---
        # Make sure we stop the countdown when the user closes the tab
        countdown_active = False 
        countdown_task.cancel()
        dg_connection.finish()