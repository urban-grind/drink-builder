"use client";

import { useEffect, useRef, useState } from "react";
import { ContactField } from "@/components/contact-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { parseTypedContact, PHOTO_NAME_MAX } from "@/lib/photo-validation";
import type { FieldErrors } from "@/lib/types";

export function DrawEntryDialog({
  open,
  required = false,
  voterId,
  onDismiss,
  onSaved,
}: {
  open: boolean;
  required?: boolean;
  voterId: string;
  onDismiss: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const closedBy = useRef<"dismiss" | "saved">("dismiss");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setContact("");
    setFields({});
    setFormError("");
    setPending(false);
    const id = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open]);

  function dismiss() {
    if (pending) return;
    closedBy.current = "dismiss";
    onDismiss();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseTypedContact(contact);
    const nextFields: FieldErrors = {};
    if (!name.trim()) nextFields.personName = "Add your name.";
    if (!parsed.ok) nextFields.contact = parsed.message;
    if (Object.keys(nextFields).length > 0) {
      setFields(nextFields);
      setFormError("");
      return;
    }
    setPending(true);
    setFields({});
    setFormError("");
    try {
      await requestJson("/api/photos/draw", {
        method: "POST",
        body: JSON.stringify({
          voterId,
          personName: name,
          email: parsed.email ?? "",
          phone: parsed.phone ?? "",
        }),
      });
      closedBy.current = "saved";
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setFields(caught.fields ?? {});
        setFormError(caught.fields?.personName || caught.fields?.contact ? "" : caught.message);
      } else {
        setFormError("That didn't save. Try again.");
      }
      setPending(false);
    }
  }

  const sheet = (
        <form
          noValidate
          aria-busy={pending}
          onSubmit={(event) => void onSubmit(event)}
          className="max-h-[70dvh] w-full overflow-y-auto rounded-t-3xl bg-[#f7f4ec] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6"
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#274b3a]/15 sm:hidden" />
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="draw-entry-title" className="text-xl font-semibold text-[#274b3a]">
              {required ? "Sign up to keep swiping" : "You're in the draw"}
            </h2>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#274b3a]"
            >
              <CloseMark />
            </button>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-[#274b3a]/80">
            {required
              ? "Add your name and an email or phone to keep swiping. Saving signs you up so Urban Grind can contact you."
              : "Every swipe is one entry. Add your name and an email or phone. Saving signs you up so Urban Grind can contact you."}
          </p>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="draw-entry-name">Your name</Label>
              <Input
                ref={nameRef}
                id="draw-entry-name"
                name="personName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={PHOTO_NAME_MAX}
                autoComplete="name"
                enterKeyHint="next"
                aria-invalid={Boolean(fields.personName)}
                aria-describedby={fields.personName ? "draw-entry-name-error" : undefined}
                placeholder="e.g. Elena"
                className="text-base md:text-base"
              />
              {fields.personName ? (
                <p id="draw-entry-name-error" role="alert" className="text-sm text-destructive">
                  {fields.personName}
                </p>
              ) : null}
            </div>
            <ContactField
              id="draw-entry-contact"
              label="Email or phone"
              value={contact}
              onChange={setContact}
              error={fields.contact || fields.email || fields.phone}
              hint="Kept private. It does not show on the site."
              hintId="draw-entry-contact-hint"
              className="text-base md:text-base"
            />
          </div>
          {formError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 h-12 w-full rounded-full bg-[#274b3a] px-6 text-base font-semibold text-[#f3f2ef] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save my entries"}
          </button>
          {required ? null : (
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            className="mt-2 h-12 w-full rounded-full text-base font-semibold text-[#274b3a] disabled:opacity-60"
          >
            Not now
          </button>
          )}
        </form>
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="draw-entry-title"
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-[#274b3a]/45"
      onClose={() => {
        if (closedBy.current === "saved") {
          closedBy.current = "dismiss";
          return;
        }
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        className="flex h-full items-end justify-center sm:items-center sm:p-6"
        onClick={(event) => {
          if (event.target === event.currentTarget) dismiss();
        }}
      >
        {sheet}
      </div>
    </dialog>
  );
}

function CloseMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
