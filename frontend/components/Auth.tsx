"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

type AuthView = "sign_in" | "sign_up" | "forgot_password";

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [view, setView] = useState<AuthView>("sign_in");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    type: "error" | "success";
  } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      if (view === "sign_up") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({
          text: "Success! Check your email to confirm your account.",
          type: "success",
        });
      } else if (view === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLogin();
      } else if (view === "forgot_password") {
        // This is the new Password Reset Request!
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`, // Sends them back to your site
        });
        if (error) throw error;
        setMessage({
          text: "Password reset link sent! Check your email.",
          type: "success",
        });
      }
    } catch (error: any) {
      setMessage({ text: error.message || "An error occurred", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
            Interview Copilot
          </h1>
          <p className="text-gray-500 text-sm">
            {view === "sign_up" && "Create an account to get started."}
            {view === "sign_in" && "Welcome back. Sign in to your account."}
            {view === "forgot_password" &&
              "Enter your email to reset your password."}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="you@example.com"
              required
            />
          </div>

          {/* Hide password field if they are just requesting a reset link */}
          {view !== "forgot_password" && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Password
                </label>
                {view === "sign_in" && (
                  <button
                    type="button"
                    onClick={() => {
                      setView("forgot_password");
                      setMessage(null);
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {message && (
            <div
              className={`p-3 text-sm rounded-lg text-center ${message.type === "error" ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"}`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition disabled:opacity-50 shadow-md"
          >
            {isLoading
              ? "Processing..."
              : view === "sign_up"
                ? "Create Account"
                : view === "sign_in"
                  ? "Sign In"
                  : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-6 text-center">
          {view !== "sign_in" ? (
            <button
              type="button"
              onClick={() => {
                setView("sign_in");
                setMessage(null);
              }}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Back to Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setView("sign_up");
                setMessage(null);
              }}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Don't have an account? Sign up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
