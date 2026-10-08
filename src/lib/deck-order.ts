/** Chance a photo is dealt next. A photo nobody has swiped weighs 1. Each swipe shrinks that. */
export function deckWeight(swipes: number): number {
  return 1 / (Math.max(0, swipes) + 1);
}

/**
 * Sort key for one card. A larger key is shown sooner.
 * `unit` is a random number in (0, 1). This is the log of u^(1/weight),
 * so a photo with hundreds of swipes still gets a usable key.
 */
export function deckDealKey(swipes: number, unit: number): number {
  const safe = Math.min(Math.max(unit, Number.EPSILON), 1 - Number.EPSILON);
  return Math.log(safe) / deckWeight(swipes);
}

/** Weighted shuffle. Photos with fewer swipes tend to come first, and a popular photo can still lead. */
export function dealDeck<T extends { swipes: number }>(
  photos: readonly T[],
  random: () => number = Math.random,
): T[] {
  return photos
    .map((photo, index) => ({
      photo,
      index,
      key: deckDealKey(photo.swipes, random()),
    }))
    .sort((left, right) => right.key - left.key || left.index - right.index)
    .map((item) => item.photo);
}
