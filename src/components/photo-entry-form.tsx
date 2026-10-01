"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhotoShare } from "@/components/photo-share";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { rememberMyPhoto } from "@/lib/local-votes";
import {
  PHOTO_CAPTION_MAX,
  PHOTO_MAX_BYTES,
  PHOTO_NAME_MAX,
  normalizePhotoType,
  validatePhotoEntry,
} from "@/lib/photo-validation";
import { photoEntryPath } from "@/lib/first-name";
import type { FieldErrors } from "@/lib/types";

export function PhotoEntryForm({
  presentation = "page",
  onFinished,
}: {
  presentation?: "page" | "dialog";
  onFinished?: () => void;
}) {
  const router = useRouter();
  const baseId = useId();
  const captionHelpId = useId();
  const contactHelpId = useId();
  const fieldIds: Record<string, string> = {
    photo: `${baseId}-file`,
    personName: `${baseId}-name`,
    email: `${baseId}-email`,
    phone: `${baseId}-phone`,
    drinkName: `${baseId}-drink`,
    caption: `${baseId}-caption`,
  };
  const [personName, setPersonName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
  const [outcome, setOutcome] = useState<"pending" | "approved" | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

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

    const parsed = validatePhotoEntry({ personName, email, phone, drinkName, caption });
    if (!parsed.ok) Object.assign(nextFields, parsed.fields);
    if (!file || Object.keys(nextFields).length > 0 || !parsed.ok) {
      setFields(nextFields);
      const messages = [...new Set(Object.values(nextFields))];
      setFormError(messages.length === 1 ? messages[0] : "Check the fields below and try again.");
      focusFirst(nextFields);
      return;
    }

    setPending(true);
    setFormError(null);
    setFields({});
    try {
      await requestJson("/api/photos/contact", {
        method: "POST",
        body: JSON.stringify({ email, phone }),
      });

      if (uploadsEnabled === false) {
        setFormError("Photo uploads aren't available right now.");
        setPending(false);
        return;
      }

      let currentUpload = uploadId;
      const contentType = normalizePhotoType(file.type, file.name);
      if (!contentType) throw new ApiRequestError("VALIDATION", "Use a JPEG, PNG, WebP, or HEIC photo.");

      if (!currentUpload) {
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

      const saved = await requestJson<{ id: string; code?: string; status?: string }>("/api/photos", {
        method: "POST",
        body: JSON.stringify({
          uploadId: currentUpload,
          personName: parsed.value.personName,
          email: parsed.value.email ?? "",
          phone: parsed.value.phone ?? "",
          drinkName: parsed.value.drinkName,
          caption: parsed.value.caption,
        }),
      });
      rememberMyPhoto(saved.id);
      if (saved.status === "approved") {
        onFinished?.();
        router.push(photoEntryPath(saved.code || ""));
        return;
      }
      setSavedId(saved.code || "");
      setOutcome("pending");
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const next = error.fields ?? {};
        if (error.code === "EMAIL_IN_USE" && !next.email) next.email = error.message;
        if (error.code === "PHONE_IN_USE" && !next.phone) next.phone = error.message;
        if (error.code === "CONTACT_IN_USE") {
          if (!next.email) next.email = error.message;
          if (!next.phone) next.phone = error.message;
        }
        if (error.code === "PHOTOS_UNAVAILABLE") setUploadsEnabled(false);
        setFields(next);
        setFormError(error.message);
        focusFirst(next);
      } else {
        setFormError("The photo didn't go through. Try again.");
      }
      setPending(false);
    }
  }

  if (outcome && savedId) {
    const drink = drinkName.trim() || "Your drink";
    return (
      <div className="ug-board rounded-2xl bg-white px-5 py-8 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
        <h1 className="text-4xl">Thanks</h1>
        <p className="mt-3 max-w-lg text-pretty">
          We&apos;ll put {drink} up after a look. Your contact stays private. This link is yours.
        </p>
        <div className="mt-6">
          <PhotoShare
            drinkName={drink}
            photoUrl={preview ?? ""}
            entryPath={photoEntryPath(savedId)}
          />
        </div>
        <Link href="/" className="mt-6 inline-block text-sm underline-offset-4 hover:underline">
          Back to the photos
        </Link>
      </div>
    );
  }

  const buttonLabel = pending ? "Your photo is going up" : "Add photo";

  return (
    <form className="ug-board flex flex-col gap-6" noValidate aria-busy={pending} onSubmit={onSubmit}>
      {presentation === "page" ? (
        <div>
          <h1 className="text-4xl sm:text-5xl">Snap yours</h1>
          <p className="mt-3 max-w-2xl text-pretty">The drink in your hand. One photo.</p>
        </div>
      ) : (
        <p className="text-pretty">The drink in your hand. One photo.</p>
      )}

      {uploadsEnabled === false ? (
        <p role="status" className="rounded-2xl bg-white px-4 py-3 text-sm">
          Photo uploads aren&apos;t available right now.
        </p>
      ) : null}

      <div className="grid gap-5 rounded-2xl bg-white p-5 shadow-[0_16px_40px_rgb(39_75_58/0.06)] sm:p-6">
        <div className="grid gap-2">
          <Label htmlFor={fieldIds.photo}>Photo</Label>
          <input
            id={fieldIds.photo}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#274b3a] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
            aria-invalid={Boolean(fields.photo)}
            aria-describedby={fields.photo ? `${fieldIds.photo}-error` : undefined}
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected drink" className="max-h-80 w-full rounded-2xl object-contain" />
          ) : null}
          {fields.photo ? (
            <p id={`${fieldIds.photo}-error`} role="alert" className="text-sm text-destructive">
              {fields.photo}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={fieldIds.personName}>Your name</Label>
          <Input
            id={fieldIds.personName}
            name="personName"
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
            maxLength={PHOTO_NAME_MAX}
            autoComplete="name"
            aria-invalid={Boolean(fields.personName)}
            aria-describedby={fields.personName ? `${fieldIds.personName}-error` : undefined}
            placeholder="Your name"
            className="h-11"
          />
          {fields.personName ? (
            <p id={`${fieldIds.personName}-error`} role="alert" className="text-sm text-destructive">
              {fields.personName}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={fieldIds.email}>Email</Label>
          <Input
            id={fieldIds.email}
            name="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            autoComplete="email"
            aria-invalid={Boolean(fields.email)}
            aria-describedby={fields.email ? `${fieldIds.email}-error ${contactHelpId}` : contactHelpId}
            placeholder="name@email.com"
            className="h-11"
          />
          {fields.email ? (
            <p id={`${fieldIds.email}-error`} role="alert" className="text-sm text-destructive">
              {fields.email}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={fieldIds.phone}>Phone</Label>
          <Input
            id={fieldIds.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={32}
            autoComplete="tel"
            aria-invalid={Boolean(fields.phone)}
            aria-describedby={fields.phone ? `${fieldIds.phone}-error ${contactHelpId}` : contactHelpId}
            placeholder="705-555-0199"
            className="h-11"
          />
          <p id={contactHelpId} className="text-sm">
            Add an email or a phone number. One is enough. We keep it private. It doesn&apos;t show with your photo.
          </p>
          {fields.phone ? (
            <p id={`${fieldIds.phone}-error`} role="alert" className="text-sm text-destructive">
              {fields.phone}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={fieldIds.drinkName}>Drink name</Label>
          <Input
            id={fieldIds.drinkName}
            name="drinkName"
            value={drinkName}
            onChange={(event) => setDrinkName(event.target.value)}
            maxLength={PHOTO_NAME_MAX}
            autoComplete="off"
            aria-invalid={Boolean(fields.drinkName)}
            aria-describedby={fields.drinkName ? `${fieldIds.drinkName}-error` : undefined}
            placeholder="What you ordered"
            className="h-11"
          />
          {fields.drinkName ? (
            <p id={`${fieldIds.drinkName}-error`} role="alert" className="text-sm text-destructive">
              {fields.drinkName}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={fieldIds.caption}>Caption</Label>
          <Textarea
            id={fieldIds.caption}
            name="caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={PHOTO_CAPTION_MAX}
            rows={3}
            aria-invalid={Boolean(fields.caption)}
            aria-describedby={fields.caption ? `${fieldIds.caption}-error ${captionHelpId}` : captionHelpId}
            placeholder="A line about it, if you want"
            className="min-h-24"
          />
          <p id={captionHelpId} className="text-sm">
            Optional.
          </p>
          {fields.caption ? (
            <p id={`${fieldIds.caption}-error`} role="alert" className="text-sm text-destructive">
              {fields.caption}
            </p>
          ) : null}
        </div>

        {pending ? (
          <p role="status" className="text-base font-bold">
            Your photo is going up.
          </p>
        ) : null}

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
