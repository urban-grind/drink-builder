"use client";

import Link from "next/link";
import { IngredientList } from "@/components/ingredient-list";
import { VoteButton } from "@/components/vote-button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { summarizeRecipe } from "@/lib/recipe";
import { formatWhen } from "@/lib/time";
import type { PublicDrink } from "@/lib/types";

export function DrinkCard({
  drink,
  onUpdated,
}: {
  drink: PublicDrink;
  onUpdated: (drink: PublicDrink) => void;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="font-heading text-2xl leading-tight text-balance">
          <Link
            href={`/drinks/${drink.id}`}
            className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {drink.name}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">By {drink.creatorName}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-pretty">{summarizeRecipe(drink)}</p>
        <IngredientList recipe={drink} />
        {drink.description ? <p className="text-pretty text-foreground/90">{drink.description}</p> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <VoteButton drink={drink} onUpdated={onUpdated} />
          <p className="text-sm text-muted-foreground">
            <span className="font-heading text-2xl text-foreground">{drink.voteCount}</span>{" "}
            {drink.voteCount === 1 ? "vote" : "votes"}
          </p>
        </div>
        <time dateTime={drink.createdAt} className="text-sm text-muted-foreground">
          {formatWhen(drink.createdAt)}
        </time>
      </CardFooter>
    </Card>
  );
}
