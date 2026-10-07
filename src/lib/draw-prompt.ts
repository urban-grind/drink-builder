/** Ask once they have this many swipes, then again after this many more if they close it. */
export const DRAW_ASK_EVERY = 5;

export function shouldAskDraw(swipes: number, known: boolean, askAfter: number): boolean {
  if (known) return false;
  if (!Number.isInteger(swipes) || swipes < DRAW_ASK_EVERY) return false;
  const after = Number.isInteger(askAfter) && askAfter >= DRAW_ASK_EVERY ? askAfter : DRAW_ASK_EVERY;
  return swipes >= after;
}

/** The next swipe count that should open the prompt after they close it. */
export function nextDrawAsk(swipes: number): number {
  const counted = Number.isInteger(swipes) && swipes >= DRAW_ASK_EVERY ? swipes : DRAW_ASK_EVERY;
  return counted + DRAW_ASK_EVERY;
}
