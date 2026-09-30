"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhotoCard } from "@/components/photo-card";
import { useVoter } from "@/components/use-voter";
import { Button } from "@/components/ui/button";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import type { PublicPhoto } from "@/lib/photo-types";

const WALL_PHOTO = "/photos/wall-drink.jpg";
const CUP_PHOTO = "/photos/cup-beans.jpg";
const COUNTER_PHOTO = "/photos/counter-break.jpg";

const steps = [
  { number: "01", title: "Snap it", body: "The drink in your hand." },
  { number: "02", title: "Name it", body: "Put your name on it." },
  { number: "03", title: "Barrie votes", body: "The good ones move up." },
] as const;

function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
      <p className="sr-only">Loading photos</p>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#274b3a]/10">
          <div className="aspect-[4/5] animate-pulse rounded-xl bg-[#e7e4de]" />
        </div>
      ))}
    </div>
  );
}

function byPopularity(a: PublicPhoto, b: PublicPhoto): number {
  if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
  return b.createdAt.localeCompare(a.createdAt);
}

function ActionLink({ href, children, light = false }: { href: string; children: string; light?: boolean }) {
  return (
    <Link
      href={href}
      className={
        light
          ? "inline-flex items-center rounded-full bg-[#f3f2ef] px-7 py-3.5 text-base font-bold text-[#274b3a] shadow-lg transition-transform hover:scale-[1.02]"
          : "inline-flex items-center rounded-full bg-[#274b3a] px-7 py-3.5 text-base font-bold text-[#f3f2ef] shadow-lg transition-colors hover:bg-[#1e3b2e]"
      }
    >
      {children}
    </Link>
  );
}

export function PhotoBoard() {
  const { voterId, ready } = useVoter();
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("The photos didn't load.");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ready || !voterId) return;
    const controller = new AbortController();
    requestJson<{ popular: PublicPhoto[] }>(`/api/photos?${new URLSearchParams({ voterId }).toString()}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setPhotos(data.popular);
        setStatus("ready");
        const hash = window.location.hash.replace("#", "");
        if (hash.startsWith("photo-")) {
          window.setTimeout(() => {
            document.getElementById(hash)?.scrollIntoView({ block: "center" });
          }, 50);
        }
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof ApiRequestError ? caught.message : "The photos didn't load.");
      });
    return () => controller.abort();
  }, [ready, voterId, reloadKey]);

  function applyUpdate(updated: PublicPhoto) {
    setPhotos((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(byPopularity));
  }

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 -mt-8 -mb-8 sm:-mt-12 sm:-mb-12">
      <section className="bg-[#274b3a] text-[#f3f2ef]">
        <div className="mx-auto grid max-w-7xl items-stretch lg:grid-cols-[1.05fr_0.95fr]">
          <div className="order-2 flex flex-col justify-center px-6 py-16 sm:py-24 lg:order-1 lg:px-8 lg:py-28">
            <h1 className="max-w-xl text-4xl leading-[1.02] text-balance sm:text-5xl lg:text-6xl">
              This one&apos;s <span className="text-white">mine.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-[#f3f2ef]/75 md:text-lg">Snap it and put it up.</p>
            <div className="mt-8">
              <ActionLink href="/photos/enter" light>
                Add your photo
              </ActionLink>
            </div>
          </div>
          <div className="relative order-1 aspect-[3/4] min-h-80 lg:order-2 lg:aspect-auto lg:min-h-[40rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={WALL_PHOTO}
              alt="Urban Grind on the wall, and an iced drink in hand"
              className="absolute inset-0 h-full w-full object-cover object-[center_42%]"
            />
          </div>
        </div>
      </section>

      <section aria-label="How to enter" className="relative z-10 mx-auto -mt-8 max-w-7xl px-6 lg:px-8">
        <ol className="grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.number}
              className={
                index === 0
                  ? "rounded-3xl bg-[#274b3a] p-6 text-[#f3f2ef] shadow-lg"
                  : "rounded-3xl border border-[#d9d4cc] bg-white p-6 text-[#274b3a] shadow-lg"
              }
            >
              <p className={`font-heading text-4xl leading-none ${index === 0 ? "text-white/70" : "text-[#274b3a]"}`}>
                {step.number}
              </p>
              <h2 className="mt-8 text-2xl leading-tight">{step.title}</h2>
              <p className={`mt-2 text-sm ${index === 0 ? "text-[#f3f2ef]/80" : "text-[#3f5d4e]"}`}>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CUP_PHOTO}
          alt="A takeaway cup in coffee beans"
          className="aspect-[3/4] w-full object-cover"
        />
        <div>
          <p className="max-w-md font-heading text-4xl leading-[1.05] text-balance sm:text-5xl">The one in your hand.</p>
          <div className="mt-8">
            <ActionLink href="/photos/enter">Add your photo</ActionLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="on-the-board" className="mx-auto max-w-7xl px-6 pb-16 lg:px-8 lg:pb-24">
        <h2 id="on-the-board" className="text-3xl leading-[1.05] sm:text-4xl">
          On the board
        </h2>

        {status === "loading" ? <BoardSkeleton /> : null}

        {status === "error" ? (
          <div role="alert" className="mt-8 rounded-3xl bg-white px-6 py-12 shadow-lg">
            <h3 className="text-3xl">The photos didn&apos;t load</h3>
            <p className="mt-3 max-w-md">{error}</p>
            <Button
              type="button"
              onClick={() => {
                setStatus("loading");
                setReloadKey((value) => value + 1);
              }}
              className="mt-6 h-12 rounded-full px-7"
            >
              Try again
            </Button>
          </div>
        ) : null}

        {status === "ready" && photos.length === 0 ? (
          <ul className="mt-8 grid list-none grid-cols-1 gap-4 md:grid-cols-3">
            <li className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#274b3a]/10">
              <div className="flex aspect-[4/5] flex-col justify-end rounded-xl bg-[#274b3a] p-6 text-[#f3f2ef]">
                <p className="font-heading text-4xl leading-[1.05] sm:text-5xl">Your drink.</p>
                <div className="mt-6">
                  <ActionLink href="/photos/enter" light>
                    Add your photo
                  </ActionLink>
                </div>
              </div>
            </li>
            <li aria-hidden="true" className="hidden rounded-2xl bg-[#e7e4de] p-2 md:block">
              <div className="aspect-[4/5] rounded-xl bg-[#f3f2ef]" />
            </li>
            <li aria-hidden="true" className="hidden rounded-2xl bg-[#e7e4de] p-2 md:block">
              <div className="aspect-[4/5] rounded-xl bg-[#f3f2ef]" />
            </li>
          </ul>
        ) : null}

        {status === "ready" && photos.length > 0 ? (
          <ul className="mt-8 grid list-none grid-cols-1 gap-4 md:grid-cols-3">
            {photos.map((photo) => (
              <PhotoCard key={photo.id} photo={photo} onUpdated={applyUpdate} />
            ))}
          </ul>
        ) : null}
      </section>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={COUNTER_PHOTO}
        alt="The menu board and lights at Urban Grind"
        className="h-24 w-full object-cover object-[center_40%] sm:h-32 lg:h-40"
      />
    </div>
  );
}
