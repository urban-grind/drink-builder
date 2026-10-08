import { ensureVoterId } from "@/lib/local-votes";

/** Tells the review page about a visit or a share/download tap. Failures stay quiet. */
export function trackContest(kind: "visit" | "click", name: string): void {
  let visitorId = "";
  try {
    visitorId = ensureVoterId();
  } catch {
    return;
  }
  const body = JSON.stringify({ visitorId, kind, name });
  try {
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon("/api/contest/hit", new Blob([body], { type: "application/json" }));
      if (sent) return;
    }
  } catch {
    // Fall through to fetch.
  }
  void fetch("/api/contest/hit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
