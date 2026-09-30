import type { Metadata } from "next";
import { PhotoBoard } from "@/components/photo-board";

export const metadata: Metadata = {
  title: "Photo contest",
  description: "Approved drink photos. Most popular is a ranked top 3 by votes. New lists the 10 newest photos.",
};

export default function PhotosPage() {
  return <PhotoBoard />;
}
