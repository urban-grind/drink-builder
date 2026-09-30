"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import {
  PHOTO_CAPTION_MAX,
  PHOTO_MAX_BYTES,
  PHOTO_NAME_MAX,
  normalizePhotoType,
  validatePhotoEntry,
} from "@/lib/photo-validation";
import type { FieldErrors } from "@/lib/types";

const fieldIds: Record<string, string> = {
  photo: "photo-file",
  personName: "photo-person-name",
  email: "photo-email",
  drinkName: "photo-drink-name",
  caption: "photo-caption",
};

export function PhotoEntryForm() {
  const captionHelpId = useId();
  const emailHelpId = useId();
  const [personName, setPersonName] = useState("");
  const [email, setEmail] = useState("");
  const [drinkName, setDrinkName] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadsEnabled, setUploadsEnabled] = useState<boolean | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "preparing">("idle");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ uploadsEnabled?: boolean }>("/api/photos", { signal: controller.signal })
      .then((data) => setUploadsEnabled(data.uploadsEnabled === true))
      .catch(() => setUploadsEnabled(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, [previewRef]);

  function focusFirst(nextFields: FieldErrors) {
    const first = Object.keys(fieldIds).find((key) => nextFields[key]);
    if (!first) return;
    document.getElementById(fieldIds[first])?.focus();
  }

  function onFile(next: File | null) {
    setFile(next);
    setUploadId(null);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = next ? URL.createObjectURL(next) : null;
    previewRef.current = url;
    setPreview(url);
    setFields((current) => {
      const copy = { ...current };
      delete copy.photo;
      return copy;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const nextFields: FieldErrors = {};
    if (!file) nextFields.photo = "Choose a photo of the drink.";
    else if (file.size > PHOTO_MAX_BYTES) nextFields.photo = "That photo is over 25MB. Use a smaller one.";
    else if (!normalizePhotoType(file.type, file.name)) {
      nextFields.photo = "Use a JPEG, PNG, WebP, or HEIC photo.";
    }

    const parsed = validatePhotoEntry({ personName, email, drinkName, caption });
    if (!parsed.ok) Object.assign(nextFields, parsed.fields);
    if (!file || Object.keys(nextFields).length > 0 || !parsed.ok) {
      setFields(nextFields);
      const messages = [...new Set(Object.values(nextFields))];
      setFormError(messages.length === 1 ? messages[0] : "Check the fields below and try again.");
      focusFirst(nextFields);
      return;
    }

    if (uploadsEnabled === false) {
      setFormError("Photo uploads aren't available right now.");
      return;
    }

    setPending(true);
    setFormError(null);
    setFields({});
    try {
      let currentUpload = uploadId;
      const contentType = normalizePhotoType(file.type, file.name);
      if (!contentType) throw new ApiRequestError("VALIDATION", "Use a JPEG, PNG, WebP, or HEIC photo.");

      if (!currentUpload) {
        setPhase("uploading");
        const presign = await requestJson<{ uploadId: string; uploadUrl: string; contentType: string }>(
          "/api/photos/upload",
          {
            method: "POST",
            body: JSON.stringify({ contentType, contentLength: file.size, fileName: file.name }),
          },
        );
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "content-type": presign.contentType },
        });
        if (!put.ok) {
          throw new ApiRequestError("UPLOAD_FAILED", "The photo didn't upload. Try again.");
        }
        currentUpload = presign.uploadId;
        setUploadId(presign.uploadId);
      }

      setPhase("preparing");
      await requestJson<{ id: string }>("/api/photos", {
        method: "POST",
        body: JSON.stringify({
          uploadId: currentUpload,
          personName: parsed.value.personName,
          email: parsed.value.email,
          drinkName: parsed.value.drinkName,
          caption: parsed.value.caption,
        }),
      });
      setDone(true);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const next = error.fields ?? {};
        if (error.code === "EMAIL_IN_USE") next.email = error.message;
        if (error.code === "PHOTOS_UNAVAILABLE") setUploadsEnabled(false);
        setFields(next);
        setFormError(error.message);
        focusFirst(next);
      } else {
        setFormError("The photo didn't go through. Try again.");
      }
      setPending(false);
      setPhase("idle");
    }
  }

  if (done) {
    return (
      <div className="ug-board rounded-2xl bg-white px-5 py-10 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <h1 className="text-4xl">The cafe has your photo</h1>
        <p className="mt-3 max-w-lg text-pretty">
          {drinkName.trim() || "Your drink"} stays off the board until they approve it. Your email is stored and is
          not shown with the photo.
        </p>
        <Link href="/photos" className="mt-6 inline-block text-sm underline-offset-4 hover:underline">
          Back to the photos
        </Link>
      </div>
    );
  }

  const buttonLabel = phase === "uploading" ? "Uploading…" : phase === "preparing" ? "Preparing…" : "Submit photo";

  return (
    <form className="ug-board flex flex-col gap-6" noValidate aria-busy={pending} onSubmit={onSubmit}>
      <div>
        <h1 className="text-4xl sm:text-5xl">Enter a photo</h1>
        <p className="mt-3 max-w-2xl text-pretty">
          JPEG, PNG, WebP, or HEIC. Up to 25MB. One photo per email. A drink you already published on the other board
          does not use this entry. Your email stays off the public board.
        </p>
      </div>

      {uploadsEnabled === false ? (
        <p role="status" className="rounded-2xl bg-white px-4 py-3 text-sm">
          Photo uploads aren&apos;t available right now.
        </p>
      ) : null}

      <div className="grid gap-5 rounded-2xl bg-white p-5 shadow-[0_16px_40px_rgb(39_75_58/0.06)] sm:p-6">
        <div className="grid gap-2">
          <Label htmlFor="photo-file">Photo</Label>
          <input
            id="photo-file"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#274b3a] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
            aria-invalid={Boolean(fields.photo)}
            aria-describedby={fields.photo ? "photo-file-error" : undefined}
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected drink" className="max-h-80 w-full rounded-2xl object-contain" />
          ) : null}
          {fields.photo ? (
            <p id="photo-file-error" role="alert" className="text-sm text-destructive">
              {fields.photo}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="photo-person-name">Your name</Label>
          <Input
            id="photo-person-name"
            name="personName"
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
            maxLength={PHOTO_NAME_MAX}
            autoComplete="name"
            aria-invalid={Boolean(fields.personName)}
            aria-describedby={fields.personName ? "photo-person-error" : undefined}
            placeholder="The name with the photo"
            className="h-11"
          />
          {fields.personName ? (
            <p id="photo-person-error" role="alert" className="text-sm text-destructive">
              {fields.personName}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="photo-email">Email</Label>
          <Input
            id="photo-email"
            name="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            autoComplete="email"
            aria-invalid={Boolean(fields.email)}
            aria-describedby={fields.email ? `photo-email-error ${emailHelpId}` : emailHelpId}
            placeholder="you@example.com"
            className="h-11"
          />
          <p id={emailHelpId} className="text-sm">
            Stored with the photo. Not shown on the board. One photo per email.
          </p>
          {fields.email ? (
            <p id="photo-email-error" role="alert" className="text-sm text-destructive">
              {fields.email}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="photo-drink-name">Drink name</Label>
          <Input
            id="photo-drink-name"
            name="drinkName"
            value={drinkName}
            onChange={(event) => setDrinkName(event.target.value)}
            maxLength={PHOTO_NAME_MAX}
            autoComplete="off"
            aria-invalid={Boolean(fields.drinkName)}
            aria-describedby={fields.drinkName ? "photo-drink-error" : undefined}
            placeholder="What was in the cup"
            className="h-11"
          />
          {fields.drinkName ? (
            <p id="photo-drink-error" role="alert" className="text-sm text-destructive">
              {fields.drinkName}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="photo-caption">Caption</Label>
          <Textarea
            id="photo-caption"
            name="caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={PHOTO_CAPTION_MAX}
            rows={3}
            aria-invalid={Boolean(fields.caption)}
            aria-describedby={fields.caption ? "photo-caption-error photo-caption-help" : captionHelpId}
            placeholder="Optional. A short line about the drink."
            className="min-h-24"
          />
          <p id={captionHelpId} className="text-sm">
            Optional. {PHOTO_CAPTION_MAX} characters.
          </p>
          {fields.caption ? (
            <p id="photo-caption-error" role="alert" className="text-sm text-destructive">
              {fields.caption}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <Button type="submit" disabled={pending || uploadsEnabled === false} className="h-12 rounded-full px-6 text-base">
          {buttonLabel}
        </Button>
      </div>
    </form>
  );
}
