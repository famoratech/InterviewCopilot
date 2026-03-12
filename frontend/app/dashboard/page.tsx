"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Protect the route
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/");
      else setLoading(false);
    });
  }, [router]);

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 md:p-6 font-sans">
      <div className="max-w-4xl w-full text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Choose Your Interview Type
        </h1>
        <p className="text-gray-500 mb-8 md:mb-12 text-base md:text-lg">
          Select how you want the AI to listen to your interview.
        </p>

        {/* Responsive Grid: 1 col on mobile, 2 on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* OPTION 1: VIDEO CALL */}
          <button
            onClick={() => router.push("/interview/video")}
            className="group relative bg-white p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-blue-500 transition-all text-left"
          >
            <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
              RECOMMENDED
            </div>
            <div className="bg-blue-100 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="text-3xl">💻</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-3">
              Zoom / Teams / Meet
            </h2>
            <p className="text-gray-500 text-sm md:text-base leading-relaxed">
              Best for video calls. The AI listens to your computer's internal
              system audio for perfect clarity.
            </p>
          </button>

          {/* OPTION 2: PHONE CALL */}
          <button
            onClick={() => router.push("/interview/phone")}
            className="group bg-white p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-green-500 transition-all text-left"
          >
            <div className="bg-green-100 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="text-3xl">📞</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-3">
              Phone Call
            </h2>
            <p className="text-gray-500 text-sm md:text-base leading-relaxed">
              Best for telephone screenings. The AI listens via your microphone.
              Put your phone on <strong>Speaker</strong>.
            </p>
          </button>
        </div>
        {/* ... Existing Video & Phone Cards ... */}

        {/* OPTION 3: AI COACH (MOCK) */}
        <button
          onClick={() => router.push("/practice")}
          className="group md:col-span-2 relative bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-purple-500 transition-all text-left flex flex-col md:flex-row items-center md:items-start gap-6 mt-7"
        >
          <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
            NEW FEATURE
          </div>
          <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
            <span className="text-3xl">🥋</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              AI Interview Coach
            </h2>
            <p className="text-gray-500 leading-relaxed">
              Practice mode. The AI asks you questions, listens to your answers,
              and gives you a grade and feedback at the end. Perfect for
              warm-ups.
            </p>
          </div>
        </button>

        <button
          onClick={() => supabase.auth.signOut().then(() => router.push("/"))}
          className="mt-8 md:mt-12 text-gray-400 hover:text-gray-600 underline text-sm"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
