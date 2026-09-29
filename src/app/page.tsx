import type { Metadata } from "next";
import { DrinkBuilder } from "@/components/drink-builder";
import { HowItWorks } from "@/components/how-it-works";
import { TopDrinks } from "@/components/top-drinks";

export const metadata: Metadata = {
  title: "Invent a drink",
  description: "You make the cup. It goes on the board. People vote.",
};

export default function HomePage() {
  return (
    <div className="ug-board -mx-4 flex flex-col gap-16 px-4 sm:-mx-6 sm:px-6">
      <section aria-labelledby="the-idea" className="relative -mx-4 overflow-hidden bg-[#274b3a] px-4 py-14 text-[#f3f2ef] sm:-mx-6 sm:px-6 sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-[-4rem] size-[28rem] rounded-full bg-[#1c3529]" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-6rem] left-[-3rem] size-64 rounded-full bg-[#315744]" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-bold tracking-[0.22em] text-[#f3f2ef]/75 uppercase">At the counter</p>
          <h1 id="the-idea" className="mt-4 text-5xl text-balance text-[#f3f2ef] sm:text-7xl">
            Invent a drink
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty text-[#f3f2ef]/90">
            You make the cup. It goes on the board. People vote.
          </p>
        </div>
      </section>

      <HowItWorks />

      <TopDrinks />

      <section aria-labelledby="build-your-own" className="flex flex-col gap-8">
        <div>
          <h2 id="build-your-own" className="text-4xl sm:text-5xl">
            Build your own
          </h2>
          <p className="mt-3 max-w-2xl text-pretty">
            Nothing starts selected. Choose a base and a milk, then publish. Your email stays off the board.
          </p>
        </div>
        <DrinkBuilder />
      </section>
    </div>
  );
}
