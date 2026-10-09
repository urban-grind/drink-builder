"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { requestPour } from "@/components/pour-pause";
import { popularDrinkClick } from "@/lib/contest-report";
import { trackContest } from "@/lib/contest-track";
import { drinkUpdatedLabel, type DrinkStats, type DrinkTotal } from "@/lib/drink-stats";

const TABS = [
  ["day", "Today", "Popular today", "popular-today"],
  ["week", "This week", "Popular this week", "popular-week"],
  ["month", "This month", "Popular this month", "popular-month"],
] as const;

const FEATURED = 3;
const GROW_MS = 460;
const GROW = `top ${GROW_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), left ${GROW_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), width ${GROW_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), height ${GROW_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), border-radius ${GROW_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;

type DrinkOrigin = { top: number; left: number; width: number; height: number };

export function TopDrinks({ stats, updatedAt }: { stats: DrinkStats; updatedAt: number | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("day");
  const [selected, setSelected] = useState<{ drink: DrinkTotal; origin: DrinkOrigin } | null>(null);
  const current = TABS.find((item) => item[0] === tab) ?? TABS[0];
  const drinks = stats[current[0]];
  const featured = drinks.slice(0, FEATURED);
  const rest = drinks.slice(FEATURED);

  useEffect(() => {
    trackContest("visit", "popular");
  }, []);

  function openDrink(drink: DrinkTotal, source: HTMLElement) {
    trackContest("click", popularDrinkClick("popular-drink", drink.name));
    setSelected({ drink, origin: readOrigin(source) });
  }

  function chooseTab(key: (typeof TABS)[number][0]) {
    if (key === tab) return;
    const next = TABS.find((item) => item[0] === key);
    setSelected(null);
    setTab(key);
    requestPour();
    if (next) trackContest("click", next[3]);
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-10">
      <div role="tablist" aria-label="Drink rankings" className="flex flex-wrap items-center gap-1">
        {TABS.map(([key, title]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => chooseTab(key)}
              className={
                active
                  ? "rounded-full bg-[#274b3a] px-5 py-2.5 text-sm font-semibold text-[#f7f4ec]"
                  : "!rounded-full !bg-transparent px-4 py-2.5 text-sm font-semibold !text-[#274b3a]/70 hover:!bg-transparent"
              }
            >
              {title}
            </button>
          );
        })}
      </div>

      <h1 className="mt-8 font-heading text-4xl leading-none text-[#274b3a]">{current[2]}</h1>
      <LiveFromCafe updatedAt={updatedAt} />

      {drinks.length === 0 ? <p className="mt-4 text-sm text-[#274b3a]/70">No drinks yet.</p> : null}

      {featured.length === 0 ? null : (
        <div className={`mt-4 grid gap-3 ${featured.length === 1 ? "grid-cols-1" : featured.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {featured.map((drink, index) => (
            <DrinkCard key={drink.name} drink={drink} onOpen={openDrink} />
          ))}
        </div>
      )}

      {rest.length === 0 ? null : (
        <ol className="mt-2" start={FEATURED + 1}>
          {rest.map((drink, index) => (
            <li key={drink.name} className="border-t border-[#274b3a]/12">
              <button
                type="button"
                data-drink-name={drink.name}
                onClick={(event) => openDrink(drink, event.currentTarget)}
                className="!flex !h-auto !w-full !items-center !justify-start !gap-4 !rounded-none !bg-transparent !px-0 !py-3 !text-left !font-semibold !text-[#274b3a] hover:!bg-transparent"
              >
                <span className="w-6 shrink-0 font-normal text-[#7d9488]">{index + FEATURED + 1}</span>
                <DrinkPhoto imageUrl={drink.imageUrl} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <DrinkName name={drink.name} className="leading-tight" />
                  <DrinkBadges badges={drink.badges} />
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <DrinkDetail drink={selected?.drink ?? null} origin={selected?.origin ?? null} onClose={() => setSelected(null)} />
    </div>
  );
}

function LiveFromCafe({ updatedAt }: { updatedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const updated = updatedAt === null ? null : drinkUpdatedLabel(updatedAt, now);
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#274b3a]">
      <span className="inline-flex items-center gap-2 font-semibold">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#3d8f5a]" aria-hidden="true" />
        Live from the Cafe
      </span>
      {updated ? <span className="text-[#274b3a]/70">· {updated}</span> : null}
    </p>
  );
}

function DrinkBadges({ badges, compact = false }: { badges: DrinkTotal["badges"]; compact?: boolean }) {
  if (badges.length === 0) return null;
  return (
    <span className={`flex flex-wrap gap-1 ${compact ? "flex-col items-start" : ""}`}>
      {badges.map((badge) => (
        <span
          key={`${badge.tone}-${badge.label}`}
          className={`${badgeClass(badge.tone)} ${compact ? "max-w-full px-2 py-1 text-center text-[11px] leading-tight" : "px-2 py-0.5 text-xs leading-none"}`}
        >
          {compact ? shortBadge(badge) : badge.label}
        </span>
      ))}
    </span>
  );
}

function shortBadge(badge: DrinkTotal["badges"][number]): string {
  if (badge.tone === "up") return badge.label.replace(/ spots$/, "");
  return badge.label;
}

function badgeClass(tone: DrinkTotal["badges"][number]["tone"]): string {
  const base = "inline-flex items-center rounded-full font-bold shadow-sm";
  if (tone === "up") return `${base} bg-[#2f9e5a] text-white`;
  if (tone === "streak") return `${base} bg-[#274b3a] text-[#f7f4ec]`;
  return `${base} bg-[#e7f3ea] text-[#274b3a]`;
}

function DrinkName({ name, className }: { name: string; className: string }) {
  return (
    <span className={className}>
      {name}{" "}
      <span aria-hidden="true" className="inline-block translate-y-[0.12em]">
        →
      </span>
    </span>
  );
}

function DrinkCard({ drink, onOpen }: { drink: DrinkTotal; onOpen: (drink: DrinkTotal, source: HTMLElement) => void }) {
  return (
    <button
      type="button"
      data-drink-name={drink.name}
      onClick={(event) => onOpen(drink, event.currentTarget)}
      className="!flex !h-auto !w-full !flex-col !items-stretch !gap-2 !rounded-2xl !bg-white !p-3 !text-left !font-semibold !text-[#274b3a] shadow-[0_10px_24px_rgb(39_75_58/0.06)] hover:!bg-white"
    >
      <DrinkPhoto imageUrl={drink.imageUrl} large />
      <DrinkName name={drink.name} className="text-sm leading-tight text-pretty" />
      <DrinkBadges badges={drink.badges} compact />
    </button>
  );
}

function DrinkDetail({ drink, origin, onClose }: { drink: DrinkTotal | null; origin: DrinkOrigin | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const motion = useRef(0);

  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const run = ++motion.current;
    if (!drink || !origin) {
      if (node.open) node.close();
      return;
    }
    closing.current = false;
    resetMotion(node);
    if (!node.open) node.showModal();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setSourceHidden(drink.name, true);
      node.classList.add("shown");
      showCopy(node, false);
      node.querySelector<HTMLElement>("[data-close]")?.focus();
      return;
    }
    const finalBox = node.getBoundingClientRect();
    hideCopy(node);
    setSourceHidden(drink.name, true);
    place(node, origin, "16px");
    let second = 0;
    const first = requestAnimationFrame(() => {
      if (motion.current !== run) return;
      second = requestAnimationFrame(() => {
        if (motion.current !== run) return;
        node.style.transition = GROW;
        place(node, rectBox(finalBox), "24px");
        node.classList.add("shown");
        showCopy(node, true);
        const settle = (event: TransitionEvent) => {
          if (event.target !== node || event.propertyName !== "width") return;
          node.style.overflow = "auto";
          node.removeEventListener("transitionend", settle);
        };
        node.addEventListener("transitionend", settle);
        node.querySelector<HTMLElement>("[data-close]")?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [drink, origin]);

  function startClose() {
    const node = dialog.current;
    if (!node?.open || closing.current) return;
    motion.current += 1;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !drink || !origin) {
      node.close();
      return;
    }
    closing.current = true;
    setSourceHidden(drink.name, true);
    node.classList.remove("shown");
    hideCopy(node, true);
    node.style.overflow = "hidden";
    node.style.transition = GROW;
    place(node, liveOrigin(drink.name, origin), "16px");
    const finish = () => {
      if (!closing.current) return;
      closing.current = false;
      if (node.open) node.close();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== node || event.propertyName !== "width") return;
      node.removeEventListener("transitionend", onEnd);
      finish();
    };
    node.addEventListener("transitionend", onEnd);
    window.setTimeout(() => {
      node.removeEventListener("transitionend", onEnd);
      finish();
    }, GROW_MS + 80);
  }

  return (
    <>
      <style>{`
        .drink-preview::backdrop {
          background: rgb(39 75 58 / 0.45);
          opacity: 0;
          transition: opacity ${GROW_MS}ms ease;
        }
        .drink-preview.shown::backdrop {
          opacity: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .drink-preview::backdrop { transition: none; }
        }
      `}</style>
      <dialog
        ref={dialog}
        aria-label={drink?.name ?? "Drink"}
        className="drink-preview m-auto w-[min(100%-2rem,24rem)] rounded-3xl border-0 bg-[#f7f4ec] p-0 text-[#274b3a] shadow-[0_24px_70px_rgb(39_75_58/0.28)]"
        onClose={() => {
          const node = dialog.current;
          if (node) resetMotion(node);
          if (drink) setSourceHidden(drink.name, false);
          onClose();
        }}
        onCancel={(event) => {
          event.preventDefault();
          startClose();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) startClose();
        }}
      >
        {drink ? (
          <>
            <DrinkPhoto imageUrl={drink.imageUrl} large flush />
            <button
              type="button"
              data-close
              data-reveal
              onClick={startClose}
              className="absolute top-3 right-3 z-10 grid h-11 w-11 place-items-center rounded-full text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
            <div data-reveal className="px-5 pt-4 pb-5">
              <h2 className="font-heading text-3xl leading-tight">{drink.name}</h2>
              <p className="mt-3 text-base leading-relaxed whitespace-pre-line">{drink.description ?? "No description yet."}</p>
              {drink.orderUrl ? (
                <a
                  href={drink.orderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackContest("click", popularDrinkClick("popular-order", drink.name))}
                  className="mt-5 inline-flex h-11 items-center rounded-full bg-[#274b3a] px-5 text-sm font-bold text-white"
                >
                  Order
                </a>
              ) : null}
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}

function readOrigin(source: HTMLElement): DrinkOrigin {
  const photo = source.querySelector("[data-drink-photo]");
  const rect = (photo instanceof HTMLElement ? photo : source).getBoundingClientRect();
  return rectBox(rect);
}

function setSourceHidden(name: string, hidden: boolean) {
  const photo = document.querySelector(`[data-drink-name="${CSS.escape(name)}"] [data-drink-photo]`);
  if (!(photo instanceof HTMLElement)) return;
  photo.style.opacity = hidden ? "0" : "";
}

function liveOrigin(name: string, fallback: DrinkOrigin): DrinkOrigin {
  const photo = document.querySelector(`[data-drink-name="${CSS.escape(name)}"] [data-drink-photo]`);
  if (!(photo instanceof HTMLElement)) return fallback;
  const rect = photo.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return fallback;
  return rectBox(rect);
}

function rectBox(rect: Pick<DOMRect, "top" | "left" | "width" | "height">): DrinkOrigin {
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function place(node: HTMLDialogElement, box: DrinkOrigin, radius: string) {
  node.style.position = "fixed";
  node.style.margin = "0";
  node.style.right = "auto";
  node.style.bottom = "auto";
  node.style.top = `${box.top}px`;
  node.style.left = `${box.left}px`;
  node.style.width = `${box.width}px`;
  node.style.height = `${box.height}px`;
  node.style.borderRadius = radius;
  node.style.overflow = "hidden";
  node.style.maxHeight = "none";
  node.style.maxWidth = "none";
}

function resetMotion(node: HTMLDialogElement) {
  node.classList.remove("shown");
  node.style.cssText = "";
  for (const copy of node.querySelectorAll<HTMLElement>("[data-reveal]")) copy.style.cssText = "";
}

function hideCopy(node: HTMLElement, animate = false) {
  for (const copy of node.querySelectorAll<HTMLElement>("[data-reveal]")) {
    copy.style.transition = animate ? "opacity 160ms ease" : "none";
    copy.style.opacity = "0";
  }
}

function showCopy(node: HTMLElement, animate: boolean) {
  for (const copy of node.querySelectorAll<HTMLElement>("[data-reveal]")) {
    copy.style.transition = animate ? "opacity 280ms ease 140ms" : "none";
    copy.style.opacity = "1";
  }
}

function DrinkPhoto({ imageUrl, large = false, flush = false }: { imageUrl: string | null; large?: boolean; flush?: boolean }) {
  const frame = large ? "aspect-square w-full" : "h-11 w-11";
  const radius = flush ? "rounded-none" : "rounded-2xl";
  if (!imageUrl) {
    return (
      <span data-drink-photo aria-hidden="true" className={`grid ${frame} ${radius} shrink-0 place-items-center bg-[#e7f0ea] text-[#274b3a]`}>
        <CupMark />
      </span>
    );
  }
  return (
    // Square hosts the catalog photo. The drink name sits beside it.
    // eslint-disable-next-line @next/next/no-img-element
    <img data-drink-photo src={imageUrl} alt="" className={`block ${frame} ${radius} shrink-0 bg-[#e7e4de] object-cover`} />
  );
}

function CupMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M6 8h10v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8z" />
      <path d="M16 9h2.2a2.2 2.2 0 0 1 0 4.4H16" strokeLinecap="round" />
      <path d="M8 4.5c.4.8.4 1.4 0 2.2M12 4.5c.4.8.4 1.4 0 2.2" strokeLinecap="round" />
    </svg>
  );
}
