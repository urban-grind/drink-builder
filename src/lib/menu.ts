/**
 * Cafe menu. Each item is a name plus an image path.
 * `image` stays empty until the cafe supplies a file — do not invent photos.
 * Syrup, sauce, cold foam, and add-in names are the current placeholder list.
 */
export type MenuItem = {
  id: string;
  name: string;
  image: string;
};

export const bases = [
  { id: "double-espresso", name: "Double espresso", image: "" },
  { id: "cold-brew", name: "Cold brew", image: "" },
  { id: "iced-coffee", name: "Iced coffee", image: "" },
  { id: "chai", name: "Chai", image: "" },
  { id: "matcha", name: "Matcha", image: "" },
] as const satisfies readonly MenuItem[];

/** Cold brew and iced coffee may skip milk. The other bases need a real milk. */
export function baseAllowsNone(baseId: string): boolean {
  return baseId === "cold-brew" || baseId === "iced-coffee";
}

/** Kept so drinks already published with drip still show that name. Not offered in the builder. */
const retiredBases = [{ id: "drip-coffee", name: "Drip coffee", image: "" }] as const satisfies readonly MenuItem[];

export function baseItem(id: string): MenuItem | undefined {
  return bases.find((item) => item.id === id) ?? retiredBases.find((item) => item.id === id);
}

/** One choice. Nothing starts selected. `none` is last and skips milk. */
export const milks = [
  { id: "milk", name: "Milk", image: "" },
  { id: "cream", name: "Cream", image: "" },
  { id: "oat", name: "Oat", image: "" },
  { id: "almond", name: "Almond", image: "" },
  { id: "protein-milk", name: "Protein milk", image: "" },
  { id: "none", name: "None", image: "" },
] as const satisfies readonly MenuItem[];

export const syrups = [
  { id: "vanilla", name: "Vanilla", image: "" },
  { id: "salted-caramel", name: "Salted caramel", image: "" },
  { id: "hazelnut", name: "Hazelnut", image: "" },
  { id: "toasted-marshmallow", name: "Toasted marshmallow", image: "" },
] as const satisfies readonly MenuItem[];

export const sauces = [
  { id: "white-chocolate", name: "White chocolate", image: "" },
  { id: "dark-chocolate", name: "Dark chocolate", image: "" },
  { id: "caramel", name: "Caramel", image: "" },
] as const satisfies readonly MenuItem[];

export const coldFoams = [
  { id: "vanilla-cold-foam", name: "Vanilla Cold Foam", image: "" },
  { id: "salted-caramel-cold-foam", name: "Salted Caramel Cold Foam", image: "" },
  { id: "cheesecake-cold-foam", name: "Cheesecake Cold Foam", image: "" },
  { id: "chocolate-cold-foam", name: "Chocolate Cold Foam", image: "" },
] as const satisfies readonly MenuItem[];

export const addIns = [
  { id: "sea-salt", name: "Sea salt", image: "" },
  { id: "cinnamon", name: "Cinnamon", image: "" },
  { id: "cinnamon-sugar", name: "Cinnamon sugar", image: "" },
  { id: "cocoa-powder", name: "Cocoa powder", image: "" },
] as const satisfies readonly MenuItem[];

/**
 * A drink may have one sauce and one syrup, or two syrups. Not a sauce plus two syrups.
 * Cold foam is a separate single choice. Add-ins stay at two. Zero of any group is allowed.
 */
export const selectionLimits = {
  syrups: 2,
  sauces: 1,
  coldFoams: 1,
  addIns: 2,
} as const;

export function itemsById(catalog: readonly MenuItem[], ids: readonly string[]): MenuItem[] {
  return ids.flatMap((id) => {
    const item = catalog.find((entry) => entry.id === id);
    return item ? [item] : [];
  });
}
