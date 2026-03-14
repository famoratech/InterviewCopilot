import { Metadata } from "next";
import PublicNavbar from "@/components/PublicNavbar";
import Link from "next/link";
import { guides } from "@/lib/guides";
import { notFound } from "next/navigation";

// Define the type for the async params
type Props = {
  params: Promise<{ slug: string }>;
};

// Generate dynamic SEO metadata based on the article title
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // 1. AWAIT the params first
  const resolvedParams = await params;

  const article = guides.find((g) => g.slug === resolvedParams.slug);
  if (!article) return { title: "Article Not Found" };

  return {
    title: `${article.title} | Interview Copilot`,
    description: article.desc,
    // Add openGraph here to make shared links look great
    openGraph: {
      title: article.title,
      description: article.desc,
      type: "article",
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  // 2. AWAIT the params here too
  const resolvedParams = await params;

  // Find the specific article based on the URL slug
  const article = guides.find((g) => g.slug === resolvedParams.slug);

  // If someone types a random URL, show the 404 page
  if (!article) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <PublicNavbar />

      <main className="pt-32 pb-24 px-4 max-w-3xl mx-auto">
        <Link
          href="/guides"
          className="text-sm font-bold text-gray-500 hover:text-gray-900 flex items-center gap-2 mb-8 transition-colors"
        >
          ← Back to all guides
        </Link>

        {/* Article Header */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              {article.category}
            </span>
            <span className="text-sm font-medium text-gray-500">
              {article.readTime}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-6 leading-tight">
            {article.title}
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            {article.desc}
          </p>
        </div>

        {/* RENDERING THE ACTUAL ARTICLE CONTENT */}
        <div
          className="prose prose-lg prose-blue max-w-none text-gray-700 space-y-6"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Sticky Bottom CTA to drive signups */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-center text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-left">
            <h3 className="text-2xl font-bold mb-2">
              Acing interviews is hard.
            </h3>
            <p className="text-blue-100 m-0 text-sm md:text-base">
              Let our AI Copilot give you the exact words to say, live on
              screen.
            </p>
          </div>
          <Link
            href="/login"
            className="bg-white text-blue-900 hover:bg-gray-50 font-bold py-3.5 px-8 rounded-xl transition-transform hover:-translate-y-1 shadow-lg shrink-0 whitespace-nowrap"
          >
            Start Free Trial
          </Link>
        </div>
      </main>
    </div>
  );
}
