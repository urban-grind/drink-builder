import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Drink Builder",
    template: "%s · Drink Builder",
  },
  description: "Build a drink at the counter, publish it with your name, and let the board vote.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#f3f2ef] text-[#274b3a]">
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-12">
          {children}
        </main>
        <footer className="bg-[#274b3a] px-4 py-8 text-sm text-[#f3f2ef] sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p>One drink per email.</p>
            <p>Your email is stored and kept off the board.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
