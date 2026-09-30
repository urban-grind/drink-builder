import type { Metadata } from "next";
import { PhotoEntryForm } from "@/components/photo-entry-form";

export const metadata: Metadata = {
  title: "Enter a photo",
  description: "Submit one drink photo. The cafe approves it before it appears on the board.",
};

export default function PhotoEnterPage() {
  return <PhotoEntryForm />;
}
