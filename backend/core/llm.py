import os
import logging
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Setup Logging
logger = logging.getLogger("backend")

# Initialize Groq Client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# The Best Model (Now powered by your credit card)
MODEL_NAME = "llama-3.3-70b-versatile"

async def stream_completion(messages):
    """
    Streams response from Groq.
    """
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=0.6,
            max_tokens=1024,
            top_p=1,
            stream=True,
            stop=None,
        )

        for chunk in completion:
            content = chunk.choices[0].delta.content
            if content:
                yield content

    except Exception as e:
        # Log the error so you can see it in your terminal
        logger.error(f"❌ Groq Error: {str(e)}")
        
        # Send a user-friendly message to the frontend
        yield f" [AI Connection Error: {str(e)}]"