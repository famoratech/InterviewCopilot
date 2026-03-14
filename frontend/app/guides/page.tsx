import { Metadata } from "next";
import PublicNavbar from "@/components/PublicNavbar";
import Link from "next/link";
import { guides } from "@/lib/guides"; // Importing from our new data file!

export const metadata: Metadata = {
  title: "Interview Guides & Tips | Interview Copilot",
  description:
    "Learn the best strategies to beat the ATS, answer behavioral questions, and negotiate your salary.",
};

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <PublicNavbar />

      <main className="pt-32 pb-24 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            Interview Guides & Strategy
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Everything you need to know to pass the behavioral screen, ace the
            technical loop, and negotiate your final offer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {guides.map((guide) => (
            <Link
              key={guide.id}
              href={`/guides/${guide.slug}`}
              className="group bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:border-blue-200 text-left flex flex-col h-full"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  {guide.category}
                </span>
                <span className="text-sm font-medium text-gray-400">
                  {guide.readTime}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                {guide.title}
              </h2>
              <p className="text-gray-600 leading-relaxed flex-grow">
                {guide.desc}
              </p>
              <div className="mt-6 text-sm font-bold text-blue-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                Read Article <span>→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* SEO Conversion Trap */}
        <div className="mt-20 bg-gray-900 rounded-3xl p-10 text-center text-white shadow-xl">
          <h2 className="text-3xl font-bold mb-4">
            Don't want to memorize all this?
          </h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto">
            Let our AI listen to your interview and feed you the perfect answers
            live on your screen.
          </p>
          <Link
            href="/login"
            className="bg-white text-gray-900 hover:bg-gray-100 font-bold py-4 px-10 rounded-xl transition-transform hover:-translate-y-1 inline-block shadow-lg"
          >
            Try Interview Copilot Free
          </Link>
        </div>
      </main>
    </div>
  );
}
