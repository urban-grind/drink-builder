/** First prompt after this many swipes. Closing it allows this many more, then swiping stops. */
export const DRAW_ASK_EVERY = 5;

/** Swipe count where the prompt stays up until they sign up. */
export const DRAW_REQUIRED_AT = DRAW_ASK_EVERY * 2;

export type DrawPromptMode = "closed" | "ask" | "required";

export function drawPromptMode(swipes: number, known: boolean, askAfter: number): DrawPromptMode {
  if (known) return "closed";
  if (!Number.isInteger(swipes) || swipes < DRAW_ASK_EVERY) return "closed";
  if (swipes >= DRAW_REQUIRED_AT) return "required";
  const after = Number.isInteger(askAfter) && askAfter >= DRAW_ASK_EVERY ? askAfter : DRAW_ASK_EVERY;
  return swipes >= after ? "ask" : "closed";
}

export function shouldAskDraw(swipes: number, known: boolean, askAfter: number): boolean {
  return drawPromptMode(swipes, known, askAfter) !== "closed";
}

/** Another swipe has to wait until this browser has signed up. */
export function swipeNeedsSignup(swipes: number, known: boolean): boolean {
  return !known && Number.isInteger(swipes) && swipes >= DRAW_REQUIRED_AT;
}

/** The next swipe count that should open the prompt after they close it. */
export function nextDrawAsk(swipes: number): number {
  const counted = Number.isInteger(swipes) && swipes >= DRAW_ASK_EVERY ? swipes : DRAW_ASK_EVERY;
  return counted + DRAW_ASK_EVERY;
}
