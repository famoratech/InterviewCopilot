import sounddevice as sd
import numpy as np
import time
from core.vad import VADAudioProcessor
from core.transcription import Transcriber

def test():
    print("🎤 Recording 5 seconds of audio... (Please speak now!)")
    
    # 1. Capture 5 seconds of raw audio
    recording = sd.rec(int(5 * 16000), samplerate=16000, channels=1, dtype='float32')
    
    # Show a countdown
    for i in range(5, 0, -1):
        print(f" {i}...", end="", flush=True)
        time.sleep(1)
    sd.wait()
    print("\n✅ Recording complete.")
    
    # 2. Feed it into VAD (Simulating the server loop)
    print("⚙️  Running VAD Processor...")
    vad = VADAudioProcessor()
    
    # Feed data in chunks like the server does
    for i in range(0, len(recording), 512):
        chunk = recording[i:i+512].flatten()
        vad.process(chunk)
    
    # 3. Check VAD Buffer
    buffer = vad.get_current_audio()
    buffer_len = len(buffer) if buffer is not None else 0
    print(f"📊 VAD Buffer Size: {buffer_len} samples")
    
    if buffer_len < 1000:
        print("❌ CRITICAL FAIL: VAD is not accumulating audio.")
        print("   -> Check 'backend/core/vad.py' indentation.")
        return

    # 4. Transcribe
    print("📝 Transcribing with Whisper...")
    transcriber = Transcriber()
    text = transcriber.transcribe(buffer)
    
    print("-" * 30)
    print(f"RESULT: '{text}'")
    print("-" * 30)

if __name__ == "__main__":
    test()