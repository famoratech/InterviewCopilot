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
        
        # --- THE SAFETY VALVE (Sliding Window) ---
        # Keep only the last 10 exchanges (20 messages total)
        # This prevents the context window from overflowing during long interviews
        if len(self.history) > 20:
            self.history = self.history[-20:]





