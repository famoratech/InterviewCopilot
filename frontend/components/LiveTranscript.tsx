"use client";

import { useRef, useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // <-- ADD THIS

// --- CONFIGURATION ---
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
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
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Setup Form State
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // --- NEW: FORMAT SECONDS TO MM:SS ---
  const formatTime = (totalSeconds: number | null) => {
    if (totalSeconds === null) return "0:00";
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // --- NEW: LOCAL TICKER ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    // Only tick down if we are actively connected to the interview
    if (isConnected) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 0) return prev;
          return prev - 1; // Deduct 1 second locally
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  // Auto-scroll
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    const fetchCredits = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("user_credits")
        .select("balance_minutes")
        .eq("user_id", session.user.id)
        .single();

      if (data) {
        setTimeRemaining(data.balance_minutes * 60); // Multiply by 60!
      }
    };

    fetchCredits();
  }, []);

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

      // Grab the current user's session token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("You must be logged in to start an interview.");
        setIsConnecting(false);
        return;
      }

      // Attach the token securely to the WebSocket URL
      const wsUrlWithToken = `${WS_URL}?token=${session.access_token}`;
      const ws = new WebSocket(wsUrlWithToken);
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

  const handleServerMessage = (data: any) => {
    if (data.event === "out_of_credits") {
      stopInterview();
      setShowUpgradeModal(true);
      setTimeRemaining(0);
      return;
    }

    if (data.event === "credit_update") {
      // Sync the local stopwatch with the official database balance
      setTimeRemaining(data.balance * 60);
      return;
    }

    setLogs((prev) => {
      const newLogs = [...prev];
      const lastIndex = newLogs.length - 1;
      const lastLog = newLogs[lastIndex];

      if (data.event === "transcript") {
        const isUserBubble = lastLog?.type === "transcript";

        if (data.is_final) {
          if (isUserBubble) {
            newLogs[lastIndex] = {
              ...lastLog,
              text: (lastLog.text ? lastLog.text + " " : "") + data.text,
              pending: "",
            };
            return newLogs;
          } else {
            return [
              ...prev,
              { type: "transcript", text: data.text, timestamp: Date.now() },
            ];
          }
        } else {
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

  // --- NEW: STRIPE CHECKOUT HANDLER ---
  const handleUpgrade = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${BACKEND_URL}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: session.access_token,
          return_url: window.location.origin, // Sends them back to wherever they are currently (localhost or live site)
        }),
      });

      const data = await response.json();
      if (data.url) {
        // Redirect the user to Stripe's secure checkout page!
        window.location.href = data.url;
      } else {
        alert("Failed to start checkout. Please try again.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
    }
  };

  // --- RENDER (STEP 1: SETUP) ---
  if (step === "setup") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
              Interview Copilot
            </h1>

            <div className="flex items-center justify-center gap-2 mt-3">
              {timeRemaining !== null && (
                <span
                  className={`text-sm font-bold px-3 py-1.5 rounded-lg border shadow-sm transition-colors ${timeRemaining > 780 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-red-50 text-red-700 border-red-200"}`}
                >
                  ⏳ {formatTime(timeRemaining)} left
                </span>
              )}
              {/* --- NEW: PERSISTENT TOP UP BUTTON --- */}
              <button
                type="button"
                onClick={handleUpgrade}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm ${timeRemaining !== null && timeRemaining < 300 ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" : "bg-gray-900 hover:bg-gray-800 text-white"}`}
              >
                + Add Time
              </button>
            </div>

            <p className="text-gray-500 text-sm mt-4">
              Upload your context to get started.
            </p>
          </div>

          <form onSubmit={handleSubmitContext} className="space-y-5">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                1. Upload Resume
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition cursor-pointer"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                2. Job Description (Optional)
              </label>
              <p className="text-sm text-gray-500 mb-2 italic">
                💡 <span className="font-semibold">Pro Tip:</span> Paste the job
                description AND the company's "About Us" page here. This trains
                your AI to help you answer questions related to the
                organisation.
              </p>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description and company info here..."
                className="w-full p-4 border border-gray-200 rounded-xl h-32 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none shadow-sm"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 shadow-md mt-4"
            >
              {isSubmitting ? "Processing..." : "Submit Context"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER (STEP 2: INTERVIEW) ---
  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto h-screen p-4 md:p-6 font-sans text-gray-800 bg-gray-50">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 z-10">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 hidden sm:block">
              Interview Copilot
            </h2>

            {/* --- TIMER BADGE --- */}
            {timeRemaining !== null && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-md border shadow-sm transition-colors ${timeRemaining > 780 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-red-50 text-red-700 border-red-200"}`}
              >
                ⏳ {formatTime(timeRemaining)}
              </span>
            )}

            {/* --- NEW: PERSISTENT TOP UP BUTTON --- */}
            <button
              onClick={handleUpgrade}
              className={`text-xs font-bold px-2.5 py-1 rounded-md transition-all shadow-sm ${timeRemaining !== null && timeRemaining < 300 ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" : "bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200"}`}
            >
              + Add Time
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1 h-4">
            {isConnected ? (
              // The moving equalizer bars
              <div className="flex items-end gap-[2px] h-3">
                <div className="w-1 bg-green-500 rounded-full animate-[bounce_1s_infinite_0ms] h-full"></div>
                <div className="w-1 bg-green-500 rounded-full animate-[bounce_1.2s_infinite_100ms] h-2/3"></div>
                <div className="w-1 bg-green-500 rounded-full animate-[bounce_0.9s_infinite_200ms] h-4/5"></div>
                <div className="w-1 bg-green-500 rounded-full animate-[bounce_1.1s_infinite_300ms] h-full"></div>
              </div>
            ) : (
              // The resting gray dot
              <div className="w-2 h-2 rounded-full bg-gray-300" />
            )}
            <p className="text-xs text-gray-500 font-medium">
              {isConnected
                ? "Listening to interview tab..."
                : "Ready to connect"}
            </p>
          </div>
        </div>

        {!isConnected ? (
          <button
            onClick={startInterview}
            disabled={isConnecting}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-md transition"
          >
            {isConnecting ? "Connecting..." : "Start Interview"}
          </button>
        ) : (
          <button
            onClick={stopInterview}
            className="w-full sm:w-auto bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-8 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
          >
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
            Stop
          </button>
        )}
      </div>

      {!isConnected && !isConnecting && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 shadow-sm mb-4">
          <strong>How to use:</strong>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              Click <b>Start Interview</b>.
            </li>
            <li>
              Select the <b>Tab</b> with the meeting audio (e.g., Google Meet,
              Zoom web).
            </li>
            <li>
              <span className="bg-yellow-200 px-1 rounded text-black font-bold">
                IMPORTANT:
              </span>{" "}
              Check <b>"Share system audio"</b>.
            </li>
          </ul>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-200 p-4 md:p-8 space-y-6 shadow-sm relative">
        {logs.length === 0 && isConnected && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <span className="text-3xl block mb-2">🎙️</span>
              <p>Listening... speak into your microphone.</p>
            </div>
          </div>
        )}

        {logs.map((log, i) => (
          <div
            key={i}
            className={`flex flex-col w-full ${
              log.type === "transcript" ? "items-end" : "items-start"
            }`}
          >
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">
              {log.type === "transcript" ? "Interviewer" : "AI Copilot"}
            </span>
            <div
              className={`max-w-[90%] md:max-w-[75%] p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                log.type === "transcript"
                  ? "bg-blue-600 text-white rounded-tr-none"
                  : "bg-gray-100 text-gray-800 border border-gray-200 rounded-tl-none"
              }`}
            >
              <span>{log.text}</span>
              {log.pending && (
                <span className="opacity-70 italic">{log.pending}</span>
              )}
              {log.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-blue-400 ml-1.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}
        {/* Invisible element to auto-scroll to */}
        <div ref={logsEndRef} className="h-4" />
      </div>
      {/* --- NEW UPGRADE MODAL --- */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Out of Free Minutes!
            </h2>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              You've used up your 15 free minutes. Upgrade your account to
              continue crushing your interviews with real-time AI assistance.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleUpgrade}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-md flex justify-center items-center gap-2"
              >
                <span>Buy 2 Hours</span>
                <span className="bg-blue-800 text-blue-100 text-xs px-2 py-0.5 rounded">
                  Popular
                </span>
              </button>

              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold py-3.5 rounded-xl transition"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
