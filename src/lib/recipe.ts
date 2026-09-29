import { addIns, baseItem, coldFoams, itemsById, milks, sauces, syrups, type MenuItem } from "@/lib/menu";
import type { RecipeSelection } from "@/lib/types";

export function milkItem(id: string): MenuItem | undefined {
  return milks.find((item) => item.id === id);
}

export function selectedItems(recipe: RecipeSelection): MenuItem[] {
  const milk = milkItem(recipe.milk);
  const chosenBase = baseItem(recipe.base);
  return [
    ...(chosenBase ? [chosenBase] : []),
    ...(milk && milk.id !== "none" ? [milk] : []),
    ...itemsById(sauces, recipe.sauces),
    ...itemsById(syrups, recipe.syrups),
    ...itemsById(coldFoams, recipe.coldFoam ? [recipe.coldFoam] : []),
    ...itemsById(addIns, recipe.addIns),
  ];
}

export function summarizeRecipe(recipe: RecipeSelection): string {
  const chosenBase = baseItem(recipe.base);
  const milk = milkItem(recipe.milk);
  let lead = "Nothing in the cup yet";
  if (chosenBase && milk && milk.id !== "none") lead = `${chosenBase.name} with ${milk.name.toLowerCase()}`;
  else if (chosenBase && milk) lead = `${chosenBase.name}, no milk`;
  else if (chosenBase) lead = chosenBase.name;
  else if (milk && milk.id !== "none") lead = milk.name;
  else if (milk) lead = "No milk";
  const extras = [
    ...itemsById(sauces, recipe.sauces),
    ...itemsById(syrups, recipe.syrups),
    ...itemsById(coldFoams, recipe.coldFoam ? [recipe.coldFoam] : []),
    ...itemsById(addIns, recipe.addIns),
  ].map((item) => item.name);

  if (extras.length === 0) return lead;
  if (extras.length === 1) return `${lead}, ${extras[0]}`;
  const last = extras[extras.length - 1];
  return `${lead}, ${extras.slice(0, -1).join(", ")}, and ${last}`;
}
