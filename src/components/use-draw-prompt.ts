"use client";

import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/client-api";
import { DRAW_REQUIRED_AT, drawPromptMode } from "@/lib/draw-prompt";
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

  const required = !known && swipes >= DRAW_REQUIRED_AT;
  const held = useRef(false);

  useEffect(() => {
    if (known || !asking) {
      setOpen(false);
      return;
    }
    const mode = drawPromptMode(swipes, known, readDrawAskAfter());
    if (mode === "ask") setOpen(true);
    else if (mode === "required" && !held.current) setOpen(true);
  }, [asking, known, swipes]);

  function dismiss() {
    if (required) held.current = true;
    else dismissDrawAsk(swipes);
    setOpen(false);
  }

  function reopen() {
    if (!required) return;
    setOpen(true);
  }

  function saved() {
    setKnown(true);
    setOpen(false);
  }

  return { open, required, note, dismiss, reopen, saved };
}
