"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhotoCropper } from "@/components/photo-cropper";
import { PhotoEntryView, type OwnerEntry } from "@/components/photo-entry-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { useEarlyPhotoUpload } from "@/components/use-early-photo-upload";
import { rememberMyPhoto } from "@/lib/local-votes";
import {
  PHOTO_CAPTION_MAX,
  PHOTO_EMAIL_MAX,
  PHOTO_MAX_BYTES,
  PHOTO_NAME_MAX,
  normalizePhotoType,
  termsAgreementError,
  validatePhotoEntry,
} from "@/lib/photo-validation";
import { roundCrop, type PhotoCrop } from "@/lib/photo-crop";
import { photoEntryPath } from "@/lib/first-name";
import type { FieldErrors } from "@/lib/types";

function splitContact(value: string): { email: string; phone: string } {
  const trimmed = value.trim();
  if (!trimmed) return { email: "", phone: "" };
  if (trimmed.includes("@")) return { email: trimmed, phone: "" };
  return { email: "", phone: trimmed };
}

export function PhotoEntryForm({
  presentation = "page",
  active = true,
  onFinished,
  onBack,
  onEntered,
}: {
  presentation?: "page" | "dialog" | "shell";
  active?: boolean;
  onFinished?: () => void;
  onBack?: () => void;
  onEntered?: (entry: OwnerEntry) => void;
}) {
  const router = useRouter();
  const baseId = useId();
  const captionHelpId = useId();
  const contactHelpId = useId();
  const nameHelpId = useId();
  const fieldIds: Record<string, string> = {
    photo: `${baseId}-file`,
    personName: `${baseId}-name`,
    contact: `${baseId}-contact`,
    email: `${baseId}-email`,
    phone: `${baseId}-phone`,
    drinkName: `${baseId}-drink`,
    caption: `${baseId}-caption`,
    terms: `${baseId}-terms`,
  };
  const [personName, setPersonName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState("");
  const [drinkName, setDrinkName] = useState("");
  const [caption, setCaption] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localPreviewFailed, setLocalPreviewFailed] = useState(false);
  const [frameError, setFrameError] = useState(false);
  const [entryStep, setEntryStep] = useState<"photo" | "crop" | "details">("photo");
  const previewRef = useRef<string | null>(null);
  const cropRef = useRef<PhotoCrop | null>(null);
  const cropTimer = useRef<number | null>(null);
  const uploadIdRef = useRef<string | null>(null);
  const [uploadsEnabled, setUploadsEnabled] = useState<boolean | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<"finishing" | "saving" | null>(null);
  const upload = useEarlyPhotoUpload(active);
  const [saved, setSaved] = useState<OwnerEntry | null>(null);

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
      if (cropTimer.current) window.clearTimeout(cropTimer.current);
    };
  }, [previewRef]);

  function queueCrop(id: string, crop: PhotoCrop) {
    if (cropTimer.current) window.clearTimeout(cropTimer.current);
    cropTimer.current = window.setTimeout(() => {
      void requestJson(`/api/photos/upload/${id}/crop`, {
        method: "POST",
        body: JSON.stringify({ crop }),
      }).catch(() => {
        // Submit sends the same frame again.
      });
    }, 400);
  }

  function onFrame(crop: PhotoCrop) {
    const rounded = roundCrop(crop);
    cropRef.current = rounded;
    const id = uploadIdRef.current;
    if (id) queueCrop(id, rounded);
  }

  useEffect(() => {
    uploadIdRef.current = upload.uploadId;
    if (upload.uploadId && cropRef.current) queueCrop(upload.uploadId, cropRef.current);
  }, [upload.uploadId]);

  function focusFirst(nextFields: FieldErrors) {
    const first = Object.keys(fieldIds).find((key) => nextFields[key]);
    if (!first) return;
    document.getElementById(fieldIds[first])?.focus();
  }

  function onFile(next: File | null) {
    setFile(next);
    cropRef.current = null;
    setLocalPreviewFailed(false);
    setFrameError(false);
    setEntryStep(next ? "crop" : "photo");
    if (cropTimer.current) window.clearTimeout(cropTimer.current);
    upload.clearError();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = next ? URL.createObjectURL(next) : null;
    previewRef.current = url;
    setPreview(url);
    setFields((current) => {
      const copy = { ...current };
      delete copy.photo;
      return copy;
    });
    if (!next) {
      upload.invalidate();
      return;
    }
    if (next.size > PHOTO_MAX_BYTES) {
      upload.invalidate();
      setEntryStep("photo");
      setFields((current) => ({ ...current, photo: "That photo is over 25MB. Use a smaller one." }));
      return;
    }
    if (!normalizePhotoType(next.type, next.name)) {
      upload.invalidate();
      setEntryStep("photo");
      setFields((current) => ({ ...current, photo: "Use a JPEG, PNG, WebP, or HEIC photo." }));
      return;
    }
    if (uploadsEnabled === false) return;
    void upload.start(next);
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

    const entered = presentation === "shell" ? splitContact(contact) : { email, phone };
    const parsed = validatePhotoEntry({ personName, email: entered.email, phone: entered.phone, drinkName, caption });
    if (!parsed.ok) Object.assign(nextFields, parsed.fields);
    if (presentation === "shell" && (nextFields.email || nextFields.phone)) {
      nextFields.contact = nextFields.email || nextFields.phone;
    }
    const terms = termsAgreementError({ agreedToTerms: agreed });
    if (terms) nextFields.terms = terms;
    if (!file || Object.keys(nextFields).length > 0 || !parsed.ok) {
      if (presentation === "shell") setEntryStep(!file || nextFields.photo ? (file ? "crop" : "photo") : "details");
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
        body: JSON.stringify({ email: entered.email, phone: entered.phone }),
      });

      if (uploadsEnabled === false) {
        setFormError("Photo uploads aren't available right now.");
        setPending(false);
        setPhase(null);
        return;
      }

      if (!upload.isReady()) setPhase("finishing");
      const currentUpload = await upload.waitUntilReady();
      setPhase("saving");

      const saved = await requestJson<{ id: string; code?: string; status?: string }>("/api/photos", {
        method: "POST",
        body: JSON.stringify({
          uploadId: currentUpload,
          personName: parsed.value.personName,
          email: parsed.value.email ?? "",
          phone: parsed.value.phone ?? "",
          drinkName: parsed.value.drinkName,
          caption: parsed.value.caption,
          agreedToTerms: true,
          crop: cropRef.current,
        }),
      });
      upload.keep();
      rememberMyPhoto(saved.id);
      const entry: OwnerEntry = {
        personName: parsed.value.personName,
        drinkName: parsed.value.drinkName,
        photoUrl: `/api/photos/${saved.id}/image?variant=vote`,
        code: saved.code || "",
        createdAt: new Date().toISOString(),
        live: saved.status === "approved",
      };
      if (onEntered) {
        onEntered(entry);
        return;
      }
      setSaved(entry);
      setPending(false);
      setPhase(null);
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
        if (error.code === "EMAIL_IN_USE" || error.code === "PHONE_IN_USE" || error.code === "CONTACT_IN_USE") {
          upload.invalidate();
          if (file && uploadsEnabled !== false) void upload.start(file);
        }
        if (presentation === "shell" && (next.email || next.phone)) next.contact = next.email || next.phone;
        setFields(next);
        setFormError(error.message);
        focusFirst(next);
      } else {
        setFormError("The photo didn't go through. Try again.");
      }
      setPending(false);
      setPhase(null);
    }
  }

  if (saved) {
    return (
      <PhotoEntryView
        mode="owner"
        personName={saved.personName}
        drinkName={saved.drinkName}
        photoUrl={saved.photoUrl}
        voteCount={0}
        createdAt={saved.createdAt}
        entryPath={photoEntryPath(saved.code)}
        live={saved.live}
        onBack={() => {
          onFinished?.();
          if (onBack) onBack();
          else router.push("/?picks=1");
        }}
      />
    );
  }

  const buttonLabel =
    phase === "finishing" ? "Finishing your photo" : pending ? "Your photo is going up" : presentation === "shell" ? "Enter the contest" : "Add photo";
  const photoMessage = fields.photo || upload.photoError || (frameError ? "That photo couldn't be framed. Try a JPEG." : undefined);
  const contactMessage = fields.contact || fields.email || fields.phone;
  const serverPreview = localPreviewFailed && upload.uploadId ? `/api/photos/upload/${upload.uploadId}/preview` : null;
  const cropSrc = frameError ? null : serverPreview || (!localPreviewFailed ? preview : null);
  const waitingForFrame = Boolean(file && !cropSrc && !frameError);

  if (presentation === "shell") {
    return (
      <form className="flex flex-col gap-3" noValidate aria-busy={pending} onSubmit={onSubmit}>
        {uploadsEnabled === false ? (
          <p role="status" className="rounded-2xl bg-white px-4 py-3 text-sm">
            Photo uploads aren&apos;t available right now.
          </p>
        ) : null}

        <ol className="flex justify-center gap-3 text-xs font-semibold tracking-wide text-[#274b3a]/35 uppercase">
          {(
            [
              ["photo", "Upload"],
              ["crop", "Frame"],
              ["details", "Enter"],
            ] as const
          ).map(([id, label]) => (
            <li key={id} className={entryStep === id ? "text-[#274b3a]" : undefined} aria-current={entryStep === id ? "step" : undefined}>
              {label}
            </li>
          ))}
        </ol>

        {entryStep !== "photo" && (cropSrc || waitingForFrame) ? (
          cropSrc ? (
            <PhotoCropper
              key={cropSrc}
              src={cropSrc}
              interactive={entryStep === "crop"}
              compact={entryStep === "details"}
              onCrop={onFrame}
              onError={() => {
                if (serverPreview) setFrameError(true);
                else setLocalPreviewFailed(true);
              }}
            />
          ) : (
            <p role="status" className="text-center text-sm">
              Getting your photo ready to frame.
            </p>
          )
        ) : null}

        <label
          htmlFor={fieldIds.photo}
          className={
            entryStep === "photo"
              ? "flex cursor-pointer flex-col items-center justify-center rounded-[1.4rem] border-2 border-dashed border-[#274b3a]/30 px-5 py-8 text-center"
              : entryStep === "crop"
                ? "self-center cursor-pointer text-sm font-semibold text-[#274b3a]"
                : "sr-only"
          }
        >
          <input
            id={fieldIds.photo}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="sr-only"
            aria-invalid={Boolean(photoMessage)}
            aria-describedby={photoMessage ? `${fieldIds.photo}-error` : undefined}
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
          {entryStep === "photo" ? (
            <>
              <PhotoGlyph />
              <span className="mt-3 text-sm text-[#274b3a]/75">Add a photo of your drink.</span>
              <span className="mt-3 inline-flex h-11 items-center rounded-full bg-[#274b3a] px-6 text-sm font-semibold text-[#f3f2ef]">
                Choose a photo
              </span>
            </>
          ) : entryStep === "crop" ? (
            "Change photo"
          ) : (
            "Change photo"
          )}
        </label>
        {upload.uploading && !pending && entryStep !== "details" ? (
          <p role="status" className="text-center text-sm">
            Your photo is going up.
          </p>
        ) : null}
        {photoMessage && entryStep !== "details" ? (
          <p id={`${fieldIds.photo}-error`} role="alert" className="text-center text-sm text-destructive">
            {photoMessage}
          </p>
        ) : null}

        {entryStep === "crop" ? (
          <Button
            type="button"
            disabled={!cropSrc || pending}
            className="h-12 w-full rounded-full bg-[#274b3a] px-6 text-base font-semibold text-[#f3f2ef]"
            onClick={() => {
              setEntryStep("details");
              window.setTimeout(() => document.getElementById(fieldIds.personName)?.focus(), 0);
            }}
          >
            Next
          </Button>
        ) : null}

        {entryStep === "details" ? (
          <button type="button" onClick={() => setEntryStep("crop")} className="self-center text-sm font-semibold text-[#274b3a]">
            Adjust photo
          </button>
        ) : null}

        {entryStep === "details" ? (
        <>
        <p className="text-center text-sm text-[#274b3a]/75">Add your name, and a way to reach you if you win.</p>
        <div className="grid gap-1.5">
          <Label htmlFor={fieldIds.personName}>Your name</Label>
          <Input
            id={fieldIds.personName}
            name="personName"
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
            maxLength={PHOTO_NAME_MAX}
            autoComplete="name"
            aria-invalid={Boolean(fields.personName)}
            aria-describedby={fields.personName ? `${fieldIds.personName}-error ${nameHelpId}` : nameHelpId}
            placeholder="e.g. Elena"
          />
          <p id={nameHelpId} className="text-sm text-[#274b3a]/55">
            This name appears with your photo.
          </p>
          {fields.personName ? (
            <p id={`${fieldIds.personName}-error`} role="alert" className="text-sm text-destructive">
              {fields.personName}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={fieldIds.contact}>Phone or email</Label>
          <Input
            id={fieldIds.contact}
            name="contact"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            maxLength={PHOTO_EMAIL_MAX}
            autoComplete="on"
            aria-invalid={Boolean(contactMessage)}
            aria-describedby={contactMessage ? `${fieldIds.contact}-error ${contactHelpId}` : contactHelpId}
            placeholder="705-555-0199 or name@email.com"
          />
          <p id={contactHelpId} className="text-sm text-[#274b3a]/55">
            Only used to contact you if you win. Kept private.
          </p>
          {contactMessage ? (
            <p id={`${fieldIds.contact}-error`} role="alert" className="text-sm text-destructive">
              {contactMessage}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={fieldIds.drinkName}>Drink (optional)</Label>
          <Input
            id={fieldIds.drinkName}
            name="drinkName"
            value={drinkName}
            onChange={(event) => setDrinkName(event.target.value)}
            maxLength={PHOTO_NAME_MAX}
            autoComplete="off"
            aria-invalid={Boolean(fields.drinkName)}
            aria-describedby={fields.drinkName ? `${fieldIds.drinkName}-error` : undefined}
            placeholder="What did you order?"
          />
          {fields.drinkName ? (
            <p id={`${fieldIds.drinkName}-error`} role="alert" className="text-sm text-destructive">
              {fields.drinkName}
            </p>
          ) : null}
        </div>

        <TermsCheckbox id={fieldIds.terms} checked={agreed} error={fields.terms} onChange={setAgreed} />

        {pending ? (
          <p role="status" className="text-sm font-semibold">
            {phase === "finishing" ? "Finishing your photo." : "Your photo is going up."}
          </p>
        ) : null}

        {formError ? (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <Button type="submit" disabled={pending || uploadsEnabled === false} className="h-12 w-full rounded-full bg-[#274b3a] px-6 text-base font-semibold text-[#f3f2ef]">
          {buttonLabel}
        </Button>
        </>
        ) : null}
        {onBack ? (
          <button type="button" onClick={onBack} className="self-center text-sm font-semibold text-[#274b3a]">
            Back to voting
          </button>
        ) : null}
      </form>
    );
  }

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
            aria-invalid={Boolean(photoMessage)}
            aria-describedby={photoMessage ? `${fieldIds.photo}-error` : undefined}
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
          {cropSrc ? (
            <PhotoCropper
              key={cropSrc}
              src={cropSrc}
              onCrop={onFrame}
              onError={() => {
                if (serverPreview) setFrameError(true);
                else setLocalPreviewFailed(true);
              }}
            />
          ) : waitingForFrame ? (
            <p role="status" className="text-sm">
              Getting your photo ready to frame.
            </p>
          ) : null}
          {upload.uploading && !pending ? (
            <p role="status" className="text-sm">
              Your photo is going up.
            </p>
          ) : null}
          {photoMessage ? (
            <p id={`${fieldIds.photo}-error`} role="alert" className="text-sm text-destructive">
              {photoMessage}
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
          <Label htmlFor={fieldIds.drinkName}>Drink name (optional)</Label>
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

        <TermsCheckbox id={fieldIds.terms} checked={agreed} error={fields.terms} onChange={setAgreed} />

        {pending ? (
          <p role="status" className="text-base font-bold">
            {phase === "finishing" ? "Finishing your photo." : "Your photo is going up."}
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

function TermsCheckbox({
  id,
  checked,
  error,
  onChange,
}: {
  id: string;
  checked: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          name="terms"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#274b3a]"
        />
        <label htmlFor={id} className="text-sm leading-snug text-[#274b3a]">
          I agree to the{" "}
          <Link href="/terms" className="font-semibold underline underline-offset-2">
            terms and conditions
          </Link>.
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PhotoGlyph() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12 text-[#274b3a]/35" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="6" y="10" width="36" height="28" rx="4" />
      <circle cx="17" cy="20" r="3" />
      <path d="M10 33l8-8a3 3 0 0 1 4 0l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
