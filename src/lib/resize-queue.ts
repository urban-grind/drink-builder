/** Sharp resizes share this process. R2 can take many uploads; only a couple of resizes run. */
export const RESIZE_LIMIT = 2;

let active = 0;
const waiting: Array<() => void> = [];

function release(): void {
  active -= 1;
  const next = waiting.shift();
  if (next) next();
}

export function withResizeSlot<T>(work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active += 1;
      Promise.resolve()
        .then(work)
        .then(resolve, reject)
        .finally(release);
    };
    if (active < RESIZE_LIMIT) run();
    else waiting.push(run);
  });
}
