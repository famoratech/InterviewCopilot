import { Metadata } from "next";
import Link from "next/link";
import PublicNavbar from "@/components/PublicNavbar";

export const metadata: Metadata = {
  title: "Interview Copilot | Pass Any Interview with Live AI",
  description:
    "Get real-time, teleprompter-style AI answers during Zoom/Teams interviews and practice with an elite Mock Interview Coach.",
  keywords: [
    "live interview AI",
    "interview teleprompter",
    "zoom interview helper",
    "AI interview coach",
    "pass job interview",
  ],
};

// Dummy testimonial data
const testimonials = [
  {
    name: "Sarah J.",
    role: "Product Manager",
    text: "I completely froze when they asked about a time I failed. I glanced at the Copilot, read the bullet point it generated from my resume, and nailed it. Got the offer!",
    rating: "⭐⭐⭐⭐⭐",
  },
  {
    name: "David M.",
    role: "Software Engineer",
    text: "The Mock Interview Coach is brutal but exactly what I needed. It pointed out I was rambling. Fixed it and passed my FAANG loop.",
    rating: "⭐⭐⭐⭐⭐",
  },
  {
    name: "Emily R.",
    role: "Marketing Director",
    text: "I used the Phone Copilot for my initial recruiter screen. Having the STAR method answers pop up instantly gave me so much confidence.",
    rating: "⭐⭐⭐⭐⭐",
  },
  {
    name: "Michael T.",
    role: "Data Analyst",
    text: "Best $20 I've ever spent on job prep. The system audio capture on Windows worked perfectly with Microsoft Teams.",
    rating: "⭐⭐⭐⭐⭐",
  },
  {
    name: "Jessica K.",
    role: "UX Designer",
    text: "I love the Ninja Mode! They asked me to share my screen to show my portfolio, and I hid the UI instantly. So smart.",
    rating: "⭐⭐⭐⭐⭐",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-blue-200 overflow-x-hidden">
      <PublicNavbar />

      {/* FIXED: INLINE ANIMATION FOR SEAMLESS INFINITE MARQUEE */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); } /* Changed to -50% for a perfect loop */
        }
        .animate-marquee {
          display: flex;
          animation: marquee 30s linear infinite;
        }
        .marquee-container:hover .animate-marquee {
          animation-play-state: paused;
        }
      `,
        }}
      />

      <main>
        {/* HERO SECTION */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-24 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-blue-100 to-indigo-50 blur-3xl rounded-full opacity-50 -z-10"></div>

          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-bold uppercase tracking-wider mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Now Live for Zoom, Teams & Phone Calls
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-8">
              Your unfair advantage for <br className="hidden md:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                online job interviews.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Interview Copilot listens to your live interviews and instantly
              generates tailored, teleprompter-style answers based on your
              resume.
            </p>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </section>

        {/* 🌟 SEAMLESS ANIMATED TESTIMONIAL CAROUSEL 🌟 */}
        <section className="py-10 bg-white border-y border-gray-100 overflow-hidden relative marquee-container cursor-default">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

          {/* We removed gap-6 from the container and put mr-6 on the items so the -50% math works perfectly */}
          <div className="w-max animate-marquee">
            {[...testimonials, ...testimonials].map((t, idx) => (
              <div
                key={idx}
                className="w-80 md:w-[400px] mr-6 bg-gray-50 border border-gray-100 p-6 rounded-2xl flex-shrink-0 hover:bg-blue-50 hover:border-blue-100 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-gray-900">{t.name}</h4>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                      {t.role}
                    </p>
                  </div>
                  <div className="text-sm">{t.rating}</div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed italic">
                  "{t.text}"
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 🌟 THE 4 PILLARS GRID (Updated to 2x2) 🌟 */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                An entire career suite in one tool.
              </h2>
              <p className="text-lg text-gray-600">
                From writing your resume to answering the final interview
                question.
              </p>
            </div>

            {/* Changed from grid-cols-3 to a beautiful 2x2 grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Feature 1: Video Copilot */}
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mb-6">
                  💻
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Live Video Copilot
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Transcribes the interviewer's questions via system audio
                  (Zoom, Teams, Meet) and streams the perfect teleprompter
                  answer instantly.
                </p>
              </div>

              {/* Feature 2: Phone Copilot */}
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center text-2xl mb-6">
                  📞
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Phone Copilot
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Perfect for initial recruiter phone screens. Put your phone on
                  speaker, and our AI listens via your microphone to feed you
                  winning answers.
                </p>
              </div>

              {/* Feature 3: Mock Coach */}
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-2xl mb-6">
                  🤖
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  AI Mock Coach
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Practice your answers out loud before the real thing. Get
                  granular feedback on every answer and a final scorecard on a
                  100-point scale.
                </p>
              </div>

              {/* Feature 4: Resume Optimizer */}
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-2xl mb-6">
                  📄
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Resume Optimizer
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Beat the ATS. Paste your resume and the job description, and
                  our AI will rewrite your bullets to perfectly match what the
                  recruiter is looking for.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>
            © {new Date().getFullYear()} Interview Copilot. All rights reserved.
          </p>
          <div className="flex justify-center gap-6 mt-4 font-medium">
            <Link href="/about" className="hover:text-gray-900">
              About
            </Link>
            <Link href="/guides" className="hover:text-gray-900">
              Guides
            </Link>
            <Link href="/contact" className="hover:text-gray-900">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
