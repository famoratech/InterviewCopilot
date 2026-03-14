"use client";
import { useState } from "react";
import LiveTranscript from "@/components/LiveTranscript";
import { useRouter } from "next/navigation";

export default function VideoPage() {
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
        <div className="max-w-4xl mx-auto w-full bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-4 shadow-sm relative animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="text-blue-500 text-xl mt-0.5">💡</div>
          <div className="flex-1">
            <h3 className="text-blue-900 font-bold mb-1 text-sm uppercase tracking-wider">
              Pro Tip for the Best Experience
            </h3>
            <p className="text-blue-800 text-sm leading-relaxed">
              To allow our AI to hear the interviewer perfectly, we highly
              recommend joining your interview using the{" "}
              <strong>Web Browser version</strong> of Zoom/Teams (not the
              desktop app).
              <br className="mb-2" />
              If you must use the desktop app on a Mac, please use the{" "}
              <strong>Phone Copilot</strong> instead and take the interview
              without headphones!
            </p>
          </div>
          <button
            onClick={() => setShowTip(false)}
            className="text-blue-400 hover:text-blue-700 p-1"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* The Core Component */}
      <div className="flex-1 w-full max-w-4xl mx-auto">
        <LiveTranscript mode="video" />
      </div>
    </div>
  );
}
