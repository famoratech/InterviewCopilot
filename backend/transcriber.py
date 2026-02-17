# interviewhelp/backend/transcriber.py
from faster_whisper import WhisperModel
import numpy as np
import tempfile
import soundfile as sf
import logging

logger = logging.getLogger("stt-backend")

model = WhisperModel(
    "base",
    device="cpu",       # auto-safe (no GPU crashes)
    compute_type="int8" # fast + stable
)

def transcribe_audio(audio: np.ndarray, sample_rate: int = 16000) -> str:
    if len(audio) == 0:
        return ""

    with tempfile.NamedTemporaryFile(suffix=".wav") as f:
        sf.write(f.name, audio, sample_rate)

        segments, _ = model.transcribe(
            f.name,
            vad_filter=True,
        )

        text = " ".join(seg.text.strip() for seg in segments)

    logger.info(f"📝 Transcript: {text}")
    return text
