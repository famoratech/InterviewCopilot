import os
import logging
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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

load_dotenv()

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
logger = logging.getLogger("backend")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all domains (like your Vercel URL) to connect
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

# --- HELPER: FILE PARSER ---
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

# --- API: RESUME UPLOAD ---
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

# --- WEBSOCKET: THE BRIDGE ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("🚀 SERVER V25.5 (SENSITIVITY FIX) - CONNECTED")

    loop = asyncio.get_event_loop()

    # 1. Initialize Deepgram
    try:
        config = DeepgramClientOptions(url="api.deepgram.com", verbose=logging.WARNING)
        deepgram = DeepgramClient(DEEPGRAM_API_KEY, config)
        dg_connection = deepgram.listen.live.v("1")
    except Exception as e:
        logger.error(f"Deepgram Init Failed: {e}")
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
            
            # Send to Frontend
            asyncio.run_coroutine_threadsafe(
                websocket.send_json({
                    "event": "transcript",
                    "text": sentence,
                    "is_final": is_final
                }), loop
            )
            
            if is_final:
                transcript_buffer.append(sentence)
                # Fast Trigger for Questions
                if sentence.strip().endswith("?"):
                    full_text = " ".join(transcript_buffer)
                    transcript_buffer.clear()
                    asyncio.run_coroutine_threadsafe(trigger_ai_response(full_text), loop)

    def on_utterance_end(self, utterance_end, **kwargs):
        if len(transcript_buffer) > 0:
            full_text = " ".join(transcript_buffer)
            # ✅ FIX: Lower threshold from 4 to 2 words
            if len(full_text.split()) >= 2:
                logger.info(f"⚡ Utterance End (Silence) -> Triggering AI")
                transcript_buffer.clear()
                asyncio.run_coroutine_threadsafe(trigger_ai_response(full_text), loop)

    def on_error(self, error, **kwargs):
        logger.error(f"Deepgram Error: {error}")

    dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
    dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)
    dg_connection.on(LiveTranscriptionEvents.Error, on_error)

    # 4. Connect (AUTO-DETECT MODE)
    options = LiveOptions(
        model="nova-2",
        language="en-US",
        smart_format=True,
        interim_results=True,
        utterance_end_ms="2500",  # Increased silence threshold to 2 seconds for better sensitivity.
        vad_events=True,
    )
    
    if dg_connection.start(options) is False:
        logger.error("Failed to connect to Deepgram")
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
        dg_connection.finish()