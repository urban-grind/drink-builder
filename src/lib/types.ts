export type RecipeSelection = {
  base: string;
  /** A milk menu id. `none` means the drink skips milk. */
  milk: string;
  syrups: string[];
  sauces: string[];
  /** A cold foam menu id, or an empty string when the drink has none. */
  coldFoam: string;
  addIns: string[];
};

/** Public drink. Email is stored on the server and is never part of this shape. */
export type PublicDrink = RecipeSelection & {
  id: string;
  name: string;
  description: string;
  creatorName: string;
  createdAt: string;
  voteCount: number;
  voted: boolean;
  /** Card photo saved at publish time. The bytes live on disk, not in this object. */
  photoUrl: string;
};

export type PublishInput = RecipeSelection & {
  name: string;
  description: string;
  creatorName: string;
  creatorEmail: string;
};

export type FieldErrors = Record<string, string>;
