"use client";

import { useRef, useState, useEffect } from "react";

// --- CONFIGURATION ---
// automatically use the right URL based on where the app is running
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// handling WebSocket protocol (ws:// for local, wss:// for secure cloud)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

type LogEntry = {
  type: "transcript" | "ai";
  text: string;
  pending?: string;
  timestamp: number;
  isStreaming?: boolean;
};

type AppStep = "setup" | "interview";

export default function LiveTranscript() {
  // --- STATE ---
  const [step, setStep] = useState<AppStep>("setup");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup Form State
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- STEP 1: SUBMIT CONTEXT ---
  const handleSubmitContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) {
      alert("Please upload a resume first.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("resume", resumeFile);
    formData.append("job_description", jobDescription);

    try {
      const response = await fetch(`${BACKEND_URL}/submit-context`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setStep("interview");
      } else {
        const errData = await response.json();
        setError(`Error: ${errData.message || "Failed to upload"}`);
      }
    } catch (err) {
      setError("Could not connect to backend. Is it running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- STEP 2: START INTERVIEW ---
  const startInterview = async () => {
    if (wsRef.current || isConnecting) return;
    setError(null);
    setIsConnecting(true);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        // @ts-ignore
        systemAudio: "include",
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        alert(
          "⚠️ No Audio Found! \n\nPlease restart and check the box 'Share system audio' in the bottom-left of the popup.",
        );
        stream.getTracks().forEach((t) => t.stop());
        setIsConnecting(false);
        return;
      }

      streamRef.current = stream;
      stream.getVideoTracks()[0].onended = stopInterview;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);

        const mediaRecorder = new MediaRecorder(new MediaStream([audioTrack]), {
          mimeType: "audio/webm",
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };
        mediaRecorder.start(250);
      };

      ws.onclose = () => cleanup();
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      };
    } catch (err) {
      console.error(err);
      setError("Failed to start recording.");
      setIsConnecting(false);
    }
  };

  // ✅ FIXED: IMMUTABLE STATE UPDATES
  const handleServerMessage = (data: any) => {
    setLogs((prev) => {
      // 1. Create a shallow copy of the array
      const newLogs = [...prev];
      const lastIndex = newLogs.length - 1;
      const lastLog = newLogs[lastIndex];

      if (data.event === "transcript") {
        const isUserBubble = lastLog?.type === "transcript";

        if (data.is_final) {
          if (isUserBubble) {
            // ✅ IMMUTABLE: Replace the object with a new one
            newLogs[lastIndex] = {
              ...lastLog,
              text: (lastLog.text ? lastLog.text + " " : "") + data.text,
              pending: "",
            };
            return newLogs;
          } else {
            // New Bubble
            return [
              ...prev,
              { type: "transcript", text: data.text, timestamp: Date.now() },
            ];
          }
        } else {
          // Partial (Interim)
          if (isUserBubble) {
            newLogs[lastIndex] = {
              ...lastLog,
              pending: " " + data.text,
            };
            return newLogs;
          } else {
            return [
              ...prev,
              {
                type: "transcript",
                text: "",
                pending: data.text,
                timestamp: Date.now(),
              },
            ];
          }
        }
      }

      if (data.event === "ai_start") {
        return [
          ...prev,
          { type: "ai", text: "", timestamp: Date.now(), isStreaming: true },
        ];
      }

      if (data.event === "ai_chunk" && lastLog?.type === "ai") {
        // ✅ IMMUTABLE: Replace the object
        newLogs[lastIndex] = {
          ...lastLog,
          text: lastLog.text + data.text,
        };
        return newLogs;
      }

      if (data.event === "ai_done" && lastLog?.type === "ai") {
        newLogs[lastIndex] = {
          ...lastLog,
          isStreaming: false,
        };
        return newLogs;
      }

      return prev;
    });
  };

  const cleanup = () => {
    setIsConnected(false);
    setIsConnecting(false);
    wsRef.current = null;
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const stopInterview = () => {
    wsRef.current?.send(JSON.stringify({ text: "stop" }));
    wsRef.current?.close();
    cleanup();
  };

  // --- RENDER ---
  if (step === "setup") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg border w-full max-w-lg">
          <h1 className="text-2xl font-bold mb-2">Interview Setup</h1>
          <p className="text-gray-500 mb-6 text-sm">
            Upload your resume so the AI can answer questions about your
            experience.
          </p>

          <form onSubmit={handleSubmitContext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Resume (PDF, DOCX, TXT) *
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Description (Optional)
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                className="w-full p-3 border rounded-lg h-32 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Continue to Interview"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto h-[85vh] p-4 font-sans">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
        <div>
          <h2 className="font-bold text-gray-800">Live Interview Copilot</h2>
          <div className="flex items-center gap-2 mt-1">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
            />
            <p className="text-xs text-gray-500 font-medium">
              {isConnected ? "Listening for questions..." : "Ready to connect"}
            </p>
          </div>
        </div>

        {!isConnected ? (
          <button
            onClick={startInterview}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold shadow-md transition"
          >
            {isConnecting ? "Connecting..." : "Start Interview"}
          </button>
        ) : (
          <button
            onClick={stopInterview}
            className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-6 py-2 rounded-lg font-semibold transition"
          >
            Stop
          </button>
        )}
      </div>

      {!isConnected && !isConnecting && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 shadow-sm">
          <strong>How to use:</strong>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              Click <b>Start Interview</b>.
            </li>
            <li>
              Select the <b>Tab</b> with the audio.
            </li>
            <li>
              <span className="bg-yellow-200 px-1 rounded text-black font-bold">
                IMPORTANT:
              </span>
              Check <b>"Share system audio"</b>.
            </li>
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 p-6 space-y-6 shadow-inner relative">
        {logs.length === 0 && isConnected && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <p>Waiting for the interviewer to speak...</p>
          </div>
        )}

        {logs.map((log, i) => (
          <div
            key={i}
            className={`flex flex-col max-w-[85%] ${
              log.type === "transcript"
                ? "self-end items-end"
                : "self-start items-start"
            }`}
          >
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">
              {log.type === "transcript" ? "Interviewer" : "AI Copilot"}
            </span>
            <div
              className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                log.type === "transcript"
                  ? "bg-blue-600 text-white rounded-tr-none"
                  : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
              }`}
            >
              <span>{log.text}</span>
              {log.pending && (
                <span className="opacity-70 italic">{log.pending}</span>
              )}
              {log.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-blue-400 ml-1 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
