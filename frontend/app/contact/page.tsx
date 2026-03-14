"use client";

import PublicNavbar from "@/components/PublicNavbar";
import { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setStatus("success");
      setFormData({ name: "", email: "", message: "" }); // Clear the form
    } catch (error: any) {
      setStatus("error");
      setErrorMessage(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <PublicNavbar />

      <title>Contact Support | Interview Copilot</title>
      <meta
        name="description"
        content="Get in touch with the Interview Copilot team for support, feedback, or enterprise inquiries."
      />

      <main className="pt-32 pb-24 px-4 max-w-xl mx-auto">
        {/* === THE LIFTED WHITE CARD === */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10 relative overflow-hidden">
          {/* Subtle top gradient accent (optional, looks very premium) */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500"></div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-3 text-center mt-2">
            Get in touch
          </h1>
          <p className="text-gray-500 text-center mb-8 text-sm sm:text-base px-2">
            Have a question about your credits, need technical support, or want
            to suggest a feature? Drop us a message below.
          </p>

          {status === "success" ? (
            <div className="bg-green-50 text-green-800 p-8 rounded-2xl border border-green-200 text-center animate-in fade-in zoom-in duration-500">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="font-bold text-2xl mb-2 text-green-900">
                Message Sent!
              </h3>
              <p className="text-green-700">
                Thanks for reaching out. We will get back to you shortly.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="mt-8 text-green-700 font-bold hover:text-green-900 transition text-sm px-6 py-3 bg-green-100/50 rounded-xl hover:bg-green-100"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  // Notice the bg-gray-50 here, it makes the input look inset on the white card
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-colors"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-colors"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl h-36 resize-none focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-colors"
                  placeholder="How can we help?"
                  required
                ></textarea>
              </div>

              {/* Error Message Display */}
              {status === "error" && (
                <div className="p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 text-center">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 px-4 rounded-xl transition shadow-lg hover:-translate-y-1 disabled:opacity-50 disabled:transform-none flex justify-center items-center mt-4"
              >
                {status === "loading" ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
