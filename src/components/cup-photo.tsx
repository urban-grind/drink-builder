import type { PublicDrink } from "@/lib/types";

export function CupPhoto({ drink, className }: { drink: PublicDrink; className?: string }) {
  return <img src={drink.photoUrl} alt="" className={className} />;
}
