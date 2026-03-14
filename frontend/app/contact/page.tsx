import { Metadata } from "next";
import PublicNavbar from "@/components/PublicNavbar";

export const metadata: Metadata = {
  title: "Contact Support | Interview Copilot",
  description:
    "Get in touch with the Interview Copilot team for support, feedback, or enterprise inquiries.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <PublicNavbar />

      <main className="pt-32 pb-24 px-4 max-w-xl mx-auto">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4 text-center">
          Get in touch
        </h1>
        <p className="text-gray-500 text-center mb-10">
          Have a question about your credits, need technical support, or want to
          suggest a feature? Drop us a message below.
        </p>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <form className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="john@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Message
              </label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl h-32 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="How can we help?"
                required
              ></textarea>
            </div>

            <button
              type="button"
              className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition shadow-md"
            >
              Send Message
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

// A contact form ensures users can reach you for support. Note: The form UI is here, but you will eventually want to connect the onSubmit to an email service like Resend or Formspree, or build a simple API route that sends you an email using Nodemailer.
