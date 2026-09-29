"use client";

import { useId } from "react";
import { ChoiceButton } from "@/components/choice-button";
import type { MenuItem } from "@/lib/menu";

export function ExtraGroup({
  id,
  legend,
  items,
  selected,
  limit,
  replace = false,
  lockUnselected = false,
  locked = false,
  hint,
  error,
  onToggle,
}: {
  id: string;
  legend: string;
  items: readonly MenuItem[];
  selected: string[];
  limit: number;
  /** When set, choosing another item replaces the current one instead of locking the group. */
  replace?: boolean;
  /** Unselected items stay off even when the group is under its own limit. */
  lockUnselected?: boolean;
  /** Every button stays visible and cannot be clicked. */
  locked?: boolean;
  hint?: string;
  error?: string;
  onToggle: (itemId: string) => void;
}) {
  const hintId = useId();
  const errorId = useId();
  const atLimit = lockUnselected || (!replace && selected.length >= limit);
  const hintText =
    hint ??
    (replace
      ? "Pick one. Choosing another replaces it. None is fine."
      : atLimit
        ? `That's ${selected.length} of ${limit}. Remove one to change it.`
        : limit === 1
          ? "Choose up to 1. None is fine."
          : `Choose up to ${limit}. None is fine.`);

  return (
    <fieldset id={id} tabIndex={-1} className="scroll-mt-24 rounded-2xl outline-none">
      <legend className="font-heading text-2xl">{legend}</legend>
      <p id={hintId} className="mt-1 text-sm text-muted-foreground">
        {hintText}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label={legend}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
      >
        {items.map((item) => {
          const pressed = selected.includes(item.id);
          return (
            <ChoiceButton
              key={item.id}
              name={item.name}
              image={item.image}
              pressed={pressed}
              disabled={locked || (!pressed && atLimit)}
              describedBy={hintId}
              onClick={() => onToggle(item.id)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
