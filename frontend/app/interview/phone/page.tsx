"use client";
import { useState } from "react";
import LiveTranscript from "@/components/LiveTranscript";
import { useRouter } from "next/navigation";

export default function PhonePage() {
  const router = useRouter();
  const [showTip, setShowTip] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      {/* Simple Back Button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-4 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition w-fit font-medium"
      >
        ← Back to Dashboard
      </button>

      {/* 💡 PRO TIP BANNER */}
      {showTip && (
        <div className="max-w-4xl mx-auto w-full bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 flex items-start gap-4 shadow-sm relative animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="text-purple-500 text-xl mt-0.5">🎧</div>
          <div className="flex-1">
            <h3 className="text-purple-900 font-bold mb-1 text-sm uppercase tracking-wider">
              Audio Setup Tip
            </h3>
            <p className="text-purple-800 text-sm leading-relaxed">
              The Phone Copilot listens to your microphone. To ensure the AI can
              also hear the interviewer's questions,{" "}
              <strong>please take this interview without headphones.</strong>
              <br className="mb-1" />
              Let the interviewer's voice play through your device speakers so
              your microphone can pick it up!
            </p>
          </div>
          <button
            onClick={() => setShowTip(false)}
            className="text-purple-400 hover:text-purple-700 p-1"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* The Core Component */}
      <div className="flex-1 w-full max-w-4xl mx-auto">
        <LiveTranscript mode="phone" />
      </div>
    </div>
  );
}
