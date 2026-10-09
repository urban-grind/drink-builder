"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { RACE_SIZE, awakeDuration, displayHour, follow, momentAt, playheadAt, standingsAt, type RacePhoto, type VoteRace } from "@/lib/photo-race";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EASTERN = "America/Toronto";
const ROW = "3.75rem";
const PHOTO = "2.75rem";
const GROW_TAU = 1.05;

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
});

function playbackMs(from: number, to: number): number {
  const hours = Math.max(1, awakeDuration(from, to) / 3_600_000);
  return Math.min(48000, Math.max(16000, hours * 1100));
}

export function PhotoRace() {
  const [race, setRace] = useState<VoteRace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const progressRef = useRef(0);
  const frameRef = useRef(0);
  const reduced = useRef(false);
  const votesRef = useRef<VoteRace["votes"]>([]);
  const boundsRef = useRef({ from: 0, to: 0 });
  const shownRef = useRef(new Map<string, { votes: number; place: number }>());
  const [shown, setShown] = useState<{ id: string; votes: number; place: number }[]>([]);

  const fromMs = race ? Date.parse(race.from) : 0;
  const toMs = race ? Date.parse(race.to) : 0;
  votesRef.current = race?.votes ?? [];
  boundsRef.current = { from: fromMs, to: toMs };

  const atMs = playheadAt(fromMs, toMs, progress);
  const byId = useMemo(() => new Map((race?.photos ?? []).map((photo) => [photo.id, photo])), [race]);
  const finish = useMemo(() => (race ? (standingsAt(race.votes, Date.parse(race.to))[0]?.votes ?? 1) : 1), [race]);

  function paint(snap: boolean, dt: number) {
    const bounds = boundsRef.current;
    const at = playheadAt(bounds.from, bounds.to, progressRef.current);
    const target = momentAt(votesRef.current, at);
    const map = shownRef.current;
    const ids = new Set(target.rows.map((row) => row.id));
    let settled = true;
    for (const row of target.rows) {
      const prev = map.get(row.id);
      const votes = snap ? row.votes : follow(prev?.votes ?? 0, row.votes, dt, GROW_TAU);
      const place = snap ? row.place : follow(prev?.place ?? row.place, row.place, dt, GROW_TAU);
      if (Math.abs(votes - row.votes) > 0.05 || Math.abs(place - row.place) > 0.03) settled = false;
      map.set(row.id, { votes, place });
    }
    for (const [id, prev] of map) {
      if (ids.has(id)) continue;
      const place = snap ? RACE_SIZE + 1 : follow(prev.place, RACE_SIZE + 1, dt, GROW_TAU);
      if (place > RACE_SIZE + 0.7) map.delete(id);
      else {
        map.set(id, { votes: prev.votes, place });
        settled = false;
      }
    }
    setShown(
      [...map.entries()]
        .map(([id, row]) => ({ id, ...row }))
        .filter((row) => row.place < RACE_SIZE + 0.75 && row.votes > 0.04)
        .sort((a, b) => a.place - b.place),
    );
    return settled;
  }

  function stop() {
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(frameRef.current);
  }

  function play(from = progressRef.current >= 1 ? 0 : progressRef.current) {
    if (!race || toMs <= fromMs) return;
    if (reduced.current) {
      progressRef.current = 1;
      setProgress(1);
      paint(true, 0);
      return;
    }
    if (from === 0) shownRef.current.clear();
    progressRef.current = from;
    setProgress(from);
    playingRef.current = true;
    setPlaying(true);
    const duration = playbackMs(fromMs, toMs);
    const started = performance.now() - from * duration;
    let last = performance.now();
    const tick = (now: number) => {
      if (!playingRef.current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = Math.min(1, (now - started) / duration);
      progressRef.current = next;
      setProgress(next);
      const settled = paint(false, dt);
      if (next >= 1 && settled) {
        stop();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  function scrub(value: number) {
    stop();
    const next = value / 1000;
    progressRef.current = next;
    setProgress(next);
    paint(true, 0);
  }

  async function load(signal?: AbortSignal) {
    const data = await requestJson<{ race: VoteRace }>("/api/photos/review/race", { signal });
    setNeedsLogin(false);
    setRace(data.race);
  }

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controller = new AbortController();
    load(controller.signal).catch((caught) => {
      if (controller.signal.aborted) return;
      if (caught instanceof ApiRequestError && caught.code === "UNAUTHORIZED") {
        setNeedsLogin(true);
        return;
      }
      setError(caught instanceof ApiRequestError ? caught.message : "The recap didn't load.");
    });
    return () => {
      controller.abort();
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!race || race.votes.length === 0) return;
    play(0);
    return () => {
      playingRef.current = false;
      cancelAnimationFrame(frameRef.current);
    };
    // Start once when the recap arrives. Replay uses the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race]);

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

  if (needsLogin) {
    return (
      <form className="flex flex-col gap-4 rounded-2xl bg-white px-4 py-8 sm:px-5" onSubmit={onLogin}>
        <p>Enter the cafe password. This stays off the public site.</p>
        <div className="grid gap-2">
          <Label htmlFor="recap-password">Password</Label>
          <Input
            id="recap-password"
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
          {pending ? "Checking…" : "Open the recap"}
        </Button>
      </form>
    );
  }

  return (
    <section aria-labelledby="daily-recap" className="rounded-2xl bg-white p-4 shadow-[0_16px_40px_rgb(39_75_58/0.06)]">
      <p className="text-sm font-semibold tabular-nums" aria-live="polite">
        {race ? clock.format(displayHour(atMs)) : "Eastern time"}
      </p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {!error && !race ? <div className="mt-4 h-40 animate-pulse rounded-xl bg-[#f3f2ef]" /> : null}
      {race && race.votes.length === 0 ? <p className="mt-4 text-sm">No votes yet.</p> : null}
      {race && race.votes.length > 0 ? (
        <>
          <div className="relative mt-4 overflow-hidden" style={{ height: `calc(${RACE_SIZE} * ${ROW})` }}>
            {shown.map((row) => {
              const photo = byId.get(row.id);
              if (!photo) return null;
              return (
                <RaceRow
                  key={row.id}
                  photo={photo}
                  votes={Math.round(row.votes)}
                  place={row.place}
                  share={row.votes / finish}
                />
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => (playing ? stop() : play())}
              className="h-11 shrink-0 rounded-full px-4"
              aria-pressed={playing}
            >
              {playing ? "Pause" : progress >= 1 ? "Replay" : "Play"}
            </button>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(event) => scrub(Number(event.target.value))}
              aria-label="Moment in the contest"
              className="h-10 min-w-0 flex-1 accent-[#274b3a]"
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function RaceRow({ photo, votes, place, share }: { photo: RacePhoto; votes: number; place: number; share: number }) {
  const reach = `${Math.max(share * 100, 0)}%`;
  return (
    <div
      className="absolute inset-x-0 flex items-center gap-2"
      style={{ transform: `translateY(calc(${place} * ${ROW}))` }}
    >
      <div className="relative h-11 min-w-0 flex-1">
        <div className="absolute inset-y-1 left-0 rounded-lg bg-[#274b3a]/10" style={{ width: reach }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbUrl}
          alt=""
          className="absolute top-0 h-11 w-11 rounded-xl object-cover shadow-md"
          style={{ left: `clamp(0px, calc(${reach} - ${PHOTO}), calc(100% - ${PHOTO}))` }}
        />
      </div>
      <div className="flex w-[5.75rem] shrink-0 items-baseline justify-between gap-1 sm:w-36">
        <p className="min-w-0 truncate font-semibold text-[#274b3a]">{photo.personName}</p>
        <p className="shrink-0 text-sm tabular-nums">{votes}</p>
      </div>
    </div>
  );
}
