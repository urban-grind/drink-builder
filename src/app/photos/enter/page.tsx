import type { Metadata } from "next";
import { PhotoEntryForm } from "@/components/photo-entry-form";

export const metadata: Metadata = {
  title: "Snap yours",
  description: "Snap the drink. Put it on the board. Barrie votes.",
};

export default function PhotoEnterPage() {
  return <PhotoEntryForm />;
}
