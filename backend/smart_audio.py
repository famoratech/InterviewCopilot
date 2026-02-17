import torch
import numpy as np
import sounddevice as sd
import time

# Load pre-trained VAD model (downloads automatically once)
model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad',
                              model='silero_vad',
                              force_reload=False)
(get_speech_timestamps, _, read_audio, VADIterator, collect_chunks) = utils

class SmartAudioBuffer:
    def __init__(self, sample_rate=16000):
        self.sample_rate = sample_rate
        self.vad_iterator = VADIterator(model)
        self.buffer = []
        self.speaking = False
        self.silence_start = None
        self.SPEECH_CONFIDENCE = 0.5
        self.PAUSE_THRESHOLD = 1.5 # Seconds of silence before we assume sentence ended

    def process_frame(self, audio_frame: np.ndarray):
        """
        Returns: None (still listening), or bytes (complete sentence audio)
        """
        # Convert numpy frame to torch tensor
        tensor = torch.from_numpy(audio_frame)
        
        # Get speech probability
        speech_prob = model(tensor, self.sample_rate).item()
        
        if speech_prob > self.SPEECH_CONFIDENCE:
            # SPEECH DETECTED
            self.speaking = True
            self.silence_start = None
            self.buffer.append(audio_frame)
            return None
            
        elif self.speaking:
            # WE WERE SPEAKING, NOW IT IS QUIET
            if self.silence_start is None:
                self.silence_start = time.time()
                self.buffer.append(audio_frame) # Keep a bit of the silence for naturalness
            else:
                # Check how long it has been silent
                if time.time() - self.silence_start > self.PAUSE_THRESHOLD:
                    # SENTENCE COMPLETE!
                    full_audio = np.concatenate(self.buffer)
                    self.reset()
                    return full_audio
                else:
                    self.buffer.append(audio_frame)
            return None
            
        return None

    def reset(self):
        self.buffer = []
        self.speaking = False
        self.silence_start = None
        self.vad_iterator.reset_states()