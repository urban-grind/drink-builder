import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopDrinks } from "@/components/top-drinks";
import { drinkStatsEnabled, loadDrinkSales, rankDrinkSales } from "@/lib/drink-stats";

export const metadata: Metadata = {
  title: "Top drinks",
  description: "Drinks sold today, this week, and this month.",
  robots: { index: false, follow: false },
};

export default async function TopDrinksPage() {
  if (!drinkStatsEnabled()) notFound();
  const board = await loadDrinkSales();
  const stats = rankDrinkSales(board.sales);
  return <TopDrinks stats={stats} updatedAt={board.updatedAt} />;
}
