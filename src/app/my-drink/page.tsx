import type { Metadata } from "next";
import { MyDrinkPage } from "@/components/my-drink-page";

export const metadata: Metadata = {
  title: "My drink",
  description: "The drink this browser published, or a note that it has not published one yet.",
};

export default function Page() {
  return <MyDrinkPage />;
}
