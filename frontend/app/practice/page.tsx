"use client";
import MockCoach from "@/components/MockCoach";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PracticePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Protect Route
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/");
      else setLoading(false);
    });
  }, [router]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Simple Back Button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-4 text-gray-500 hover:text-gray-900 flex items-center gap-2"
      >
        ← Back to Dashboard
      </button>

      <MockCoach />
    </div>
  );
}
