"use client";

import { useEffect, useId, useState } from "react";
import type { InstagramSize } from "@/lib/instagram-png";
import { savePhotoInstagramPng } from "@/lib/photo-instagram-png";
import { phoneSharesPng } from "@/lib/share-png";
import { firstName } from "@/lib/first-name";
import { ownerStandingLine } from "@/lib/photo-standing";
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
  rank = null,
  votesFromTopTwo = null,
  entryPath,
  live = true,
  voted = false,
  votePending = false,
  voteError = null,
  onBack,
  backLabel = "Top picks",
  onVote,
  onEnter,
}: {
  mode: "owner" | "visitor";
  personName: string;
  drinkName: string;
  photoUrl: string;
  voteCount: number;
  rank?: number | null;
  votesFromTopTwo?: number | null;
  createdAt: string;
  entryPath: string;
  live?: boolean;
  voted?: boolean;
  votePending?: boolean;
  voteError?: string | null;
  onBack?: () => void;
  backLabel?: string;
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
  const [sharing, setSharing] = useState(false);
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
    const share = phoneSharesPng();
    setDownload(size);
    setSharing(share);
    setActionError(null);
    try {
      await savePhotoInstagramPng({ personName, drinkName: drink || "Your drink", photoUrl }, size, share);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : share ? "The picture didn't share." : "The picture didn't save.",
      );
    } finally {
      setDownload(null);
      setSharing(false);
    }
  }

  const headline = mode === "owner" ? "You're entered!" : `Vote for ${name}`;
  const subtitle =
    mode === "owner"
      ? live
        ? voteCount === 0
          ? "Share it to get your first votes."
          : "Share it to get more votes."
        : "Waiting for approval. You can still share it."
      : `Help ${name} win free coffee for a month.`;
  const votes = `${voteCount} ${voteCount === 1 ? "vote" : "votes"}`;
  const standing = ownerStandingLine({ live, voteCount, rank, votesFromTopTwo });
  const onPhoto =
    "inline-flex min-h-11 w-full items-center justify-center rounded-full px-2 py-2 text-center text-[13px] font-semibold leading-tight shadow-[0_8px_20px_rgb(0_0_0/0.22)]";
  return (
    <article className="flex flex-col pb-2 md:min-h-0 md:flex-1">
      {onBack ? (
        <button type="button" onClick={onBack} className="mb-3 inline-flex w-fit items-center gap-1 text-sm font-semibold text-[#274b3a]">
          <Chevron />
          {backLabel}
        </button>
      ) : null}
      <h1 className="shrink-0 font-heading text-[1.7rem] leading-tight tracking-wide uppercase text-balance">{headline}</h1>
      <p className="mt-2 shrink-0 text-sm text-[#274b3a]/75">{subtitle}</p>
      <div className="relative mt-4 md:flex md:min-h-0 md:flex-1 md:items-center md:justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={drink ? `${drink} by ${name}` : `Photo by ${name}`}
          className={`aspect-[4/5] w-full rounded-2xl bg-[#e7e4de] object-cover md:h-full md:max-h-full md:w-auto md:max-w-full ${
            mode === "owner" ? "max-h-[calc(100dvh-31rem)]" : "max-h-[calc(100dvh-22rem)]"
          }`}
        />
        {mode === "owner" ? (
          <div className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-2 md:hidden">
            <button
              type="button"
              className={`${onPhoto} gap-1.5 bg-[#274b3a] text-[#f3f2ef]`}
              onClick={() => void shareLink()}
            >
              <ShareArrow />
              {shareNote ?? "Share voting link"}
            </button>
            <button type="button" className={`${onPhoto} bg-white/95 text-[#274b3a]`} onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy voting link"}
            </button>
          </div>
        ) : mode === "visitor" ? (
          <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 md:hidden">
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#274b3a] px-4 text-[15px] font-semibold text-[#f3f2ef] shadow-[0_8px_20px_rgb(0_0_0/0.28)] disabled:opacity-50"
              disabled={!onVote || votePending || voted}
              aria-pressed={voted}
              onClick={onVote}
            >
              <Heart />
              {votePending ? "Saving…" : voted ? "Voted" : "Vote"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/95 px-3 text-[15px] font-semibold text-[#274b3a] shadow-[0_8px_20px_rgb(0_0_0/0.22)]"
                onClick={() => void shareLink()}
              >
                <ShareArrow />
                {shareNote ?? "Share"}
              </button>
              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/95 px-3 text-[15px] font-semibold text-[#274b3a] shadow-[0_8px_20px_rgb(0_0_0/0.22)]"
                onClick={() => void copyLink()}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-3 shrink-0 rounded-2xl bg-white px-4 py-3 shadow-[0_10px_28px_rgb(39_75_58/0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg leading-tight font-bold">{name}</p>
            {drink ? <p className="truncate text-sm text-[#274b3a]/65">{drink}</p> : null}
          </div>
          {mode === "visitor" ? (
            <p className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold">
              <Heart />
              {votes}
            </p>
          ) : null}
        </div>
        {mode === "owner" ? <p className="mt-1 text-sm text-[#274b3a]/75">{standing}</p> : null}
      </div>

      {mode === "owner" ? (
        <div className="mt-3 flex shrink-0 flex-col gap-2">
          <div className="hidden grid-cols-2 gap-2 md:grid">
            <button type="button" className={greenButton} onClick={() => void shareLink()}>
              <ShareArrow />
              {shareNote ?? "Share voting link"}
            </button>
            <button type="button" className={outlineButton} onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy voting link"}
            </button>
          </div>
          <button type="button" className={outlineButton} disabled={download !== null} onClick={() => void save("story")}>
            {download === "story" ? (sharing ? "Sharing…" : "Saving…") : "Download Instagram story"}
          </button>
          <button type="button" className={outlineButton} disabled={download !== null} onClick={() => void save("square")}>
            {download === "square" ? (sharing ? "Sharing…" : "Saving…") : "Download Instagram post"}
          </button>
        </div>
      ) : (
        <div className="mt-4 hidden shrink-0 flex-col gap-2.5 md:flex">
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
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={outlineButton} onClick={() => void shareLink()}>
              <ShareArrow />
              {shareNote ?? "Share"}
            </button>
            <button type="button" className={outlineButton} onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}

      {mode === "visitor" && voteError ? (
        <p role="alert" className="mt-2 text-center text-sm text-[#8b2e2e] md:hidden">
          {voteError}
        </p>
      ) : null}
      {mode === "visitor" && voted ? (
        <div className="mt-6 text-center">
          <p className="text-sm font-semibold text-[#274b3a]">Vote counted</p>
          <button type="button" onClick={onEnter} className="mt-1 text-sm font-semibold text-[#274b3a] underline underline-offset-2">
            Want to win coffee too? Enter your photo
          </button>
        </div>
      ) : null}

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
