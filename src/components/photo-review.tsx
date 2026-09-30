"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { PhotoStatus, ReviewPhoto } from "@/lib/photo-types";

type ReviewPayload = {
  configured: boolean;
  authenticated: boolean;
  photos: ReviewPhoto[];
};

const groups: { status: PhotoStatus; title: string; empty: string }[] = [
  { status: "pending", title: "Waiting", empty: "Nothing is waiting." },
  { status: "approved", title: "On the board", empty: "Nothing is on the board." },
  { status: "rejected", title: "Rejected", empty: "No rejected photos." },
  { status: "removed", title: "Taken down", empty: "No photos have been taken down." },
];

export function PhotoReview() {
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  async function load() {
    const data = await requestJson<ReviewPayload>("/api/photos/review");
    setPayload(data);
    setStatus("ready");
  }

  useEffect(() => {
    const controller = new AbortController();
    requestJson<ReviewPayload>("/api/photos/review", { signal: controller.signal })
      .then((data) => {
        setPayload(data);
        setStatus("ready");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The review list didn't load.");
      });
    return () => controller.abort();
  }, []);

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await requestJson("/api/photos/review/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That password didn't work.");
    } finally {
      setPending(false);
    }
  }

  async function act(photo: ReviewPhoto, action: "approve" | "reject" | "remove") {
    if (action === "remove" && !window.confirm(`Take “${photo.drinkName}” off the board?`)) return;
    if (action === "reject" && !window.confirm(`Reject “${photo.drinkName}”? It stays off the board.`)) return;
    setError(null);
    try {
      await requestJson(`/api/photos/${photo.id}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The review didn't save.");
    }
  }

  async function logout() {
    await requestJson("/api/photos/review/logout", { method: "POST", body: JSON.stringify({}) });
    setPayload({ configured: true, authenticated: false, photos: [] });
  }

  if (status === "loading") {
    return (
      <div role="status" className="ug-board">
        <p className="sr-only">Loading photo review</p>
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="ug-board rounded-2xl bg-white px-5 py-8">
        <h1 className="text-3xl">Photo review didn&apos;t load</h1>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  if (!payload?.configured) {
    return (
      <div className="ug-board rounded-2xl bg-white px-5 py-10">
        <h1 className="text-4xl">Photo review</h1>
        <p className="mt-3 max-w-lg">Photo review is not set up.</p>
      </div>
    );
  }

  if (!payload.authenticated) {
    return (
      <form className="ug-board mx-auto flex max-w-md flex-col gap-4 rounded-2xl bg-white px-5 py-8" onSubmit={onLogin}>
        <h1 className="text-4xl">Photo review</h1>
        <p>Enter the cafe password to approve or reject photos.</p>
        <div className="grid gap-2">
          <Label htmlFor="review-password">Password</Label>
          <Input
            id="review-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="h-11 rounded-full px-4">
          {pending ? "Checking…" : "Open review"}
        </Button>
      </form>
    );
  }

  return (
    <div className="ug-board flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Photo review</h1>
          <p className="mt-2 max-w-xl text-pretty">
            Pending photos stay off the public board. Email is listed here and nowhere else.
          </p>
        </div>
        <Button type="button" onClick={() => void logout()} className="h-11 rounded-full px-4">
          Sign out
        </Button>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-white px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {groups.map((group) => {
        const photos = payload.photos.filter((photo) => photo.status === group.status);
        return (
          <section key={group.status} aria-labelledby={`review-${group.status}`} className="flex flex-col gap-4">
            <h2 id={`review-${group.status}`} className="text-3xl">
              {group.title}
            </h2>
            {photos.length === 0 ? <p className="text-sm">{group.empty}</p> : null}
            <ul className="grid list-none grid-cols-1 gap-4 lg:grid-cols-2">
              {photos.map((photo) => (
                <li key={photo.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.imageUrl}
                    alt={`${photo.drinkName} by ${photo.personName}`}
                    className="max-h-80 w-full rounded-xl object-contain"
                  />
                  <h3 className="text-2xl">{photo.drinkName}</h3>
                  <p>{photo.personName}</p>
                  <p className="text-sm">
                    <span className="font-bold">Email </span>
                    {photo.email}
                  </p>
                  {photo.caption ? <p className="text-pretty text-sm">{photo.caption}</p> : null}
                  <p className="text-sm">
                    {photo.voteCount} {photo.voteCount === 1 ? "vote" : "votes"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {photo.status !== "approved" ? (
                      <Button type="button" className="h-11 rounded-full px-4" onClick={() => void act(photo, "approve")}>
                        Approve
                      </Button>
                    ) : null}
                    {photo.status === "pending" ? (
                      <Button type="button" className="h-11 rounded-full px-4" onClick={() => void act(photo, "reject")}>
                        Reject
                      </Button>
                    ) : null}
                    {photo.status === "approved" ? (
                      <Button type="button" className="h-11 rounded-full px-4" onClick={() => void act(photo, "remove")}>
                        Take down
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
