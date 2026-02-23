"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Auth from "../components/Auth";
import LiveTranscript from "../components/LiveTranscript";

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Catch the user when they click the password reset link in their email!
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovering(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setUpdateMessage(`Error: ${error.message}`);
    } else {
      setUpdateMessage("Password updated successfully!");
      setTimeout(() => setIsRecovering(false), 2000); // Close form after 2 seconds
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If they clicked the reset link, force them to set a new password right now
  if (isRecovering) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2 text-center">
            Set New Password
          </h2>
          <p className="text-gray-500 text-sm text-center mb-6">
            Enter a strong password for your account.
          </p>

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="New password..."
              required
            />
            {updateMessage && (
              <p className="text-sm text-center text-blue-600 font-medium">
                {updateMessage}
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-md"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  return (
    <div className="relative min-h-screen bg-gray-50">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => supabase.auth.signOut()}
          className="bg-white border border-gray-200 shadow-sm text-xs font-semibold text-gray-600 px-3 py-1.5 rounded-lg hover:text-red-600 hover:border-red-200 transition"
        >
          Sign Out ({session.user.email})
        </button>
      </div>
      <LiveTranscript />
    </div>
  );
}
