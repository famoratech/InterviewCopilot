import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://copilot.edgehit.ca"),
  title: "Interview Copilot | Real-Time AI Interview Assistant",
  description:
    "Ace your next job interview with real-time, teleprompter-style AI answers, mock interview coaching, and ATS resume optimization.",
  keywords: [
    "AI interview",
    "interview copilot",
    "mock interview coach",
    "real-time interview helper",
    "ATS resume optimizer",
    "job prep AI",
    "live interview AI",
    "interview teleprompter",
    "zoom interview helper",
    "behavioral interview practice",
    "pass job interview",
    "live transcription AI",
  ],
  alternates: {
    canonical: "/", // Explicitly defines the canonical URL
  },
  openGraph: {
    title: "Interview Copilot | Real-Time AI Interview Assistant",
    description:
      "Get real-time, tailored answers during your live interviews and practice with an AI coach.",
    url: "https://copilot.edgehit.ca",
    siteName: "Interview Copilot",
    images: [
      {
        url: "/og-image.jpeg", // Next.js automatically resolves this against metadataBase
        width: 1200,
        height: 630,
        alt: "Interview Copilot Dashboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interview Copilot | Real-Time AI Interview Assistant",
    description:
      "Ace your next job interview with real-time, teleprompter-style AI answers.",
    images: ["/og-image.jpeg"],
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
