/** Wednesday, October 7, 2026 at 7:00 p.m. Eastern Time. */
export const COMING_SOON_AT = Date.parse("2026-10-07T19:00:00-04:00");

const FLAG = "COMING_SOON";

/**
 * On only when COMING_SOON is 1, true, or yes.
 * Unset, empty, or anything else leaves the site open.
 */
export function comingSoonEnabled(): boolean {
  const value = process.env[FLAG]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** Files the coming soon page itself needs. Everything else stays covered. */
export function comingSoonAllowsAsset(pathname: string): boolean {
  if (pathname === "/favicon.ico" || pathname === "/urban-grind-logo.png") return true;
  if (pathname === "/icon" || pathname === "/icon.png" || pathname.startsWith("/apple-icon")) return true;
  if (pathname.startsWith("/coming-soon/")) return true;
  if (pathname === "/api/coming-soon/hit" || pathname === "/api/contest/hit") return true;
  if (pathname.startsWith("/_next/static/") || pathname.startsWith("/_next/webpack-hmr")) return true;
  return false;
}

const REVIEW_ENTRY =
  /^\/api\/photos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(?:moderate|image)$/i;

/**
 * The password page itself, plus the calls it needs once the cafe is signed in.
 * Unsigned visitors get the login screen and an empty list. The public contest stays covered.
 */
export function comingSoonAllowsReview(pathname: string, reviewer: boolean): boolean {
  if (pathname === "/photos/review" || pathname === "/photos/review/") return true;
  if (
    pathname === "/api/photos/review" ||
    pathname === "/api/photos/review/login" ||
    pathname === "/api/photos/review/logout"
  ) {
    return true;
  }
  if (!reviewer) return false;
  if (pathname === "/api/photos" || pathname === "/api/photos/upload" || pathname.startsWith("/api/photos/upload/")) {
    return true;
  }
  return REVIEW_ENTRY.test(pathname);
}

export type ComingSoonLeft = {
  open: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function comingSoonLeft(now: number, opensAt = COMING_SOON_AT): ComingSoonLeft {
  const remaining = opensAt - now;
  if (remaining <= 0) return { open: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    open: false,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function comingSoonLabel(left: ComingSoonLeft): string {
  if (left.open) return "Opening soon";
  return `${count(left.days, "day")}, ${count(left.hours, "hour")}, ${count(left.minutes, "minute")}, ${count(left.seconds, "second")}`;
}

function count(value: number, word: string): string {
  return `${value} ${word}${value === 1 ? "" : "s"}`;
}

const CLOCK = ["hours", "minutes", "seconds"] as const;

function clockHours(left: ComingSoonLeft): number {
  return left.days * 24 + left.hours;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** A full document. No app markup, so nothing behind the gate is in the response. */
export function comingSoonHtml(now: number): string {
  const left = comingSoonLeft(now);
  const parts = { hours: clockHours(left), minutes: left.minutes, seconds: left.seconds };
  const startsIn = left.open
    ? "Opening soon"
    : `Starts in ${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
  const boxes = CLOCK.map((key) => {
    return `<div class="unit"><strong id="${key}">${pad(parts[key])}</strong><span id="${key}-label">${key}</span></div>`;
  }).join("");
  const aria = left.open
    ? "Opening soon"
    : `${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Coming soon · Urban Grind</title>
<link rel="icon" href="/favicon.ico">
<style>
@font-face{font-family:Recoleta;src:url("https://cdn3.editmysite.com/app/website/static/fonts/Recoleta/recoleta-bold-webfont.woff2") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:Larsseit;src:url("https://cdn3.editmysite.com/app/website/static/fonts/Larsseit/4dffda3e-4fc2-4e11-b974-4711b81c169e.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:Larsseit;src:url("https://cdn3.editmysite.com/app/website/static/fonts/Larsseit/38f62b25-9bb5-4b8f-ab6d-8a5d73286ec1.woff2") format("woff2");font-weight:700;font-style:normal;font-display:swap}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{background:#f7f4ec;color:#274b3a;font-family:Larsseit,"Avenir Next","Segoe UI",sans-serif;overflow-x:hidden}
main{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:safe center;padding:1.5rem 1rem 2rem;text-align:center}
.logo{width:min(11.5rem,58vw);height:auto}
.cafe{display:inline-flex;align-items:center;gap:.4rem;margin-top:.85rem;padding:.38rem .7rem .38rem .5rem;border:1px solid rgb(39 75 58 / 15%);border-radius:999px;background:#fff;color:inherit;font-size:.82rem;font-weight:700;line-height:1;text-decoration:none;box-shadow:0 1px 2px rgb(39 75 58 / 8%)}
.cafe svg{display:block;flex:none}
.tagline{margin:1.15rem 0 0;font-size:.72rem;font-weight:700;letter-spacing:.22em;text-transform:uppercase}
h1{margin:.55rem 0 0;font-family:Recoleta,"Iowan Old Style",Palatino,Georgia,serif;font-size:clamp(2.35rem,6.4vw,3.7rem);font-weight:600;line-height:.98;letter-spacing:-.01em}
.stage{display:flex;align-items:center;justify-content:center;gap:.7rem;width:min(46rem,100%);margin-top:1.05rem}
.stack{position:relative;width:min(26rem,70vw);height:min(14.2rem,44vw);flex:none}
.card{position:absolute;width:54%;height:94%;object-fit:cover;border:7px solid #fff;border-radius:1.15rem;box-shadow:0 16px 32px rgb(39 75 58 / 16%);background:#fff}
.card.left{left:0;top:8%;transform:rotate(-8deg);object-position:center 46%}
.card.right{right:0;top:10%;transform:rotate(8deg);object-position:center 42%}
.card.center{left:50%;top:0;width:50%;height:100%;transform:translateX(-50%) rotate(1.5deg);z-index:1;object-position:center 58%}
.mark{flex:none;width:2.7rem;height:2.7rem;border-radius:999px;display:grid;place-items:center}
.skip{border:1.5px solid #274b3a}
.love{background:#274b3a;color:#f7f4ec}
.when{margin:2.75rem 0 0;font-size:.95rem}
.clock{display:flex;gap:.55rem;margin-top:.85rem}
.unit{min-width:4.5rem;background:#fff;border-radius:.9rem;padding:.7rem .5rem .55rem;box-shadow:0 8px 18px rgb(39 75 58 / 6%)}
.unit strong{display:block;font-family:Recoleta,"Iowan Old Style",Palatino,Georgia,serif;font-size:1.7rem;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.unit span{display:block;margin-top:.3rem;font-size:.58rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
.how{width:min(46rem,100%);margin-top:1.7rem;padding-top:1.45rem;border-top:1px solid rgb(39 75 58 / 14%)}
.how h2{margin:0;font-family:Recoleta,"Iowan Old Style",Palatino,Georgia,serif;font-size:clamp(1.85rem,5vw,2.45rem);font-weight:600;line-height:1.05}
.how-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:1.15rem;text-align:left}
.how-card{background:#fff;border-radius:1.15rem;padding:1rem 1.05rem 1.05rem;box-shadow:0 10px 24px rgb(39 75 58 / 7%)}
.how-card:not(:last-child){opacity:.74}
.how-card:last-child{background:#d8f3e0}
.how-top{display:flex;align-items:center;justify-content:space-between;color:#274b3a}
.num-row{display:flex;align-items:baseline;gap:.4rem;min-width:0}
.num{font-size:.72rem;font-weight:700;letter-spacing:.06em;opacity:.4}
.starts,.picked{font-size:.68rem;font-weight:700;letter-spacing:.01em;opacity:.8;white-space:nowrap}
.live{display:inline-flex;align-items:center;gap:.28rem;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.live::before{content:"";width:.38rem;height:.38rem;border-radius:999px;background:#274b3a}
.how-card h3{margin:.65rem 0 0;font-size:1.05rem;line-height:1.2}
.how-copy{margin:.4rem 0 0;font-size:.92rem;line-height:1.45;color:#3e5c4d}
.how-tag{margin:.75rem 0 0;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.story-btn{display:block;width:100%;margin-top:.85rem;border:0;border-radius:999px;background:#274b3a;color:#f7f4ec;font:inherit;font-size:.82rem;font-weight:700;padding:.72rem .9rem;cursor:pointer}
.story-btn:disabled{opacity:.65}
.head-note{margin:.45rem 0 0;font-size:.78rem;line-height:1.35;color:#5d7468}
.head-note:empty{display:none}
.ready{margin:1.15rem 0 0;font-size:.95rem;color:#5d7468}
@media (max-width:640px){
.how-grid{grid-template-columns:1fr}
.stage{gap:.4rem}
.stack{width:min(18.5rem,68vw);height:min(12.2rem,46vw)}
.mark{width:2.35rem;height:2.35rem}
}
</style>
</head>
<body>
<main>
<img class="logo" src="/urban-grind-logo.png" alt="Urban Grind Coffee Co.">
<a class="cafe" href="https://urbangrind.ca"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9.2 5.5V3.6c0-1.25 1.25-2.2 2.8-2.2s2.8.95 2.8 2.2v1.9z"/><path fill="currentColor" fill-rule="evenodd" d="M2.2 5.1h19.6a1.45 1.45 0 0 1 0 2.9H2.2a1.45 1.45 0 0 1 0-2.9zM10.7 5.7h2.6v1.5h-2.6z"/><path fill="currentColor" fill-rule="evenodd" d="M4.3 8.3h15.4l-1.45 12a1.45 1.45 0 0 1-1.43 1.28H7.18a1.45 1.45 0 0 1-1.43-1.28zm.9 3.9h13.5l-.28 2.7H5.48z"/></svg>Need a pick me up?</a>
<p class="tagline">Sip. Snap. Swipe.</p>
<h1>Win free coffee<br>for a month.</h1>
<div class="stage">
<div class="mark skip" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg></div>
<div class="stack">
<img class="card left" src="/coming-soon/latte-counter.jpg?v=2" alt="Iced coffee in an Urban Grind cup">
<img class="card right" src="/coming-soon/cup-beans.jpg?v=2" alt="Urban Grind cup on coffee beans">
<img class="card center" src="/coming-soon/latte-lot.jpg?v=2" alt="Iced coffee in an Urban Grind cup outside the café">
</div>
<div class="mark love" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 20.2s-6.6-4.1-6.6-8.6C5.4 8.7 7.1 7 9.3 7c1.2 0 2.3.6 2.7 1.5.4-.9 1.5-1.5 2.7-1.5 2.2 0 3.9 1.7 3.9 4.6 0 4.5-6.6 8.6-6.6 8.6z"/></svg></div>
</div>
<p class="when">Wednesday, October 7 · 7:00 p.m. Eastern</p>
<div class="clock" id="count" role="timer" aria-label="${aria}" data-opens="${COMING_SOON_AT}">${boxes}</div>
<section class="how" aria-labelledby="how-title">
<h2 id="how-title">Four ways to win.</h2>
<div class="how-grid">
<article class="how-card">
<div class="how-top"><span class="num-row"><span class="num">01</span><span class="starts">${startsIn}</span></span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8.5h3.2l1.4-2h6.8l1.4 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.1"/></svg></div>
<h3>Get the most votes</h3>
<p class="how-copy">Upload your Urban Grind drink photo and get your friends voting. The photo with the most votes wins.</p>
<p class="how-tag">Photo contest winner</p>
</article>
<article class="how-card">
<div class="how-top"><span class="num-row"><span class="num">02</span><span class="picked">Picked Oct 26th</span></span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.6l2.2 4.8 5.3.7-3.9 3.6.9 5.3L12 15.6 7.5 18l.9-5.3L4.5 9.1l5.3-.7z"/></svg></div>
<h3>Catch our eye</h3>
<p class="how-copy">Our team will choose a favourite photo to win free coffee for a month.</p>
<p class="how-tag">UG favourite winner</p>
</article>
<article class="how-card">
<div class="how-top"><span class="num-row"><span class="num">03</span><span class="starts">${startsIn}</span></span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h11M15 5l3 3-3 3"/><path d="M17 16H6M9 13l-3 3 3 3"/></svg></div>
<h3>Swipe for a chance to win</h3>
<p class="how-copy">Swipe right for photos you love, left to skip. Every swipe counts as one entry into our draw. One entry per photo reviewed.</p>
<p class="how-tag">Voting draw winner</p>
</article>
<article class="how-card">
<div class="how-top"><span class="num-row"><span class="num">04</span><span class="live">Live</span></span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M4.5 11.2L20 4.5l-6 15.2-2.5-6.2z"/><path d="M11.5 13.5L20 4.5"/></svg></div>
<h3>Share to your story</h3>
<p class="how-copy">Share the contest to your Instagram story and tag us. Each share counts as one entry into our sharing draw.</p>
<p class="how-tag">Sharing draw winner</p>
<button type="button" class="story-btn" id="head-start">Download the story</button>
<p class="head-note" id="head-note"></p>
</article>
</div>
</section>
<p class="ready">Grab your drink. Get your photo ready.</p>
</main>
<script>
(function () {
  var key = "ug-coming-soon";
  function visitorId() {
    try {
      var existing = localStorage.getItem(key);
      if (existing) return existing;
      if (!window.crypto || !crypto.randomUUID) return "";
      var created = crypto.randomUUID();
      localStorage.setItem(key, created);
      return created;
    } catch (error) {
      return "";
    }
  }
  function track(kind, name) {
    var id = visitorId();
    if (!id) return;
    var body = JSON.stringify({ visitorId: id, kind: kind, name: name });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/coming-soon/hit", new Blob([body], { type: "application/json" }));
        return;
      }
    } catch (error) {}
    fetch("/api/coming-soon/hit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body,
      keepalive: true
    }).catch(function () {});
  }
  track("visit", "page");
  window.ugTrack = track;
})();
(function () {
  var root = document.getElementById("count");
  var opens = Number(root.getAttribute("data-opens"));
  var units = ["hours","minutes","seconds"];
  var starts = document.querySelectorAll(".starts");
  function pad(value) { return String(value).padStart(2, "0"); }
  function render() {
    var left = Math.max(0, opens - Date.now());
    var total = Math.floor(left / 1000);
    var days = Math.floor(total / 86400);
    var parts = [days * 24 + Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60];
    var label = left <= 0 ? "Opening soon" : "Starts in " + pad(parts[0]) + ":" + pad(parts[1]) + ":" + pad(parts[2]);
    if (left <= 0) root.setAttribute("aria-label", "Opening soon");
    else root.setAttribute("aria-label", parts[0] + " hours, " + parts[1] + " minutes, " + parts[2] + " seconds");
    for (var i = 0; i < units.length; i++) document.getElementById(units[i]).textContent = pad(parts[i]);
    for (var s = 0; s < starts.length; s++) starts[s].textContent = label;
  }
  render();
  setInterval(render, 1000);
})();
(function () {
  var button = document.getElementById("head-start");
  var note = document.getElementById("head-note");
  var fileName = "Urban-Grind-Story.png";
  var blob = null;
  var busy = false;
  var loading = fetch("/coming-soon/sip-snap-swipe.png?v=6").then(function (response) {
    if (!response.ok) throw new Error("missing");
    return response.blob();
  }).then(function (data) {
    blob = data;
    return data;
  });
  function probe() {
    var bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), function (char) {
      return char.charCodeAt(0);
    });
    return new File([bytes], "probe.png", { type: "image/png" });
  }
  function phoneShares() {
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) return false;
    try { return navigator.canShare({ files: [probe()] }); }
    catch (error) { return false; }
  }
  function settle(message) {
    busy = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    note.textContent = message || "";
  }
  function download(data) {
    var url = URL.createObjectURL(data);
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    settle("");
  }
  function handOff(data) {
    if (!phoneShares()) {
      download(data);
      return;
    }
    var file = new File([data], fileName, { type: data.type || "image/png" });
    navigator.share({ files: [file] }).then(function () {
      settle("");
    }).catch(function (error) {
      var name = error && error.name;
      if (name === "AbortError" || name === "InvalidStateError") {
        settle("");
        return;
      }
      settle("The share sheet didn't open. Try again.");
    });
  }
  button.addEventListener("click", function () {
    if (busy) return;
    if (window.ugTrack) window.ugTrack("click", "story");
    busy = true;
    button.setAttribute("aria-busy", "true");
    note.textContent = "";
    if (blob) {
      handOff(blob);
      return;
    }
    button.disabled = true;
    loading.then(handOff).catch(function () {
      settle("The story didn't open. Try again.");
    });
  });
})();
</script>
</body>
</html>`;
}
