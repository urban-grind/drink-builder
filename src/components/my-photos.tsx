"use client";

import { useEffect, useId, useState } from "react";
import { PhotoShare } from "@/components/photo-share";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { firstName, photoEntryPath } from "@/lib/first-name";
import { rememberMyPhoto } from "@/lib/local-votes";
import type { OwnedPhoto } from "@/lib/photo-types";

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function splitContact(value: string): { email: string; phone: string } {
  const trimmed = value.trim();
  if (!trimmed) return { email: "", phone: "" };
  if (trimmed.includes("@")) return { email: trimmed, phone: "" };
  return { email: "", phone: trimmed };
}

export function MyPhotos({
  voterId,
  ids,
  onUpload,
}: {
  voterId: string;
  ids: string[];
  onUpload: () => void;
}) {
  const contactId = useId();
  const [photos, setPhotos] = useState<OwnedPhoto[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contact, setContact] = useState("");
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

  const selected = photos.find((photo) => photo.id === selectedId) ?? null;

  async function findPhotos() {
    const parsed = splitContact(contact);
    if (!parsed.email && !parsed.phone) {
      setLookup("error");
      setLookupError("Add an email or a phone number.");
      return;
    }
    setLookup("working");
    setLookupError("");
    try {
      const data = await requestJson<{ photos: OwnedPhoto[] }>("/api/photos/mine", {
        method: "POST",
        body: JSON.stringify({ voterId, ...parsed }),
      });
      for (const photo of data.photos) rememberMyPhoto(photo.id);
      setLookup(data.photos.length === 0 ? "empty" : "idle");
      if (data.photos.length > 0) setContact("");
    } catch (caught) {
      setLookup("error");
      setLookupError(caught instanceof ApiRequestError ? caught.message : "Those photos didn't load. Try again.");
    }
  }

  if (selected) {
    return (
      <div className="mx-auto flex w-full max-w-[26rem] flex-col gap-4 px-5 py-4 md:max-w-3xl md:px-10">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="self-start text-sm font-semibold text-[#274b3a]"
        >
          Back to my photos
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={selected.imageUrl}
          alt={selected.drinkName}
          className="w-full rounded-2xl bg-white object-contain shadow-[0_16px_40px_rgb(39_75_58/0.06)]"
        />
        <div className="flex flex-col gap-3 rounded-2xl bg-white px-5 py-6 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
          <h1 className="font-heading text-4xl text-balance">{selected.drinkName}</h1>
          <p>{firstName(selected.personName)}</p>
          {selected.status === "pending" ? (
            <p className="text-sm text-[#274b3a]/70">Waiting for approval before it joins the public board. You can still share it.</p>
          ) : null}
          {selected.caption ? <p className="text-pretty">{selected.caption}</p> : null}
          <PhotoShare
            personName={selected.personName}
            drinkName={selected.drinkName}
            photoUrl={selected.imageUrl}
            entryPath={photoEntryPath(selected.code)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[26rem] flex-col gap-5 px-5 py-4 md:max-w-xl md:px-10">
      <div>
        <h1 className="text-center font-heading text-[1.75rem] leading-none tracking-wide uppercase">My Photos</h1>
        <p className="mt-2 text-center text-sm text-[#274b3a]/75">Photos entered from this phone.</p>
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
          {photos.map((photo) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setSelectedId(photo.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-2 text-left shadow-[0_10px_24px_rgb(39_75_58/0.05)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{photo.drinkName}</span>
                  <span className="mt-0.5 block text-sm text-[#274b3a]/70">
                    {shortDate(photo.createdAt)}
                    {photo.status === "pending" ? " · Waiting for approval" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {status === "ready" && photos.length === 0 ? (
        <p className="text-center text-sm text-[#274b3a]/75">No photos on this phone yet.</p>
      ) : null}

      <Button type="button" onClick={onUpload} className="h-12 rounded-full bg-[#274b3a] text-[#f3f2ef]">
        Upload a photo
      </Button>

      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void findPhotos();
        }}
      >
        <label htmlFor={contactId} className="text-sm font-semibold">
          Don&apos;t see your photos? Sign in with your email or phone number.
        </label>
        <input
          id={contactId}
          name="contact"
          value={contact}
          onChange={(event) => {
            setContact(event.target.value);
            setLookup("idle");
          }}
          autoComplete="on"
          className="h-12 rounded-full border border-[#d5d1c9] bg-white px-4 text-sm"
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
