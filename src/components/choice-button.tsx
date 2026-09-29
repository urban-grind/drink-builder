"use client";

import { MenuImage } from "@/components/menu-image";
import { Button } from "@/components/ui/button";

export function ChoiceButton({
  name,
  image,
  pressed,
  disabled,
  onClick,
  describedBy,
}: {
  name: string;
  image: string;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  describedBy?: string;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      disabled={disabled}
      aria-describedby={describedBy}
      onClick={onClick}
      className="h-auto min-h-11 justify-start gap-2 rounded-full px-1.5 py-1.5 text-left"
    >
      <MenuImage image={image} className="size-9 rounded-full bg-white" />
      <span className="pr-2">{name}</span>
    </Button>
  );
}
