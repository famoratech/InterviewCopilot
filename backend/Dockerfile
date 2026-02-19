# Use a lightweight Python base image
FROM python:3.10-slim

# 1. Install System Dependencies (The Audio Drivers)
# We update apt, install portaudio + compiler (gcc), and clean up to keep image small
RUN apt-get update && apt-get install -y \
    portaudio19-dev \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Set up the working directory
WORKDIR /app

# 3. Copy only the requirements first (for better caching)
COPY requirements.txt .

# 4. Install Python Dependencies
# Upgrade pip first, then install requirements
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of the application code
COPY . .

# 6. Command to start the server
# We use the $PORT variable provided by Railway
CMD uvicorn main:app --host 0.0.0.0 --port $PORT