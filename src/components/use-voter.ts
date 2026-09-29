"use client";

import { useSyncExternalStore } from "react";
import { ensureVoterId, readVoteIds } from "@/lib/local-votes";

type VoterSnapshot = {
  voterId: string | null;
  voteIds: string[];
};

const serverSnapshot = JSON.stringify({
  voterId: null,
  voteIds: [],
} satisfies VoterSnapshot);

function subscribe(onStoreChange: () => void) {
  window.addEventListener("drink-votes", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("drink-votes", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getClientSnapshot() {
  const snapshot: VoterSnapshot = {
    voterId: ensureVoterId(),
    voteIds: readVoteIds(),
  };
  return JSON.stringify(snapshot);
}

export function useVoter() {
  const raw = useSyncExternalStore(subscribe, getClientSnapshot, () => serverSnapshot);
  const snapshot = JSON.parse(raw) as VoterSnapshot;
  const voteIds = snapshot.voteIds;

  return {
    voterId: snapshot.voterId,
    voteIds,
    ready: snapshot.voterId !== null,
  };
}
