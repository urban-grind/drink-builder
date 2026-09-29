"use client";

import { useEffect, useRef, useState } from "react";
import { IngredientList } from "@/components/ingredient-list";
import { drinkVisualState, type DrinkVisual } from "@/lib/drink-visual";
import type { RecipeSelection } from "@/lib/types";

type DrinkHandle = {
  setState: (patch: DrinkVisual) => DrinkVisual;
};

type RendererModule = {
  mountDrinkBuilder: (container: HTMLElement, assetRoot: string, initial: DrinkVisual) => Promise<DrinkHandle>;
};

function loadRenderer(specifier: string): Promise<RendererModule> {
  const importer = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<RendererModule>;
  return importer(specifier);
}

export function DrinkBuilderCup({ recipe, drinkName }: { recipe: RecipeSelection; drinkName?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const drinkRef = useRef<DrinkHandle | null>(null);
  const recipeRef = useRef(recipe);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  recipeRef.current = recipe;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancel = false;
    const sandbox = document.createElement("div");
    loadRenderer("/drink-builder/drink-renderer.mjs")
      .then((mod) => {
        if (cancel) return null;
        return mod.mountDrinkBuilder(sandbox, "/drink-builder/", drinkVisualState(recipeRef.current));
      })
      .then((drink) => {
        if (cancel || !drink) return;
        drink.setState(drinkVisualState(recipeRef.current));
        host.replaceChildren(...sandbox.childNodes);
        drinkRef.current = drink;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancel) setStatus("error");
      });
    return () => {
      cancel = true;
      drinkRef.current = null;
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    drinkRef.current?.setState(drinkVisualState(recipe));
  }, [recipe]);

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
      <div
        ref={hostRef}
        data-drink-builder-cup
        aria-busy={status === "loading"}
        className="mx-auto mt-2 w-full max-w-[320px] [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-[650px] [&_svg]:w-full"
      />
      {status === "loading" ? <p className="mt-3 text-center text-sm text-[#3f5d4e]">Loading the cup…</p> : null}
      {status === "error" ? (
        <p role="alert" className="mt-3 text-center text-sm text-destructive">
          The cup didn't draw.
        </p>
      ) : null}
      <IngredientList recipe={recipe} className="mt-6 justify-center" />
    </figure>
  );
}
