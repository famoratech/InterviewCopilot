# import logging

# logger = logging.getLogger("backend")

# class Brain:
#     def __init__(self):
#         # Stores the conversation history (User + AI)
#         self.history = []
#         # Limit context to keep things fast (last 10 exchanges)
#         self.max_history = 10 

#     def build_system_prompt(self):
#         """
#         Defines the AI Persona.
#         """
#         return (
#             "You are an expert technical interviewer for a Senior Software Engineer role. "
#             "Your goal is to assess the candidate's depth of knowledge, problem-solving skills, and communication. "
#             "1. Keep your responses concise (under 3 sentences) unless explaining a complex concept. "
#             "2. Be conversational but professional. "
#             "3. Ask one follow-up question at a time. "
#             "4. If the user's audio was cut off or unclear, politely ask them to repeat. "
#             "5. Do not simply agree; challenge their assumptions gently to test their confidence."
#         )

#     def add_interaction(self, user_text, ai_text):
#         """
#         Saves the turn to history so the AI remembers context.
#         """
#         self.history.append({"role": "user", "content": user_text})
#         self.history.append({"role": "assistant", "content": ai_text})
        
#         # Trim history if it gets too huge (Prevent 400 Bad Request from too much text)
#         if len(self.history) > self.max_history * 2:
#             self.history = self.history[-(self.max_history * 2):]
#             logger.info("✂️ Trimming conversation history to maintain context window.")

#     def clear_history(self):
#         self.history = []


import logging

class Brain:
    def __init__(self):
        # Conversation History
        self.history = []
        
        # Context (The "Knowledge")
        self.resume = ""
        self.job_description = ""
        
        # Default Prompt
        self.default_system_prompt = """
        You are an elite, real-time AI Interview Copilot. 
Your job is to listen to the live interview and instantly provide the candidate with brilliant, highly relevant answers.
        
        RULES:
        1. Keep answers conversational and concise (under 4 sentences if possible).
        2. Do not use buzzwords; use specific technologies they know.
        3. If the interviewer asks a question, answer it directly.
        4. If the interviewer introduces themselves, acknowledge it politely.
        5. BE THE STRATEGIST: Don't just answer the question; tell them *why* they are a fit. Map their past experience directly to the job requirements.
6. THE "WHY US" TRAP: If the interviewer asks "What do you know about us?", "Why do you want to work here?", or asks about the company culture, aggressively pull specific facts, values, and keywords directly from the Job Description below.
        """

    def set_context(self, resume_text, job_text):
        """Save the uploaded resume and job description."""
        self.resume = resume_text
        self.job_description = job_text
        # Clear history when context changes (New Interview)
        self.history = [] 

    def build_system_prompt(self):
        """Create a prompt that includes the Resume and Job context."""
        
        # Start with the base instructions
        prompt = self.default_system_prompt
        
        # Add Resume Context if available
        if self.resume:
            prompt += f"\n\nCANDIDATE RESUME:\n{self.resume}"
            
        # Add Job Context if available
        if self.job_description:
            prompt += f"\n\nJOB DESCRIPTION:\n{self.job_description}"
            
        # Add Final Instruction
        prompt += "\n\nINSTRUCTION: Using the candidate's resume above, formulate the best possible answer to the interviewer's question."
        
        return prompt

    def add_interaction(self, user_text, ai_text):
        self.history.append({"role": "user", "content": user_text})
        self.history.append({"role": "assistant", "content": ai_text})
        
        # Keep history short (last 10 turns) to save tokens
        if len(self.history) > 20:
            self.history = self.history[-20:]










