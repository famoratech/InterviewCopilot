"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// --- TIER DEFINITIONS ---
const TIERS = [
  {
    id: 1,
    name: "Tier 1: Basic ATS Formatting",
    cost: 10,
    icon: "⚙️",
    desc: "Keyword matching and grammar fixes. Best for slightly tweaking an already strong resume.",
    color: "bg-blue-50 border-blue-200 text-blue-900",
    activeColor: "ring-2 ring-blue-500 bg-blue-100",
  },
  {
    id: 2,
    name: "Tier 2: Deep Polish & Expansion",
    cost: 25,
    icon: "✨",
    desc: "Aggressive phrasing and strong action verbs. Expands your real experience to make you look like a top-tier candidate.",
    color: "bg-purple-50 border-purple-200 text-purple-900",
    activeColor: "ring-2 ring-purple-500 bg-purple-100",
    badge: "Most Popular",
  },
  {
    id: 3,
    name: "Tier 3: The Gap Bridger",
    cost: 50,
    icon: "🌉",
    desc: "Identifies missing skills from the JD and generates a custom 'Weekend Project' you can build to legitimately claim that experience.",
    color: "bg-amber-50 border-amber-200 text-amber-900",
    activeColor: "ring-2 ring-amber-500 bg-amber-100",
    badge: "Ultimate",
  },
];

