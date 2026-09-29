import type { Metadata } from "next";
import { DrinkDetail } from "@/components/drink-detail";

export const metadata: Metadata = {
  title: "Drink",
  description: "A drink from the board, with its recipe and votes.",
};

export default async function DrinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DrinkDetail key={id} id={id} />;
}
