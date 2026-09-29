import type { Metadata } from "next";
import { DrinkCongrats } from "@/components/drink-congrats";

export const metadata: Metadata = {
  title: "My drink",
  description: "The drink you published, with an Instagram story and a square to save.",
};

export default async function DrinkCongratsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DrinkCongrats key={id} id={id} />;
}
