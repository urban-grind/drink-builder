import type { Metadata } from "next";
import { NovemberWinners } from "@/components/november-winners";

export const metadata: Metadata = {
  title: { absolute: "Urban Grind" },
  description: "The three winners of free coffee for November at Urban Grind Coffee Co. in Barrie.",
};

export default function HomePage() {
  return <NovemberWinners />;
}
