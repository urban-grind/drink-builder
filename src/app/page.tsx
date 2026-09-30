import type { Metadata } from "next";
import { PhotoBoard } from "@/components/photo-board";

export const metadata: Metadata = {
  title: "This one's mine",
  description: "Snap it and put it up.",
};

export default function HomePage() {
  return <PhotoBoard />;
}
