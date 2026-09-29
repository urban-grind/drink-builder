import { isUuid } from "@/lib/validation";
import { MY_DRINK_EVENT, MY_DRINK_STORAGE_KEY } from "@/lib/votes";

export function readMyDrinkId(): string | null {
  const value = localStorage.getItem(MY_DRINK_STORAGE_KEY);
  return value && isUuid(value) ? value : null;
}

export function rememberMyDrink(id: string) {
  if (!isUuid(id)) return;
  localStorage.setItem(MY_DRINK_STORAGE_KEY, id);
  window.dispatchEvent(new Event(MY_DRINK_EVENT));
}
