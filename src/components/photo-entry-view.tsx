"use client";

import { useEffect, useId, useState } from "react";
import type { InstagramSize } from "@/lib/instagram-png";
import { savePhotoInstagramPng } from "@/lib/photo-instagram-png";
import { firstName } from "@/lib/first-name";
import { phoneSharesPng } from "@/lib/share-png";
import { formatWhen } from "@/lib/time";

export type OwnerEntry = {
  personName: string;
  drinkName: string;
  photoUrl: string;
  code: string;
  createdAt: string;
  live: boolean;
};

const greenButton =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#274b3a] px-4 text-[15px] font-semibold text-[#f3f2ef] disabled:opacity-50";
const outlineButton =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#274b3a]/25 bg-white px-4 text-[15px] font-semibold text-[#274b3a] disabled:opacity-50";

export function PhotoEntryView({
  mode,
  personName,
  drinkName,
  photoUrl,
  voteCount,
  createdAt,
  entryPath,
  live = true,
  voted = false,
  votePending = false,
  voteError = null,
  onBack,
  onVote,
  onEnter,
}: {
  mode: "owner" | "visitor";
  personName: string;
  drinkName: string;
  photoUrl: string;
  voteCount: number;
  createdAt: string;
  entryPath: string;
  live?: boolean;
  voted?: boolean;
  votePending?: boolean;
  voteError?: string | null;
  onBack?: () => void;
  onVote?: () => void;
  onEnter?: () => void;
}) {
  const linkId = useId();
  const name = firstName(personName) || "Someone";
  const drink = drinkName.trim();
  const [href, setHref] = useState(entryPath);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [download, setDownload] = useState<InstagramSize | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setHref(new URL(entryPath, window.location.origin).toString());
  }, [entryPath]);

  useEffect(() => {
    if (!copied && !shareNote) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
      setShareNote(null);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [copied, shareNote]);

  async function copyLink(): Promise<boolean> {
    try {
      if (typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(href);
        setCopied(true);
        setCopyFailed(false);
        setActionError(null);
        return true;
      }
    } catch {
      // Some browsers block the clipboard API. The field copy below still works.
    }
    if (copyWithField(href)) {
      setCopied(true);
      setCopyFailed(false);
      setActionError(null);
      return true;
    }
    setCopied(false);
    setCopyFailed(true);
    setActionError("Couldn't copy the link. Select it below.");
    return false;
  }

  async function shareLink() {
    const title = mode === "owner" ? "Vote for my Urban Grind photo" : `Vote for ${name}'s Urban Grind photo`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: title, url: href });
        return;
      } catch (error) {
        if (shareWasClosed(error)) return;
      }
    }
    const ok = await copyLink();
    if (ok) setShareNote("Link copied");
  }

  async function save(size: InstagramSize) {
    if (download) return;
    setDownload(size);
    setActionError(null);
    const share = phoneSharesPng();
    try {
      await savePhotoInstagramPng({ personName, drinkName: drink || "Your drink", photoUrl }, size, share);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : share ? "The picture didn't share." : "The picture didn't save.");
    } finally {
      setDownload(null);
    }
  }

  const headline = mode === "owner" ? "You're entered!" : `Vote for ${name}`;
  const subtitle =
    mode === "owner"
      ? live
        ? "Your photo is live. Share it to get votes."
        : "We'll put your photo up after a look. Share it to get votes."
      : `Help ${name} win free coffee for a month.`;
  const votes = `${voteCount} ${voteCount === 1 ? "vote" : "votes"}`;
  const when = uploadedLabel(createdAt);

  return (
    <article className="flex flex-col pb-2">
      {onBack ? (
        <button type="button" onClick={onBack} className="mb-3 inline-flex w-fit items-center gap-1 text-sm font-semibold text-[#274b3a]">
          <Chevron />
          Top picks
        </button>
      ) : null}
      <h1 className="font-heading text-[1.7rem] leading-none tracking-wide uppercase">{headline}</h1>
      <p className="mt-2 text-sm text-[#274b3a]/75">{subtitle}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt={drink ? `${drink} by ${name}` : `Photo by ${name}`}
        className="mt-4 aspect-[4/5] w-full rounded-2xl bg-[#e7e4de] object-cover"
      />
      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_10px_28px_rgb(39_75_58/0.06)]">
        <div className="min-w-0">
          <p className="truncate text-lg leading-tight font-bold">{name}</p>
          {drink ? <p className="truncate text-sm text-[#274b3a]/65">{drink}</p> : null}
        </div>
        <p className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold">
          <Heart />
          {votes}
        </p>
      </div>

      {mode === "owner" ? (
        <div className="mt-4 flex flex-col gap-2.5">
          <button type="button" className={greenButton} onClick={() => void shareLink()}>
            <ShareArrow />
            Share my entry
          </button>
          <p className="text-center text-sm text-[#274b3a]/70">{shareNote ?? "Send your link to friends to get votes."}</p>
          <button type="button" className={outlineButton} onClick={() => void copyLink()}>
            {copied ? "Copied" : "Copy voting link"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={outlineButton} disabled={download !== null} onClick={() => void save("story")}>
              {download === "story" ? "Saving…" : "Download story"}
            </button>
            <button type="button" className={outlineButton} disabled={download !== null} onClick={() => void save("square")}>
              {download === "square" ? "Saving…" : "Download post"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          <button
            type="button"
            className={greenButton}
            disabled={!onVote || votePending || voted}
            aria-pressed={voted}
            onClick={onVote}
          >
            <Heart />
            {votePending ? "Saving…" : voted ? "Voted" : "Vote for this photo"}
          </button>
          {voteError ? (
            <p role="alert" className="text-center text-sm text-[#8b2e2e]">
              {voteError}
            </p>
          ) : null}
          <button type="button" className={outlineButton} onClick={() => void shareLink()}>
            <ShareArrow />
            {shareNote ?? "Share this photo"}
          </button>
          <div className="pt-1 text-center text-sm text-[#274b3a]/75">
            <p>Got a great Urban Grind photo?</p>
            <button type="button" onClick={onEnter} className="mt-1 font-semibold text-[#274b3a] underline underline-offset-2">
              Enter your photo →
            </button>
          </div>
        </div>
      )}

      {actionError ? (
        <p role="alert" className="mt-2 text-center text-sm text-[#8b2e2e]">
          {actionError}
        </p>
      ) : null}
      {copyFailed ? (
        <input
          id={linkId}
          readOnly
          value={href}
          aria-label="Voting link"
          onFocus={(event) => event.currentTarget.select()}
          className="mt-2 h-11 w-full rounded-full border border-[#d5d1c9] bg-white px-4 text-sm"
        />
      ) : null}
      {when ? (
        <p className="mt-4 text-sm text-[#274b3a]/55">
          <time dateTime={createdAt}>{when}</time>
        </p>
      ) : null}
    </article>
  );
}

function copyWithField(value: string): boolean {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.left = "0";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.focus();
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  field.remove();
  return copied;
}

function uploadedLabel(iso: string): string {
  const when = formatWhen(iso);
  if (!when) return "";
  if (when === "Just now") return "Uploaded just now";
  return `Uploaded ${when}`;
}

function shareWasClosed(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error)) return false;
  const name = (error as { name: unknown }).name;
  return name === "AbortError" || name === "InvalidStateError";
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ShareArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

function Heart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 20.2s-6.6-4.1-6.6-8.6C5.4 8.7 7.1 7 9.3 7c1.2 0 2.3.6 2.7 1.5.4-.9 1.5-1.5 2.7-1.5 2.2 0 3.9 1.7 3.9 4.6 0 4.5-6.6 8.6-6.6 8.6z" />
    </svg>
  );
}
