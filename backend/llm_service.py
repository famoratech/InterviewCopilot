import os
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

# Load env variables
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

# Global Storage
RESUME_CONTEXT = ""
CHAT_HISTORY = []  # Stores {"role": "user"|"assistant", "content": "..."}

def set_resume_context(text: str):
    global RESUME_CONTEXT
    RESUME_CONTEXT = text

def reset_chat_history():
    """Clears history for a new interview session"""
    global CHAT_HISTORY
    CHAT_HISTORY = []

def generate_smart_prompt(resume_text, user_settings, current_transcript, chat_history):
    # 1. Identify Context (This could be a separate mini-LLM call, but we'll do prompt engineering)
    
    system_prompt = f"""
    You are an AI Interview Coach acting as the candidate. 
    
    ### YOUR PROFILE (RESUME):
    {resume_text}

    ### CANDIDATE PERSONALITY:
    {user_settings.get('about_me', 'Professional, eager, and concise.')}

    ### INSTRUCTIONS:
    1. ANALYZE the input: Is it a Technical Question, Behavioral Question, or Chit-Chat?
    2. IF CHIT-CHAT ("How are you?", "Can you hear me?"):
       - Answer politely and briefly. Do NOT mention the resume.
    3. IF PERSONAL ("What are your hobbies?"):
       - Answer based on the 'CANDIDATE PERSONALITY' section above.
    4. IF INTERVIEW QUESTION ("Tell me about X", "How do you handle Y"):
       - USE THE RESUME. Cite specific projects and years from the profile above.
       - Use the STAR method (Situation, Task, Action, Result).
    
    ### CONVERSATIONAL CONTEXT:
    The interviewer just said: "{current_transcript}"
    
    Based on the history, provide the best short response for the candidate to say.
    """
    
    return system_prompt

def stream_ai_response(current_transcript_buffer: str):
    """
    Sends the accumulated transcript to the AI.
    The AI analyzes if it needs to answer.
    """
    global CHAT_HISTORY

    # 1. Build the System Prompt
    system_prompt = (
        "You are an expert candidate assistant for a job interview. "
        "You are listening to the interviewer. "
        "Your goal is to suggest the best possible answer for the candidate to say. "
        "Be concise, professional, and confident. "
        "Do NOT respond if the input is just phatic communication (like 'hmm', 'okay', 'right'). "
        "Only respond if there is a question or a topic that needs a response."
    )

    if RESUME_CONTEXT:
        system_prompt += f"\n\nCONTEXT (CANDIDATE RESUME):\n{RESUME_CONTEXT}"

    # 2. Prepare Messages (System + History + Current Input)
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add previous context (limited to last 6 turns to save tokens)
    messages.extend(CHAT_HISTORY[-6:]) 
    
    # Add the current accumulated speech from interviewer
    messages.append({"role": "user", "content": current_transcript_buffer})

    try:
        completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "InterviewHelp",
            },
            model="google/gemini-2.0-flash-exp:free", # Or "meta-llama/llama-3.3-70b-instruct:free"
            messages=messages,
            stream=True,
        )

        full_answer = ""
        for chunk in completion:
            content = chunk.choices[0].delta.content
            if content:
                full_answer += content
                yield content
        
        # 3. Save the interaction to history only after a successful response
        if full_answer.strip():
            CHAT_HISTORY.append({"role": "user", "content": current_transcript_buffer})
            CHAT_HISTORY.append({"role": "assistant", "content": full_answer})

    except Exception as e:
        yield f" [Error: {str(e)}]"