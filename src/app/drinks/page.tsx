import type { Metadata } from "next";
import { DrinkBoard } from "@/components/drink-board";

export const metadata: Metadata = {
  title: "The board",
  description: "Most popular is a ranked top 3 by votes. New lists the 10 newest drinks.",
};

export default function DrinksPage() {
  return <DrinkBoard />;
}
