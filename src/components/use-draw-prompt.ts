"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-api";
import { shouldAskDraw } from "@/lib/draw-prompt";
import { dismissDrawAsk, readDrawAskAfter } from "@/lib/local-votes";

export function useDrawPrompt(input: {
  voterId: string | null;
  ready: boolean;
  photoIds: readonly string[];
  asking: boolean;
}) {
  const { voterId, ready, asking } = input;
  const photoKey = input.photoIds.join(",");
  const [open, setOpen] = useState(false);
  const [swipes, setSwipes] = useState(0);
  const [known, setKnown] = useState(false);

  function note(nextSwipes: number, nextKnown: boolean) {
    if (Number.isInteger(nextSwipes) && nextSwipes >= 0) setSwipes(nextSwipes);
    setKnown(nextKnown);
  }

  useEffect(() => {
    if (!ready || !voterId) return;
    const controller = new AbortController();
    const photoIds = photoKey ? photoKey.split(",") : [];
    requestJson<{ known: boolean; swipes: number }>("/api/photos/draw", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({ voterId, photoIds }),
    })
      .then((data) => {
        if (Number.isInteger(data.swipes)) setSwipes(data.swipes);
        setKnown(Boolean(data.known));
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [ready, voterId, photoKey]);

  useEffect(() => {
    if (known) {
      setOpen(false);
      return;
    }
    if (asking && shouldAskDraw(swipes, known, readDrawAskAfter())) setOpen(true);
  }, [asking, known, swipes]);

  function dismiss() {
    dismissDrawAsk(swipes);
    setOpen(false);
  }

  function saved() {
    setKnown(true);
    setOpen(false);
  }

  return { open, note, dismiss, saved };
}
