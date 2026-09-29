import { cn } from "@/lib/utils";

/** Reserved frame for a menu image. Renders nothing inside while `image` is empty. */
export function MenuImage({ image, className }: { image: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-11 shrink-0 overflow-hidden rounded-lg",
        image
          ? "bg-secondary ring-1 ring-foreground/10 ring-inset"
          : "border border-dashed border-foreground/30 bg-secondary/80",
        className,
      )}
    >
      {image ? (
        // Menu files are supplied later as plain paths, so this stays a normal image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full object-cover" />
      ) : null}
    </span>
  );
}
