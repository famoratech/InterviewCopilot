"use client";
import LiveTranscript from "@/components/LiveTranscript";
import { useRouter } from "next/navigation";

export default function PhonePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Simple Back Button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-4 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition"
      >
        ← Back to Dashboard
      </button>

      <LiveTranscript mode="phone" />
    </div>
  );
}
