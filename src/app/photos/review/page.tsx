import type { Metadata } from "next";
import { PhotoReview } from "@/components/photo-review";

export const metadata: Metadata = {
  title: "Photo review",
  description: "Private cafe review for the photo contest.",
  robots: { index: false, follow: false },
};

export default function PhotoReviewPage() {
  return <PhotoReview />;
}
