"use client";

import { useEffect, useId, useState } from "react";
import { IngredientList } from "@/components/ingredient-list";
import { cupFrame, cupSvgInner } from "@/lib/cup-svg";
import type { RecipeSelection } from "@/lib/types";

function layerKeys(recipe: RecipeSelection): string[] {
  const keys: string[] = [];
  if (recipe.base) keys.push(`base:${recipe.base}`);
  if (recipe.milk && recipe.milk !== "none") keys.push(`milk:${recipe.milk}`);
  for (const id of recipe.sauces) keys.push(`sauce:${id}`);
  for (const id of recipe.syrups) keys.push(`syrup:${id}`);
  for (const id of recipe.addIns) keys.push(`add-in:${id}`);
  if (recipe.coldFoam) keys.push(`cold-foam:${recipe.coldFoam}`);
  return keys;
}

export function CupPreview({ recipe, drinkName }: { recipe: RecipeSelection; drinkName?: string }) {
  const clipId = `cup-${useId().replace(/:/g, "")}`;
  const keys = layerKeys(recipe);
  const signature = keys.join("|");
  const [seen, setSeen] = useState<string[]>([]);
  const land = new Set(keys.filter((key) => !seen.includes(key)));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSeen((current) => (current.join("|") === signature ? current : signature.split("|").filter(Boolean)));
    }, 560);
    return () => window.clearTimeout(timeout);
  }, [signature]);

  return (
    <figure className="rounded-2xl bg-white px-5 py-8 shadow-[0_24px_60px_rgb(39_75_58/0.08)] sm:px-8">
      {drinkName !== undefined ? (
        <p
          aria-live="polite"
          className="min-h-14 text-center font-heading text-4xl leading-none text-balance text-[#274b3a] sm:text-5xl"
        >
          {drinkName}
        </p>
      ) : null}
      <p className="mt-3 text-center text-xs font-bold tracking-[0.18em] text-[#3f5d4e] uppercase">Your cup</p>
      <svg
        viewBox={`0 0 ${cupFrame.width} ${cupFrame.height}`}
        className="mx-auto mt-2 h-auto w-full max-w-[320px]"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: cupSvgInner(recipe, clipId, land) }}
      />
      <IngredientList recipe={recipe} className="mt-6 justify-center" />
    </figure>
  );
}
