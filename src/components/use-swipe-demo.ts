"use client";

import { useEffect, useRef, type RefObject } from "react";
import { markSwipeDemoSeen, readSwipeDemoSeen } from "@/lib/local-votes";

const PEAK = 108;

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Nudges the top card right, then left, the first time someone opens the deck.
 * A real drag or vote cancels it and remembers that they no longer need the demo.
 */
export function useSwipeDemo(
  enabled: boolean,
  cardRef: RefObject<HTMLDivElement | null>,
  setDrag: (value: number) => void,
  setFlight: (flight: "drag" | "rest") => void,
) {
  const stopRef = useRef<() => void>(() => {});
  const setters = useRef({ setDrag, setFlight });
  setters.current = { setDrag, setFlight };

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (readSwipeDemoSeen()) return;

    let cancelled = false;
    let frame = 0;
    const timers = new Set<number>();

    function stop(takeover: boolean) {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      if (takeover) {
        markSwipeDemoSeen();
        return;
      }
      setters.current.setDrag(0);
      setters.current.setFlight("rest");
    }

    stopRef.current = () => stop(true);

    function pause(ms: number) {
      return new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          resolve(!cancelled);
        }, ms);
        timers.add(timer);
      });
    }

    function glide(from: number, to: number, ms: number, ease: (t: number) => number) {
      return new Promise<boolean>((resolve) => {
        if (cancelled) {
          resolve(false);
          return;
        }
        setters.current.setFlight("drag");
        const start = performance.now();
        function tick(now: number) {
          if (cancelled) {
            resolve(false);
            return;
          }
          const t = Math.min(1, (now - start) / ms);
          setters.current.setDrag(from + (to - from) * ease(t));
          if (t < 1) frame = window.requestAnimationFrame(tick);
          else resolve(true);
        }
        frame = window.requestAnimationFrame(tick);
      });
    }

    async function play() {
      if (!(await pause(700))) return;
      if (!(await glide(0, PEAK, 620, easeOut))) return;
      if (!(await pause(360))) return;
      if (!(await glide(PEAK, 0, 460, easeInOut))) return;
      if (!(await pause(420))) return;
      if (!(await glide(0, -PEAK, 620, easeOut))) return;
      if (!(await pause(360))) return;
      if (!(await glide(-PEAK, 0, 460, easeInOut))) return;
      if (cancelled) return;
      markSwipeDemoSeen();
      setters.current.setFlight("rest");
    }

    void play();

    const card = cardRef.current;
    const onDown = () => stop(true);
    card?.addEventListener("pointerdown", onDown);

    return () => {
      card?.removeEventListener("pointerdown", onDown);
      stop(false);
      stopRef.current = () => {};
    };
  }, [enabled, cardRef]);

  return stopRef;
}
