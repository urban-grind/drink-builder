"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PhotoEntryForm } from "@/components/photo-entry-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { emptyContestReport, type ContestReport } from "@/lib/contest-report";
import type { PersonRecord } from "@/lib/people";
import { formatStoredPhone } from "@/lib/photo-validation";
import type { PhotoStatus, ReviewPhoto } from "@/lib/photo-types";

type ReviewPayload = {
  configured: boolean;
  authenticated: boolean;
  photos: ReviewPhoto[];
  people: PersonRecord[];
  activity: ContestReport;
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
  const [adding, setAdding] = useState(false);
  const [addedNote, setAddedNote] = useState<string | null>(null);
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
    setPayload({ configured: true, authenticated: false, photos: [], people: [], activity: emptyContestReport() });
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
        <p>Enter the cafe password to see entries and add your own. This stays off the public site.</p>
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
            Pending photos stay off the public board. The people list stays on this page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              setAddedNote(null);
              setAdding((open) => !open);
            }}
            className="h-11 rounded-full px-4"
          >
            {adding ? "Close" : "Add an entry"}
          </Button>
          <Button type="button" onClick={() => void logout()} className="h-11 rounded-full px-4">
            Sign out
          </Button>
        </div>
      </div>
      {addedNote ? (
        <p role="status" className="rounded-xl bg-white px-3 py-2 text-sm">
          {addedNote}
        </p>
      ) : null}
      {adding ? (
        <section aria-labelledby="review-add" className="rounded-2xl bg-white p-4 shadow-[0_16px_40px_rgb(39_75_58/0.06)] sm:p-6">
          <h2 id="review-add" className="text-3xl">
            Add an entry
          </h2>
          <div className="mt-4">
            <PhotoEntryForm
              presentation="dialog"
              rememberIdentity={false}
              onEntered={(entry) => {
                setAdding(false);
                setAddedNote(
                  entry.live
                    ? `${entry.personName}'s photo is on the board.`
                    : `${entry.personName}'s photo is in Waiting. Approve it when you want it public.`,
                );
                void load();
              }}
            />
          </div>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-white px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <VisitReport report={payload.activity ?? emptyContestReport()} />
      <PeopleList people={payload.people ?? []} />
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
                  {photo.email ? (
                    <p className="text-sm">
                      <span className="font-bold">Email </span>
                      {photo.email}
                    </p>
                  ) : null}
                  {photo.phone ? (
                    <p className="text-sm">
                      <span className="font-bold">Phone </span>
                      {formatStoredPhone(photo.phone)}
                    </p>
                  ) : null}
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

function VisitReport({ report }: { report: ContestReport }) {
  return (
    <section aria-labelledby="review-visits" className="flex flex-col gap-4">
      <div>
        <h2 id="review-visits" className="text-3xl">
          Visits
        </h2>
        <p className="mt-1 max-w-xl text-sm">
          A refresh counts again. Each browser is one person. A name shows when they signed up on that phone.
        </p>
      </div>
      <ul className="grid list-none grid-cols-1 gap-3 sm:grid-cols-3">
        {report.pages.map((page) => (
          <li key={page.id} className="rounded-2xl bg-white px-4 py-4 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
            <p className="text-sm font-bold tracking-wide text-[#274b3a]/70 uppercase">{page.label}</p>
            <p className="mt-2 font-heading text-4xl leading-none">{page.visitors}</p>
            <p className="mt-1 text-sm">{page.visitors === 1 ? "unique person" : "unique people"}</p>
            <p className="mt-2 text-sm font-semibold">{page.visits === 1 ? "1 visit" : `${page.visits} visits`}</p>
          </li>
        ))}
      </ul>
      <ul className="grid list-none grid-cols-1 gap-3 sm:grid-cols-3">
        {report.clicks.map((click) => (
          <li key={click.id} className="rounded-2xl bg-white px-4 py-4 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
            <p className="text-sm font-bold tracking-wide text-[#274b3a]/70 uppercase">{click.label}</p>
            <p className="mt-2 font-heading text-4xl leading-none">{click.count}</p>
            <p className="mt-1 text-sm">{click.count === 1 ? "tap" : "taps"}</p>
          </li>
        ))}
      </ul>
      {report.recent.length === 0 ? <p className="text-sm">No visits yet.</p> : null}
      {report.recent.length > 0 ? (
        <ul className="grid list-none grid-cols-1 gap-2 lg:grid-cols-2">
          {report.recent.map((visit) => (
            <li key={visit.id} className="flex items-baseline justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm">
              <span>
                <span className="font-semibold">{visit.personName ?? "No name yet"}</span>
                <span className="text-[#274b3a]/70"> · {visit.label}</span>
              </span>
              <time dateTime={visit.at} className="shrink-0 text-[#274b3a]/60">
                {visitWhen(visit.at)}
              </time>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function visitWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function PeopleList({ people }: { people: PersonRecord[] }) {
  return (
    <section aria-labelledby="review-people" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="review-people" className="text-3xl">
            People
          </h2>
          <p className="mt-1 text-sm">
            {people.length === 1 ? "1 person signed up." : `${people.length} people signed up.`}
          </p>
        </div>
        <Button type="button" className="h-11 rounded-full px-4" disabled={people.length === 0} onClick={() => downloadPeople(people)}>
          Download
        </Button>
      </div>
      {people.length === 0 ? <p className="text-sm">No one has signed up yet.</p> : null}
      <ul className="grid list-none grid-cols-1 gap-3 lg:grid-cols-2">
        {people.map((person, index) => (
          <li key={`${person.email ?? ""}-${person.phone ?? ""}-${index}`} className="rounded-2xl bg-white p-4 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
            <h3 className="text-2xl">{person.name}</h3>
            {person.email ? <p className="mt-1 text-sm">{person.email}</p> : null}
            {person.phone ? <p className="mt-1 text-sm">{formatStoredPhone(person.phone)}</p> : null}
            <p className="mt-2 text-sm text-[#274b3a]/70">
              {signupLabel(person)} · {swipeLabel(person.swipeCount)} · {signedUpLabel(person.signedUpAt)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function swipeLabel(count: number): string {
  return count === 1 ? "1 swipe" : `${count} swipes`;
}

function signupLabel(person: PersonRecord): string {
  const parts: string[] = [];
  if (person.photoCount === 1) parts.push("1 photo");
  if (person.photoCount > 1) parts.push(`${person.photoCount} photos`);
  if (person.inDraw) parts.push("Draw");
  return parts.join(" · ") || "Signed up";
}

function signedUpLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });
}

function downloadPeople(people: PersonRecord[]) {
  const lines = [
    ["Name", "Email", "Phone", "Photos", "Draw", "Swipes", "Signed up"],
    ...people.map((person) => [
      person.name,
      person.email ?? "",
      person.phone ? formatStoredPhone(person.phone) : "",
      String(person.photoCount),
      person.inDraw ? "Yes" : "No",
      String(person.swipeCount),
      person.signedUpAt,
    ]),
  ];
  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "urban-grind-people.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
