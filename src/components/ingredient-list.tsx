import { MenuImage } from "@/components/menu-image";
import { selectedItems } from "@/lib/recipe";
import type { RecipeSelection } from "@/lib/types";
import { cn } from "@/lib/utils";

export function IngredientList({
  recipe,
  className,
}: {
  recipe: RecipeSelection;
  className?: string;
}) {
  const items = selectedItems(recipe);
  if (items.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-background py-1 pr-3 pl-1 text-sm text-foreground"
        >
          <MenuImage image={item.image} className="size-8 rounded-full" />
          <span className="truncate">{item.name}</span>
        </li>
      ))}
    </ul>
  );
}
