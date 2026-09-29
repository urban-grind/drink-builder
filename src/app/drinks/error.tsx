"use client";

import { Button } from "@/components/ui/button";

export default function DrinksError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="ug-board bg-white px-5 py-10">
      <h1 className="text-4xl text-[#274b3a]">The board hit a snag</h1>
      <p className="mt-2 text-muted-foreground">Something went wrong loading this page.</p>
      <Button type="button" onClick={() => reset()} className="mt-4 h-11 rounded-full px-4">
        Try again
      </Button>
    </div>
  );
}
