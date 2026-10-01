export type PhotoStatus = "pending" | "approved" | "rejected" | "removed";

/** Public photo. Email and phone are stored and are never part of this shape. */
export type PublicPhoto = {
  id: string;
  personName: string;
  drinkName: string;
  caption: string;
  createdAt: string;
  voteCount: number;
  voted: boolean;
  code: string;
  thumbUrl: string;
  imageUrl: string;
};

export type ReviewPhoto = PublicPhoto & {
  email: string | null;
  phone: string | null;
  status: PhotoStatus;
};

/** A ranked contest photo. likePercent is null until someone votes or skips. */
export type LeaderboardEntry = {
  id: string;
  personName: string;
  drinkName: string;
  thumbUrl: string;
  voteCount: number;
  skipCount: number;
  likePercent: number | null;
};

export type PhotoEntryInput = {
  personName: string;
  email: string | null;
  phone: string | null;
  drinkName: string;
  caption: string;
};
