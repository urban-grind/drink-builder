"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { orderPathSummary, type SiteUsage, type UsageFunnel, type UsagePlace, type UsageSlice } from "@/lib/site-usage";

type ActivityPayload = {
  configured: boolean;
  authenticated: boolean;
  usage: SiteUsage | null;
};

const WINDOWS = [
  ["all", "So far"],
  ["today", "Today"],
] as const;

export function SiteActivity() {
  const [payload, setPayload] = useState<ActivityPayload | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number][0]>("all");

  useEffect(() => {
    const controller = new AbortController();
    requestJson<ActivityPayload>("/api/photos/analytics", { signal: controller.signal })
      .then((data) => {
        setPayload(data);
        setStatus("ready");
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "Site activity didn't load.");
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
      const data = await requestJson<ActivityPayload>("/api/photos/analytics");
      setPayload(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That password didn't work.");
    } finally {
      setPending(false);
    }
  }

  if (status === "loading") {
    return (
      <div role="status" className="ug-board mx-auto w-full max-w-3xl">
        <p className="sr-only">Loading site activity</p>
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="ug-board mx-auto w-full max-w-3xl rounded-2xl bg-white px-5 py-8">
        <h1 className="text-3xl">Site activity didn&apos;t load</h1>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  if (!payload?.configured) {
    return (
      <div className="ug-board mx-auto w-full max-w-3xl rounded-2xl bg-white px-5 py-10">
        <h1 className="text-4xl">Site activity</h1>
        <p className="mt-3 max-w-lg">Site activity is not set up.</p>
      </div>
    );
  }

  if (!payload.authenticated || !payload.usage) {
    return (
      <form className="ug-board mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white px-5 py-8" onSubmit={onLogin}>
        <h1 className="text-4xl">Site activity</h1>
        <p>Enter the cafe password. This stays off the public site.</p>
        <div className="grid gap-2">
          <Label htmlFor="activity-password">Password</Label>
          <Input
            id="activity-password"
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
          {pending ? "Checking…" : "Open activity"}
        </Button>
      </form>
    );
  }

  const slice = payload.usage[windowKey];

  return (
    <div className="ug-board mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-4xl">Site activity</h1>
        <p className="mt-2 max-w-xl text-pretty text-sm">
          How people move through the contest and the menu. Today runs midnight to midnight, Eastern time. A refresh counts as another visit.
        </p>
        <p className="mt-3 flex gap-4 text-sm font-semibold">
          <a href="/photos/review" className="underline">
            Photo review
          </a>
          <a href="/photos/recap" className="underline">
            Daily Recap
          </a>
        </p>
      </div>

      <div role="tablist" aria-label="Time range" className="flex flex-wrap gap-1">
        {WINDOWS.map(([key, label]) => {
          const selected = windowKey === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setWindowKey(key)}
              className={
                selected
                  ? "rounded-full bg-[#274b3a] px-5 py-2.5 text-sm font-semibold text-[#f7f4ec]"
                  : "!rounded-full !border !border-[#274b3a]/20 !bg-transparent px-4 py-2.5 text-sm font-semibold !text-[#274b3a] hover:!bg-transparent"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <OrderPath slice={slice} />
      <DrinkList slice={slice} />
      <ContestUse slice={slice} />
      <PathList slice={slice} />
    </div>
  );
}

function OrderPath({ slice }: { slice: UsageSlice }) {
  const funnel = slice.funnel;
  const steps: { label: string; value: number; tone: string }[] = [
    { label: "Opened Popular", value: funnel.popular, tone: "bg-[#274b3a]" },
    { label: "Opened a drink", value: funnel.openedDrink, tone: "bg-[#3d6b52]" },
    { label: "Left to order", value: funnel.ordered, tone: "bg-[#3d8f5a]" },
  ];
  return (
    <section aria-labelledby="activity-path" className="rounded-2xl bg-white px-4 py-5 shadow-[0_16px_40px_rgb(39_75_58/0.06)] sm:px-6">
      <h2 id="activity-path" className="text-3xl">
        The order path
      </h2>
      <p className="mt-1 max-w-xl text-sm text-[#274b3a]/70">
        People who opened Popular, then opened a drink, then tapped Order. That tap leaves for checkout. It does not mean the drink was paid for.
      </p>
      <ol className="mt-5 flex list-none flex-col gap-4">
        {steps.map((step) => (
          <li key={step.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{step.label}</span>
              <span className="shrink-0 text-sm tabular-nums">{peopleLabel(step.value)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#274b3a]/10" aria-hidden="true">
              <div className={`h-2 rounded-full ${step.tone}`} style={{ width: barWidth(funnel, step.value) }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm font-semibold">{orderPathSummary(funnel)}</p>
      <p className="mt-2 text-sm text-[#274b3a]/70">
        On the menu: Today {slice.ranges.today} · This week {slice.ranges.week} · This month {slice.ranges.month}
      </p>
    </section>
  );
}

function DrinkList({ slice }: { slice: UsageSlice }) {
  return (
    <section aria-labelledby="activity-drinks" className="rounded-2xl bg-white px-4 py-5 shadow-[0_16px_40px_rgb(39_75_58/0.06)] sm:px-6">
      <h2 id="activity-drinks" className="text-3xl">
        Drinks
      </h2>
      <p className="mt-1 text-sm text-[#274b3a]/70">Every time someone opened a drink or tapped Order.</p>
      {slice.drinks.length === 0 ? <p className="mt-4 text-sm">No drinks opened.</p> : null}
      {slice.drinks.length > 0 ? (
        <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 text-sm">
          <span className="text-xs font-bold tracking-wide text-[#274b3a]/50 uppercase">Drink</span>
          <span className="text-xs font-bold tracking-wide text-[#274b3a]/50 uppercase">Opened</span>
          <span className="text-xs font-bold tracking-wide text-[#274b3a]/50 uppercase">Ordered</span>
          {slice.drinks.map((drink) => (
            <DrinkRow key={drink.name} name={drink.name} opens={drink.opens} orders={drink.orders} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DrinkRow({ name, opens, orders }: { name: string; opens: number; orders: number }) {
  return (
    <>
      <span className="border-t border-[#274b3a]/10 py-2 font-semibold">{name}</span>
      <span className="border-t border-[#274b3a]/10 py-2 text-right tabular-nums">{opens}</span>
      <span className="border-t border-[#274b3a]/10 py-2 text-right font-semibold text-[#3d8f5a] tabular-nums">{orders}</span>
    </>
  );
}

function ContestUse({ slice }: { slice: UsageSlice }) {
  const rows: { label: string; place: UsagePlace }[] = [
    { label: "Vote", place: slice.places.vote },
    { label: "Leaderboard", place: slice.places.leaderboard },
    { label: "Photo pages", place: slice.places.photo },
  ];
  return (
    <section aria-labelledby="activity-contest" className="rounded-2xl bg-white px-4 py-5 shadow-[0_16px_40px_rgb(39_75_58/0.06)] sm:px-6">
      <h2 id="activity-contest" className="text-3xl">
        The contest
      </h2>
      <ul className="mt-4 flex list-none flex-col gap-3">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-3 border-t border-[#274b3a]/10 pt-3 first:border-t-0 first:pt-0">
            <span className="font-semibold">{row.label}</span>
            <span className="text-sm text-[#274b3a]/70">{placeLabel(row.place)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-[#274b3a]/70">
        Shared a link {slice.shares.link} · Story {slice.shares.story} · Post {slice.shares.post}
      </p>
    </section>
  );
}

function PathList({ slice }: { slice: UsageSlice }) {
  return (
    <section aria-labelledby="activity-people" className="flex flex-col gap-3">
      <h2 id="activity-people" className="text-3xl">
        What people did
      </h2>
      {slice.paths.length === 0 ? <p className="text-sm">Nothing yet.</p> : null}
      <ul className="grid list-none grid-cols-1 gap-2">
        {slice.paths.map((path, index) => (
          <li
            key={`${path.at}-${index}`}
            className={`rounded-2xl px-4 py-3 text-sm shadow-[0_16px_40px_rgb(39_75_58/0.06)] ${path.ordered ? "bg-[#e7f3ea]" : "bg-white"}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{path.personName ?? "No name yet"}</span>
              <time dateTime={path.at} className="shrink-0 text-[#274b3a]/60">
                {activityWhen(path.at)}
              </time>
            </div>
            {path.trail.length > 0 ? <p className="mt-1 text-[#274b3a]/80">{path.trail.join(" → ")}</p> : null}
            {path.also.length > 0 ? (
              <p className="mt-1 text-[#274b3a]/70">
                {path.trail.length > 0 ? "Also " : ""}
                {path.also.map((item) => (item.count > 1 ? `${item.label} ${item.count}` : item.label)).join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function barWidth(funnel: UsageFunnel, value: number): string {
  if (value <= 0 || funnel.popular <= 0) return "0%";
  return `${Math.max(8, Math.round((value / funnel.popular) * 100))}%`;
}

function peopleLabel(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

function placeLabel(place: UsagePlace): string {
  const people = place.people === 1 ? "1 person" : `${place.people} people`;
  const visits = place.visits === 1 ? "1 visit" : `${place.visits} visits`;
  return `${people} · ${visits}`;
}

function activityWhen(iso: string): string {
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
