"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contactLooksLikeEmail } from "@/lib/photo-validation";

export function ContactField({
  id,
  label = "Phone or email",
  value,
  onChange,
  onBlur,
  error,
  hint,
  hintId,
  className,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  hintId?: string;
  className?: string;
}) {
  const trimmed = value.trim();
  const email = contactLooksLikeEmail(trimmed);
  const describedBy = [error ? `${id}-error` : "", hint && hintId ? hintId : ""].filter(Boolean).join(" ");

  return (
    <div className="grid gap-1.5" onBlur={onBlur}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name="contact"
        value={value}
        inputMode={!trimmed ? "text" : email ? "email" : "tel"}
        autoComplete={!trimmed ? "off" : email ? "email" : "tel"}
        maxLength={254}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        placeholder="705-555-0199 or name@email.com"
        className={className}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && hintId ? (
        <p id={hintId} className="text-sm text-[#274b3a]/55">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
