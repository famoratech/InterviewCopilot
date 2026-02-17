# # backend/core/llm.py

# import os
# from openai import AsyncOpenAI # ✅ MUST BE ASYNC
# from dotenv import load_dotenv

# load_dotenv()

# # Initialize Async Client
# client = AsyncOpenAI(
#     base_url="https://openrouter.ai/api/v1",
#     api_key=os.getenv("OPENROUTER_API_KEY"),
# )

# async def stream_completion(messages, model="meta-llama/llama-3.1-8b-instruct"):
#     """
#     Streams AI response without blocking the server event loop.
#     """
#     try:
#         completion = await client.chat.completions.create(
#             extra_headers={
#                 "HTTP-Referer": "http://localhost:3000",
#                 "X-Title": "InterviewHelp",
#             },
#             model=model,
#             messages=messages,
#             stream=True,
#         )

#         async for chunk in completion:
#             content = chunk.choices[0].delta.content
#             if content:
#                 yield content

#     except Exception as e:
#         yield f" [AI Error: {str(e)}]"

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Initialize Groq Client
# It automatically looks for GROQ_API_KEY in environment variables
client = Groq()

async def stream_completion(messages):
    """
    Streams the response from Groq's LPU (Language Processing Unit).
    """
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile", # The current best/fastest model
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
        yield f"Error generating response: {str(e)}"