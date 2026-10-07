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
  if (pathname.startsWith("/_next/static/") || pathname.startsWith("/_next/webpack-hmr")) return true;
  return false;
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
.drops{margin:1.05rem 0 0;font-size:.74rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
.when{margin:.35rem 0 0;font-size:.95rem}
.clock{display:flex;gap:.55rem;margin-top:.85rem}
.unit{min-width:4.5rem;background:#fff;border-radius:.9rem;padding:.7rem .5rem .55rem;box-shadow:0 8px 18px rgb(39 75 58 / 6%)}
.unit strong{display:block;font-family:Recoleta,"Iowan Old Style",Palatino,Georgia,serif;font-size:1.7rem;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.unit span{display:block;margin-top:.3rem;font-size:.58rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
.how{width:min(46rem,100%);margin-top:1.7rem;padding-top:1.45rem;border-top:1px solid rgb(39 75 58 / 14%)}
.how h2{margin:0;font-family:Recoleta,"Iowan Old Style",Palatino,Georgia,serif;font-size:clamp(1.85rem,5vw,2.45rem);font-weight:600;line-height:1.05}
.how-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:1.15rem;text-align:left}
.how-card{background:#fff;border-radius:1.15rem;padding:1rem 1.05rem 1.05rem;box-shadow:0 10px 24px rgb(39 75 58 / 7%)}
.how-top{display:flex;align-items:center;justify-content:space-between;color:#274b3a}
.num{font-size:.72rem;font-weight:700;letter-spacing:.06em;opacity:.4}
.how-card h3{margin:.65rem 0 0;font-size:1.05rem;line-height:1.2}
.how-copy{margin:.4rem 0 0;font-size:.92rem;line-height:1.45;color:#3e5c4d}
.how-tag{margin:.75rem 0 0;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
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
<p class="drops">Drops tonight at 7</p>
<p class="when">Wednesday, October 7 · 7:00 p.m. Eastern</p>
<div class="clock" id="count" role="timer" aria-label="${aria}" data-opens="${COMING_SOON_AT}">${boxes}</div>
<section class="how" aria-labelledby="how-title">
<h2 id="how-title">Four ways to win.</h2>
<div class="how-grid">
<article class="how-card">
<div class="how-top"><span class="num">01</span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8.5h3.2l1.4-2h6.8l1.4 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.1"/></svg></div>
<h3>Get the most votes</h3>
<p class="how-copy">Upload your Urban Grind drink photo and get your friends voting. The photo with the most votes wins.</p>
<p class="how-tag">One photo winner</p>
</article>
<article class="how-card">
<div class="how-top"><span class="num">02</span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.6l2.2 4.8 5.3.7-3.9 3.6.9 5.3L12 15.6 7.5 18l.9-5.3L4.5 9.1l5.3-.7z"/></svg></div>
<h3>Catch our eye</h3>
<p class="how-copy">Our team will choose a favourite photo to win free coffee for a month.</p>
<p class="how-tag">One team pick</p>
</article>
<article class="how-card">
<div class="how-top"><span class="num">03</span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h11M15 5l3 3-3 3"/><path d="M17 16H6M9 13l-3 3 3 3"/></svg></div>
<h3>Swipe for a chance to win</h3>
<p class="how-copy">Swipe right for photos you love, left to skip. Every swipe counts as one entry into our draw. One entry per photo reviewed.</p>
<p class="how-tag">One swiper draw winner</p>
</article>
<article class="how-card">
<div class="how-top"><span class="num">04</span><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M4.5 11.2L20 4.5l-6 15.2-2.5-6.2z"/><path d="M11.5 13.5L20 4.5"/></svg></div>
<h3>Share to your story</h3>
<p class="how-copy">Share the contest to your Instagram story and tag us. Each share counts as one entry into our sharing draw.</p>
<p class="how-tag">One sharing draw winner</p>
</article>
</div>
</section>
<p class="ready">Grab your drink. Get your photo ready.</p>
</main>
<script>
(function () {
  var root = document.getElementById("count");
  var opens = Number(root.getAttribute("data-opens"));
  var units = ["hours","minutes","seconds"];
  function pad(value) { return String(value).padStart(2, "0"); }
  function render() {
    var left = Math.max(0, opens - Date.now());
    var total = Math.floor(left / 1000);
    var days = Math.floor(total / 86400);
    var parts = [days * 24 + Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60];
    if (left <= 0) root.setAttribute("aria-label", "Opening soon");
    else root.setAttribute("aria-label", parts[0] + " hours, " + parts[1] + " minutes, " + parts[2] + " seconds");
    for (var i = 0; i < units.length; i++) document.getElementById(units[i]).textContent = pad(parts[i]);
  }
  render();
  setInterval(render, 1000);
})();
</script>
</body>
</html>`;
}
