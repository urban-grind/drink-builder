import { firstName } from "@/lib/first-name";

/** Sentence the share sheet and link preview use under the title. */
export const PHOTO_SHARE_TEXT = "Help me win free coffee for a month";

/** Title and text for a voting link. The title uses the first name. */
export function photoShareCard(personName: string): { title: string; description: string } {
  const name = firstName(personName);
  return {
    title: name ? `Vote for ${name}'s photo` : "Vote for this photo",
    description: PHOTO_SHARE_TEXT,
  };
}
