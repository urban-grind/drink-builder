import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/app-frame";
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
          <AppFrame>{children}</AppFrame>
        </UploadDialogProvider>
      </body>
    </html>
  );
}
