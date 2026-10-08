"use client";

import { useEffect, useId, useState } from "react";
import { ContactField } from "@/components/contact-field";
import { Button } from "@/components/ui/button";
import { ownerPaceLine, ownerStandingLine, showsOnLeaderboard } from "@/lib/photo-standing";
import { VoteBadges } from "@/components/vote-badges";
import { formatStoredPhone, parseTypedContact } from "@/lib/photo-validation";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { rememberMyPhoto } from "@/lib/local-votes";
import type { OwnedPhoto } from "@/lib/photo-types";

export function MyPhotos({
  voterId,
  ids,
  onUpload,
  onOpen,
}: {
  voterId: string;
  ids: string[];
  onUpload: () => void;
  onOpen: (photo: OwnedPhoto) => void;
}) {
  const contactId = useId();
  const [photos, setPhotos] = useState<OwnedPhoto[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [contact, setContact] = useState("");
  const [contactError, setContactError] = useState("");
  const [lookup, setLookup] = useState<"idle" | "working" | "empty" | "error">("idle");
  const [lookupError, setLookupError] = useState("");

  const idKey = ids.join(",");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ voterId });
    if (idKey) params.set("ids", idKey);
    requestJson<{ photos: OwnedPhoto[] }>(`/api/photos/mine?${params.toString()}`, { signal: controller.signal })
      .then((data) => {
        setPhotos(data.photos);
        setStatus("ready");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setLookupError(caught instanceof ApiRequestError ? caught.message : "The photos didn't load. Try again.");
      });
    return () => controller.abort();
  }, [voterId, idKey]);

  function onContact(value: string) {
    setContact(value);
    setLookup("idle");
    if (!contactError) return;
    const parsed = parseTypedContact(value);
    setContactError(!value.trim() || parsed.ok ? "" : parsed.message);
  }

  function onContactBlur() {
    const parsed = parseTypedContact(contact);
    if (!contact.trim()) return;
    if (parsed.ok && parsed.phone) setContact(formatStoredPhone(parsed.phone));
    setContactError(parsed.ok ? "" : parsed.message);
  }

  async function findPhotos() {
    const parsed = parseTypedContact(contact);
    if (!parsed.ok) {
      setLookup("error");
      setContactError(parsed.message);
      setLookupError("");
      return;
    }
    setContactError("");
    setLookup("working");
    setLookupError("");
    try {
      const data = await requestJson<{ photos: OwnedPhoto[] }>("/api/photos/mine", {
        method: "POST",
        body: JSON.stringify({ voterId, email: parsed.email ?? "", phone: parsed.phone ?? "" }),
      });
      for (const photo of data.photos) rememberMyPhoto(photo.id);
      setLookup(data.photos.length === 0 ? "empty" : "idle");
      if (data.photos.length > 0) setContact("");
    } catch (caught) {
      setLookup("error");
      setLookupError(caught instanceof ApiRequestError ? caught.message : "Those photos didn't load. Try again.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[26rem] flex-col gap-5 px-5 py-4 md:max-w-xl md:px-10">
      <div>
        <h1 className="text-center font-heading text-[1.75rem] leading-none tracking-wide uppercase">My Entries</h1>
        <p className="mt-2 text-center text-sm text-[#274b3a]/75">Photos you've entered in the contest.</p>
      </div>

      {status === "loading" ? (
        <div role="status" className="grid gap-3">
          <p className="sr-only">Loading your photos</p>
          <div className="h-20 animate-pulse rounded-2xl bg-white" />
          <div className="h-20 animate-pulse rounded-2xl bg-white" />
        </div>
      ) : null}

      {status === "error" ? (
        <p role="alert" className="text-center text-sm">
          {lookupError}
        </p>
      ) : null}

      {status === "ready" && photos.length > 0 ? (
        <ul className="grid gap-3">
          {photos.map((photo) => {
            const pace = ownerPaceLine({
              voteCount: photo.voteCount,
              votesToday: photo.votesToday,
              daysLive: photo.daysLive,
            });
            return (
            <li key={photo.id} className="rounded-2xl bg-white p-2 shadow-[0_10px_24px_rgb(39_75_58/0.05)]">
              <button
                type="button"
                onClick={() => onOpen(photo)}
                className="flex w-full items-center gap-3 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{photo.drinkName}</span>
                  {photo.status === "approved" && showsOnLeaderboard(photo.rank) ? (
                    <span className="mt-0.5 block text-sm font-semibold text-[#274b3a]">You're on the leaderboard</span>
                  ) : null}
                  <span className="mt-0.5 block text-sm text-[#274b3a]/70">
                    {ownerStandingLine({
                      live: photo.status === "approved",
                      voteCount: photo.voteCount,
                      rank: photo.rank,
                      votesFromFirst: photo.votesFromFirst,
                    })}
                  </span>
                  {pace ? <span className="mt-0.5 block text-sm font-semibold text-[#274b3a]">{pace}</span> : null}
                </span>
              </button>
              <VoteBadges voteCount={photo.voteCount} />
            </li>
            );
          })}
        </ul>
      ) : null}

      {status === "ready" && photos.length === 0 ? (
        <p className="text-center text-sm text-[#274b3a]/75">No photos on this phone yet.</p>
      ) : null}

      <Button type="button" onClick={onUpload} className="h-12 rounded-full bg-[#274b3a] text-[#f3f2ef]">
        Upload a new photo
      </Button>

      <form
        className="mt-8 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void findPhotos();
        }}
      >
        <ContactField
          id={contactId}
          label="Don't see your entries? Sign in with your email or phone number."
          value={contact}
          onChange={onContact}
          onBlur={onContactBlur}
          error={contactError}
        />
        {lookup === "empty" ? <p className="text-sm text-[#274b3a]/75">No photos for that email or phone.</p> : null}
        {lookup === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {lookupError}
          </p>
        ) : null}
        <Button type="submit" variant="outline" disabled={lookup === "working"} className="h-11 rounded-full">
          {lookup === "working" ? "Looking…" : "Find my photos"}
        </Button>
      </form>
    </div>
  );
}
