import LiveTranscript from "@/components/LiveTranscript";
import ResumeUploader from "@/components/ResumeUploader";

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center gap-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
          Interview Copilot
        </h1>

        {/* Step 1: Upload Resume */}
        <ResumeUploader />

        {/* Step 2: Live Transcript & AI Help */}
        <LiveTranscript />
      </div>
    </main>
  );
}
