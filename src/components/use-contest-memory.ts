"use client";

import { useSyncExternalStore } from "react";
import { readLeaderboardOpen, readMyPhotoIds, writeLeaderboardOpen } from "@/lib/local-votes";
import { LEADERBOARD_OPEN_EVENT, MY_PHOTOS_EVENT } from "@/lib/votes";

function subscribePhotos(onChange: () => void) {
  window.addEventListener(MY_PHOTOS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(MY_PHOTOS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

let photoSnapshot = "[]";

function getPhotoSnapshot() {
  const next = JSON.stringify(readMyPhotoIds());
  if (next !== photoSnapshot) photoSnapshot = next;
  return photoSnapshot;
}

export function useMyPhotoIds(): string[] {
  const raw = useSyncExternalStore(subscribePhotos, getPhotoSnapshot, () => "[]");
  return JSON.parse(raw) as string[];
}

function subscribeOpen(onChange: () => void) {
  window.addEventListener(LEADERBOARD_OPEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LEADERBOARD_OPEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getOpenSnapshot() {
  return readLeaderboardOpen() ? "1" : "0";
}

export function useLeaderboardOpen(): boolean {
  return useSyncExternalStore(subscribeOpen, getOpenSnapshot, () => "0") === "1";
}

export function setLeaderboardOpen(open: boolean) {
  writeLeaderboardOpen(open);
}
