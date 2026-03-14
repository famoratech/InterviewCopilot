import { Metadata } from "next";
import PublicNavbar from "@/components/PublicNavbar";

export const metadata: Metadata = {
  title: "About Us | Interview Copilot",
  description:
    "Learn why we built Interview Copilot to level the playing field for job seekers.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <PublicNavbar />

      <main className="pt-32 pb-24 px-4 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-8">
          Leveling the playing field.
        </h1>

        <div className="prose prose-lg text-gray-600 leading-relaxed space-y-6">
          <p>
            Job hunting is broken. You can have all the right skills, the
            perfect experience, and the right attitude, but if you get nervous
            and freeze up during a 30-minute Zoom call, you lose the
            opportunity.
          </p>
          <p>
            We built <strong>Interview Copilot</strong> because we believe that
            getting hired shouldn't be a test of how well you handle
            interrogation. It should be about whether you can do the job.
          </p>
          <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">
            Our Mission
          </h2>
          <p>
            Our mission is to eliminate interview anxiety. By leveraging
            ultra-low latency AI, we act as your personal earpiece—reminding you
            of the incredible things you've already achieved and structuring
            your thoughts into perfect, STAR-method answers in real-time.
          </p>
          <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl mt-8">
            <p className="text-blue-900 font-medium italic mb-0">
              "We want to empower candidates to walk into any interview, knowing
              they have a brilliant, strategic coach sitting right beside them."
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
