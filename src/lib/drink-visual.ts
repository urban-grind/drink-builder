import type { RecipeSelection } from "@/lib/types";

const SAUCES = new Set(["caramel", "dark-chocolate", "white-chocolate"]);
const DUSTINGS = new Set(["cinnamon", "cocoa-powder", "cinnamon-sugar"]);

const MILK_TYPES = {
  none: "none",
  milk: "2-percent",
  cream: "cream",
  oat: "oat",
  almond: "almond",
  "protein-milk": "protein",
} as const;

const SYRUPS = {
  vanilla: "vanilla",
  "salted-caramel": "caramel",
  hazelnut: "hazelnut",
} as const;

export type DrinkVisual = {
  base: "none" | "espresso" | "chai" | "cold-brew" | "matcha";
  milkType: (typeof MILK_TYPES)[keyof typeof MILK_TYPES];
  sauce: "none" | "caramel" | "dark-chocolate" | "white-chocolate";
  drizzle: "none" | "caramel" | "dark-chocolate" | "white-chocolate";
  syrups: Array<(typeof SYRUPS)[keyof typeof SYRUPS]>;
  foam: "none" | "chocolate" | "vanilla" | "salted-caramel" | "cheesecake";
  dusting: "none" | "cinnamon" | "cocoa-powder" | "cinnamon-sugar";
};

const FOAMS: Record<string, DrinkVisual["foam"]> = {
  "chocolate-cold-foam": "chocolate",
  "vanilla-cold-foam": "vanilla",
  "salted-caramel-cold-foam": "salted-caramel",
  "cheesecake-cold-foam": "cheesecake",
};

/** Maps builder buttons onto the drink package. Iced coffee, toasted marshmallow, and sea salt have no layer. */
export function drinkVisualState(recipe: RecipeSelection): DrinkVisual {
  const base =
    recipe.base === "double-espresso"
      ? "espresso"
      : recipe.base === "chai"
        ? "chai"
        : recipe.base === "cold-brew"
          ? "cold-brew"
          : recipe.base === "matcha"
            ? "matcha"
            : "none";
  const sauceId = recipe.sauces.find((id) => SAUCES.has(id));
  const sauce = sauceId === "caramel" || sauceId === "dark-chocolate" || sauceId === "white-chocolate" ? sauceId : "none";
  const dusting = recipe.addIns.find((id) => DUSTINGS.has(id));
  const syrups = recipe.syrups.flatMap((id) => {
    const mapped = SYRUPS[id as keyof typeof SYRUPS];
    return mapped ? [mapped] : [];
  });
  return {
    base,
    milkType: MILK_TYPES[recipe.milk as keyof typeof MILK_TYPES] ?? "none",
    sauce,
    drizzle: sauce,
    syrups,
    foam: FOAMS[recipe.coldFoam] ?? "none",
    dusting: dusting === "cinnamon" || dusting === "cocoa-powder" || dusting === "cinnamon-sugar" ? dusting : "none",
  };
}
