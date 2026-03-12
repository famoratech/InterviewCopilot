"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";

// Using local for testing, change to production URL later

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://interviewcopilot-production.up.railway.app";

type Message = {
  role: "assistant" | "user";
  content: string;
};

export default function MockCoach() {
  const [step, setStep] = useState<"setup" | "interview" | "score">("setup");

  // --- SETUP STATE ---
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetQuestions, setTargetQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">(
    "Medium",
  );
  const [extractedResume, setExtractedResume] = useState("");

  // --- INTERVIEW STATE ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentQuestionCount, setCurrentQuestionCount] = useState(0);
  const [scorecard, setScorecard] = useState("");

  // --- MONETIZATION STATE ---
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);

  // --- AUDIO STATE ---
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState(""); // Holds words as you speak them
  const recognitionRef = useRef<any>(null);
  const manualStopRef = useRef(false); // Tracks if the user clicked the stop button

  // 1. FETCH CREDITS ON LOAD
  useEffect(() => {
    const fetchCredits = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("user_credits")
        .select("balance_minutes")
        .eq("user_id", session.user.id)
        .single();
      if (data) setTimeRemaining(data.balance_minutes * 60); // Convert to seconds
    };
    fetchCredits();
  }, []);

  // 2. OFFICIAL DATABASE SYNC FUNCTION
  const syncTimeWithDatabase = async (minutesToDeduct: number) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;
      await fetch(`${BACKEND_URL}/sync-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session.user.id,
          minutes_to_deduct: minutesToDeduct,
        }),
      });
    } catch (error) {
      console.error("Failed to sync time", error);
    }
  };

  // 3. THE TICKER
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 0) return 0;
          const newTime = prev - 1;

          // Every time a full 60 seconds elapses, formally deduct 1 minute from the database
          if (newTime % 60 === 0 && prev !== newTime) {
            syncTimeWithDatabase(1);
          }
          return newTime;
        });
      }, 1000);
    }

    if (timeRemaining === 0 && isSessionActive) {
      setIsSessionActive(false);
      alert("Out of minutes! Please add more time to continue.");
    }

    return () => clearInterval(interval);
  }, [isSessionActive, timeRemaining]);

  // 4. "SMART" AUDIO SETUP (Continuous Listening)

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      // @ts-ignore
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true; // FAST MODE: Shows words instantly

      recognition.onresult = (event: any) => {
        let final = "";
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          // Append finalized sentences to the main input
          setInput(
            (prev) =>
              prev +
              (prev.length > 0 && !prev.endsWith(" ") ? " " : "") +
              final,
          );
        }
        // Update the temporary streaming text
        setInterimText(interim);
      };

      recognition.onend = () => {
        // If Chrome timed out, but the user DID NOT click the stop button, force it back on!
        if (!manualStopRef.current) {
          try {
            recognition.start();
          } catch (e) {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognition.onerror = (e: any) => {
        console.error("Speech error", e);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current)
      return alert("Browser does not support speech recognition. Use Chrome.");

    if (isListening) {
      manualStopRef.current = true; // Tell the app we INTENTIONALLY stopped it
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText("");
    } else {
      manualStopRef.current = false;
      try {
        recognitionRef.current.start();
      } catch (e) {}
      setIsListening(true);
    }
  };

  // 5. API HANDLERS
  const startInterview = async () => {
    if (!resumeFile && !resumeText.trim())
      return alert("Please provide a resume.");
    if (timeRemaining !== null && timeRemaining <= 0)
      return alert("You need at least 1 minute of credit.");

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // ADD THIS CHECK: Tell TypeScript we will stop if session is null
      if (!session) {
        alert("You must be logged in to start a session.");
        setLoading(false);
        return;
      }
      const formData = new FormData();
      formData.append("job_description", jobDescription);
      formData.append("difficulty", difficulty);
      formData.append("user_id", session.user.id);
      if (resumeFile) formData.append("resume_file", resumeFile);
      else formData.append("resume_text", resumeText);

      const res = await fetch(`${BACKEND_URL}/coach/start`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      setMessages([{ role: "assistant", content: data.message }]);
      setExtractedResume(data.extracted_resume);
      setCurrentQuestionCount(1);
      setStep("interview");
      setIsSessionActive(true);
    } catch (err) {
      alert("Failed to start coach.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    // If they only have interim text (they haven't paused yet), use that. Otherwise use main input.
    const finalInputToSend = input.trim() || interimText.trim();
    if (!finalInputToSend) return;

    // Stop mic automatically when sending
    manualStopRef.current = true;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    setInterimText("");

    const userMsg = { role: "user" as const, content: finalInputToSend };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      if (currentQuestionCount >= targetQuestions) {
        await generateFinalScore(newHistory);
      } else {
        const res = await fetch(`${BACKEND_URL}/coach/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: newHistory,
            job_description: jobDescription,
            difficulty: difficulty,
            user_answer: input,
            resume_text: extractedResume,
          }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message },
        ]);
        setCurrentQuestionCount((prev) => prev + 1);
      }
    } catch (err) {
      alert("Error processing answer.");
    } finally {
      setLoading(false);
    }
  };

  const generateFinalScore = async (finalHistory: Message[]) => {
    setIsSessionActive(false);
    try {
      const res = await fetch(`${BACKEND_URL}/coach/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: finalHistory,
          resume_text: extractedResume,
          job_description: jobDescription,
          user_answer: "",
          difficulty: difficulty,
        }),
      });
      const data = await res.json();
      setScorecard(data.message);
      setStep("score");
    } catch (err) {
      alert("Failed to generate score.");
    }
  };

  const handleUpgrade = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        alert("Please log in to add time.");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: session.access_token,
          return_url: window.location.origin,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to start checkout. Please try again.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
    }
  };

  const formatTime = (totalSeconds: number | null) => {
    if (totalSeconds === null) return "0:00";
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // 6. UI PARSER (Separates Feedback from the Next Question)
  // 6. UI PARSER (Guaranteed JSON from Backend)
  const renderAIMessage = (content: string) => {
    try {
      // 1. Try to parse the content as JSON
      const aiData = JSON.parse(content);

      // If it successfully parses, we know it's a structured reply
      if (aiData.rating || aiData.feedback || aiData.next_question) {
        return (
          <div className="flex flex-col gap-3 w-full animate-in fade-in duration-300">
            {/* The Analysis / Feedback Card */}
            {(aiData.rating || aiData.feedback) && (
              <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl shadow-sm">
                {aiData.rating && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-500">
                      Assessment:
                    </span>
                    <span
                      className={`text-sm font-bold px-2 py-0.5 rounded-md ${
                        aiData.rating.toLowerCase().includes("excellent") ||
                        aiData.rating.toLowerCase().includes("great")
                          ? "bg-green-100 text-green-700"
                          : aiData.rating.toLowerCase().includes("good")
                            ? "bg-blue-100 text-blue-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {aiData.rating}
                    </span>
                  </div>
                )}
                {aiData.feedback && (
                  <div className="text-sm text-purple-900 leading-relaxed">
                    <span className="font-semibold mr-1">Feedback:</span>
                    {aiData.feedback}
                  </div>
                )}
              </div>
            )}

            {/* The Next Question Bubble */}
            {aiData.next_question && (
              <div className="bg-white text-gray-800 p-4 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm text-[15px] leading-relaxed relative mt-2">
                <div className="absolute -top-2.5 left-4 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  Next Question
                </div>
                {aiData.next_question}
              </div>
            )}
          </div>
        );
      }
    } catch (e) {
      // 2. If JSON parsing fails (which means it's the FIRST question, which is just raw text)
      // Or if the AI somehow broke the JSON rule, we fallback to just showing the raw text.
      return (
        <div className="bg-white text-gray-800 p-4 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm text-[15px] leading-relaxed relative mt-2">
          <div className="absolute -top-2.5 left-4 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
            Coach
          </div>
          {content}
        </div>
      );
    }

    return null;
  };

  // --- RENDER SETUP ---
  if (step === "setup") {
    const isFileActive = resumeFile !== null;
    const isTextActive = resumeText.trim().length > 0;

    return (
      <div className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-gray-100 mt-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            AI Interview Coach
          </h1>
          {timeRemaining !== null && (
            <span
              className={`text-sm font-bold px-3 py-1.5 rounded-lg border shadow-sm ${timeRemaining > 300 ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-red-50 text-red-700 border-red-200"}`}
            >
              ⏳ {formatTime(timeRemaining)}
            </span>
          )}

          <button
            onClick={handleUpgrade}
            className={`text-xs font-bold px-2 py-1 rounded transition-all shadow-sm ${timeRemaining !== null && timeRemaining < 300 ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" : "bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200"}`}
          >
            + Add Time
          </button>
        </div>

        <div className="space-y-6">
          {/* UNIFIED RESUME INPUT (MUTUALLY EXCLUSIVE) */}
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              1. Provide Your Resume
            </label>
            <div className="space-y-4">
              <div
                className={`transition-opacity ${isTextActive ? "opacity-50 pointer-events-none" : "opacity-100"}`}
              >
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  disabled={isTextActive}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 transition cursor-pointer disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex items-center text-gray-400 text-xs font-bold uppercase tracking-wider">
                <hr className="flex-1 border-gray-300" />{" "}
                <span className="mx-2">OR PASTE TEXT</span>{" "}
                <hr className="flex-1 border-gray-300" />
              </div>

              <div
                className={`relative transition-opacity ${isFileActive ? "opacity-50" : "opacity-100"}`}
              >
                <textarea
                  className="w-full p-3 border border-gray-200 rounded-xl h-24 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder={
                    isFileActive
                      ? "Clear file selection to paste text."
                      : "Paste resume text here..."
                  }
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  disabled={isFileActive}
                />
                {isFileActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-gray-800/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                      File Uploaded
                    </span>
                  </div>
                )}
              </div>

              {(isFileActive || isTextActive) && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setResumeFile(null);
                      setResumeText("");
                    }}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold underline"
                  >
                    Clear Selection
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              2. Job Description (Optional)
            </label>
            <textarea
              className="w-full p-3 border border-gray-200 rounded-xl h-24 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Paste job description..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Session Length
              </label>
              <div className="flex flex-wrap gap-2">
                {[3, 5, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setTargetQuestions(num)}
                    className={`flex-1 min-w-[100px] py-2.5 rounded-lg text-sm font-semibold border transition ${targetQuestions === num ? "bg-purple-100 border-purple-500 text-purple-700 shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  >
                    {num} Questions
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Difficulty
              </label>
              <div className="flex flex-wrap gap-2">
                {["Easy", "Medium", "Hard"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level as any)}
                    className={`flex-1 min-w-[80px] py-2.5 rounded-lg text-sm font-semibold border transition ${difficulty === level ? (level === "Hard" ? "bg-red-50 border-red-500 text-red-700 shadow-sm" : "bg-purple-50 border-purple-500 text-purple-700 shadow-sm") : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={startInterview}
            disabled={loading || (!resumeFile && !resumeText)}
            className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50 mt-4 shadow-md flex justify-center items-center gap-2"
          >
            {loading ? "Preparing Coach..." : "Start Practice Session"}
            <span className="bg-purple-800 text-purple-100 text-xs px-2 py-0.5 rounded ml-2">
              Uses Minutes
            </span>
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER SCORECARD ---
  // --- RENDER SCORECARD ---
  if (step === "score") {
    let scoreData = {
      overall_score: 0,
      summary: "Error generating summary.",
      areas_of_improvement: [],
    };

    try {
      scoreData = JSON.parse(scorecard);
    } catch (e) {
      console.error("Failed to parse scorecard JSON", e);
    }

    const scoreColor =
      scoreData.overall_score >= 80
        ? "text-green-500"
        : scoreData.overall_score >= 60
          ? "text-yellow-500"
          : "text-red-500";
    const ringColor =
      scoreData.overall_score >= 80
        ? "ring-green-500"
        : scoreData.overall_score >= 60
          ? "ring-yellow-500"
          : "ring-red-500";
    const bgLightColor =
      scoreData.overall_score >= 80
        ? "bg-green-50"
        : scoreData.overall_score >= 60
          ? "bg-yellow-50"
          : "bg-red-50";

    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-3xl shadow-xl border border-gray-100 text-center mt-8 animate-in zoom-in duration-500">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">
          Session Complete 🎉
        </h1>

        <div className="grid md:grid-cols-3 gap-8 items-center mb-8">
          {/* The Score Ring */}
          <div className="flex flex-col items-center justify-center col-span-1">
            <div
              className={`w-32 h-32 rounded-full ${bgLightColor} flex items-center justify-center ring-8 ring-opacity-20 ${ringColor} mb-4`}
            >
              <span className={`text-5xl font-black ${scoreColor}`}>
                {scoreData.overall_score}
              </span>
            </div>
            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              Final Score
            </span>
          </div>

          {/* The Summary */}
          <div className="col-span-2 text-left bg-gray-50 p-6 rounded-2xl border border-gray-100 h-full flex flex-col justify-center">
            <h3 className="font-bold text-gray-800 mb-2">Overall Feedback</h3>
            <p className="text-gray-600 text-[15px] leading-relaxed">
              {scoreData.summary}
            </p>
          </div>
        </div>

        {/* Areas of Improvement */}
        <div className="bg-purple-50 p-6 rounded-2xl text-left border border-purple-100">
          <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
            <span>📈</span> Areas for Improvement
          </h3>
          <ul className="space-y-3">
            {scoreData.areas_of_improvement &&
              scoreData.areas_of_improvement.map(
                (point: string, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-[15px] text-purple-800 leading-relaxed"
                  >
                    <span className="text-purple-400 mt-1">➔</span>
                    <span>{point}</span>
                  </li>
                ),
              )}
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-10 w-full md:w-auto px-10 py-4 bg-gray-900 text-white rounded-xl font-bold transition hover:bg-gray-800 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
        >
          Start Another Practice Session
        </button>
      </div>
    );
  }

  // --- RENDER INTERVIEW ---
  return (
    <div className="max-w-3xl mx-auto h-[85vh] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-4">
      {/* HEADER */}
      <div className="p-4 border-b bg-white flex justify-between items-center z-10">
        <div>
          <h2 className="font-bold text-gray-800 hidden sm:block">AI Coach</h2>
        </div>

        <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          {/* TIMER & ADD TIME BUTTON */}
          <div className="flex items-center gap-2">
            {timeRemaining !== null && (
              <span
                className={`text-xs font-bold px-2 py-1 rounded border shadow-sm ${timeRemaining < 300 ? "text-red-600 bg-red-50 border-red-100 animate-pulse" : "text-purple-700 bg-purple-50 border-purple-100"}`}
              >
                {formatTime(timeRemaining)}
              </span>
            )}

            <button
              onClick={handleUpgrade}
              className={`text-xs font-bold px-2 py-1 rounded transition-all shadow-sm ${timeRemaining !== null && timeRemaining < 300 ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" : "bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200"}`}
            >
              + Add Time
            </button>
          </div>

          {/* PROGRESS BAR */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] md:text-xs font-bold text-purple-600 mb-1">
              Q {currentQuestionCount} of {targetQuestions}
            </span>
            <div className="w-20 md:w-32 h-1.5 md:h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-500 ease-out"
                style={{
                  width: `${(currentQuestionCount / targetQuestions) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] w-full flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "user" ? (
                <div className="bg-purple-600 text-white p-4 rounded-2xl rounded-tr-none shadow-sm text-[15px] leading-relaxed max-w-[85%]">
                  {msg.content}
                </div>
              ) : (
                // THIS IS WHERE THE PARSER MAGIC HAPPENS
                renderAIMessage(msg.content)
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm text-gray-500 text-sm animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-white flex items-end gap-2">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-xl transition-all shadow-sm ${isListening ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {isListening ? "🛑" : "🎤"}
        </button>
        <textarea
          value={input + interimText}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isListening
              ? "Listening... click 🛑 to stop."
              : "Type your answer (or click mic)..."
          }
          className={`flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none h-14 text-sm transition-all ${isListening ? "border-red-300 bg-red-50/30" : "border-gray-200"}`}
        />
        <button
          onClick={submitAnswer}
          disabled={loading || !input.trim()}
          className="bg-purple-600 text-white p-3 px-6 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 transition shadow-md"
        >
          Send
        </button>
      </div>
    </div>
  );
}