export default function ResumeOptimizerPage() {
  const router = useRouter();

  // State
  const [selectedTier, setSelectedTier] = useState<number>(2);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemsRemoved, setItemsRemoved] = useState<
    { item: string; reason: string }[]
  >([]);

  // Results State
  const [atsScore, setAtsScore] = useState<string | null>(null);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Fetch Credits on Load
  useEffect(() => {
    const fetchCredits = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.push("/login");

      const { data } = await supabase
        .from("user_credits")
        .select("balance_minutes")
        .eq("user_id", session.user.id)
        .single();
      if (data) setTimeRemaining(data.balance_minutes);
    };
    fetchCredits();
  }, [router]);

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) return setError("Please upload your current resume.");
    if (!jobDescription)
      return setError("Please paste the target job description.");

    const cost = TIERS.find((t) => t.id === selectedTier)?.cost || 10;
    if (timeRemaining !== null && timeRemaining < cost) {
      return setError(
        `You need ${cost} minutes to use this tier. You have ${timeRemaining}. Please top up.`,
      );
    }

    setIsOptimizing(true);
    setError(null);
    setAtsScore(null);
    setMissingKeywords([]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const formData = new FormData();
      formData.append("user_id", session.user.id);
      formData.append("job_description", jobDescription);
      formData.append("tier", selectedTier.toString());
      formData.append("resume_file", resumeFile);

      const response = await fetch(`${BACKEND_URL}/optimize`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to optimize resume.");
      }

      // 1. Read the custom headers sent by Python
      const newScore = response.headers.get("X-ATS-Score");
      const newKeywordsRaw = response.headers.get("X-Missing-Keywords");

      const removedItemsRaw = response.headers.get("X-Items-Removed");
      if (removedItemsRaw) setItemsRemoved(JSON.parse(removedItemsRaw));

      if (newScore) setAtsScore(newScore);
      if (newKeywordsRaw) setMissingKeywords(JSON.parse(newKeywordsRaw));

      // 2. Automatically download the Word Document!
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Optimized_Resume_Tier${selectedTier}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      // Deduct locally for UI speed
      if (timeRemaining !== null) {
        setTimeRemaining(timeRemaining - cost);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans p-4 md:p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto w-full mb-8 flex justify-between items-center">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-500 hover:text-gray-900 font-medium text-sm"
        >
          ← Back to Dashboard
        </button>
        {timeRemaining !== null && (
          <div className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
            Balance:{" "}
            <span
              className={timeRemaining < 25 ? "text-red-500" : "text-blue-600"}
            >
              {timeRemaining} mins
            </span>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto w-full grid lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN: Input Form */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Resume Optimizer
          </h1>
          <p className="text-gray-500 mb-8">
            Beat the ATS and land the interview with a perfectly tailored Word
            document.
          </p>

          <form onSubmit={handleOptimize} className="space-y-6">
            {/* 1. Upload */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                1. Upload Current Resume (PDF/Word)
              </label>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition cursor-pointer border border-gray-200 rounded-xl"
              />
            </div>

            {/* 2. JD */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                2. Paste Target Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the requirements and responsibilities here..."
                className="w-full p-4 border border-gray-200 rounded-xl h-40 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-gray-50 focus:bg-white transition-colors"
              />
            </div>

            {/* 3. Tier Selection */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">
                3. Select Optimization Tier
              </label>
              <div className="space-y-3">
                {TIERS.map((tier) => (
                  <div
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className={`relative p-4 rounded-2xl border cursor-pointer transition-all ${tier.color} ${selectedTier === tier.id ? tier.activeColor : "opacity-70 hover:opacity-100"}`}
                  >
                    {tier.badge && (
                      <span className="absolute -top-3 right-4 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        {tier.badge}
                      </span>
                    )}
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-bold flex items-center gap-2">
                        <span>{tier.icon}</span> {tier.name}
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider bg-white/50 px-2 py-1 rounded-md">
                        {tier.cost} mins
                      </div>
                    </div>
                    <p className="text-sm opacity-90 leading-relaxed pr-8">
                      {tier.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isOptimizing}
              className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex justify-center items-center gap-2"
            >
              {isOptimizing ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Rewriting Resume...
                </>
              ) : (
                <>
                  Generate Word Document (Deducts{" "}
                  {TIERS.find((t) => t.id === selectedTier)?.cost} mins)
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Results Dashboard */}
        <div className="flex flex-col gap-6">
          {atsScore ? (
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 animate-in fade-in slide-in-from-bottom-8 duration-700 h-full">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🎉</span>
                <h2 className="text-2xl font-bold text-gray-900">
                  Optimization Complete!
                </h2>
              </div>

              <div className="bg-green-50 border border-green-200 p-4 rounded-2xl mb-8">
                <p className="text-green-800 font-medium">
                  Your new <strong>.docx</strong> file is downloading
                  automatically. Open it to see your perfectly formatted ATS
                  resume.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                  <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Estimated ATS Score
                  </div>
                  <div className="text-5xl font-extrabold text-blue-600">
                    {atsScore}%
                  </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex flex-col justify-center">
                  <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Tier Used
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {TIERS.find((t) => t.id === selectedTier)?.name}
                  </div>
                </div>
              </div>

              {missingKeywords.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">
                    Skills we naturally integrated:
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {missingKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-100"
                      >
                        ✓ {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* DISPLAY ITEMS REMOVED */}
              {itemsRemoved && itemsRemoved.length > 0 ? (
                <div className="mt-8 border-t border-gray-100 pt-6">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-red-500">✂️</span> What we removed to
                    optimize:
                  </h3>
                  <div className="space-y-3">
                    {itemsRemoved.map((removed, i) => (
                      <div
                        key={i}
                        className="bg-red-50/50 border border-red-100 p-3 rounded-xl text-sm"
                      >
                        <p className="text-gray-700 line-through mb-1">
                          "{removed.item}"
                        </p>
                        <p className="text-red-600 font-medium text-xs">
                          Reason: {removed.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-8 border-t border-gray-100 pt-6">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="text-green-500">🛡️</span> Data Preserved
                  </h3>
                  <p className="text-sm text-gray-500">
                    We preserved 100% of your original resume's content and only
                    enhanced the phrasing.
                  </p>
                </div>
              )}

              {selectedTier === 3 && (
                <div className="mt-8 bg-amber-50 border border-amber-200 p-6 rounded-2xl">
                  <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                    <span>🌉</span> Gap Bridger Activated
                  </h3>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    We generated a custom technical project to cover your
                    experience gaps. Check the "Technical Projects" section of
                    your downloaded Word document for the blueprint and
                    pre-written resume bullets!
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-100/50 border-2 border-dashed border-gray-200 rounded-3xl h-full flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
              <div className="text-6xl mb-4 opacity-20">📄</div>
              <h3 className="text-xl font-bold text-gray-400 mb-2">
                Awaiting Resume
              </h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Upload your documents and select a tier to see your ATS Score
                and automatically generate your Word document.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
