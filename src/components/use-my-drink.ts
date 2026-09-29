"use client";

import { useSyncExternalStore } from "react";
import { readMyDrinkId } from "@/lib/my-drink";
import { MY_DRINK_EVENT } from "@/lib/votes";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(MY_DRINK_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(MY_DRINK_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useMyDrinkId(): string | null {
  return useSyncExternalStore(subscribe, readMyDrinkId, () => null);
}
