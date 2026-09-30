import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { UploadDialogProvider } from "@/components/upload-dialog";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Urban Grind",
    template: "%s · Urban Grind",
  },
  description: "Photos of drinks from Urban Grind. Add yours.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col overflow-x-hidden bg-[#f3f2ef] text-[#274b3a]">
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <UploadDialogProvider>
          <SiteHeader />
          <main id="content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-12">
            {children}
          </main>
          <footer className="bg-[#274b3a] text-[#f3f2ef]">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-10 sm:flex-row sm:items-end sm:justify-between lg:px-8">
              <p className="font-heading text-2xl leading-none sm:text-3xl">Urban Grind Coffee Co.</p>
              <p className="text-sm tracking-wide">Barrie</p>
            </div>
          </footer>
        </UploadDialogProvider>
      </body>
    </html>
  );
}
