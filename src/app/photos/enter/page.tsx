import type { Metadata } from "next";
import { PhotoEntryForm } from "@/components/photo-entry-form";

export const metadata: Metadata = {
  title: "Add a photo",
  description: "Add a photo of your Urban Grind drink.",
};

export default function PhotoEnterPage() {
  return <PhotoEntryForm />;
}
