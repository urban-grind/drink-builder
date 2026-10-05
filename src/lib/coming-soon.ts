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

const UNITS = [
  ["days", "day"],
  ["hours", "hour"],
  ["minutes", "minute"],
  ["seconds", "second"],
] as const;

/** A full document. No app markup, so nothing behind the gate is in the response. */
export function comingSoonHtml(now: number): string {
  const left = comingSoonLeft(now);
  const boxes = UNITS.map(([key, word]) => {
    const value = left[key];
    return `<div class="unit"><strong id="${key}">${value}</strong><span id="${key}-label">${value === 1 ? word : key}</span></div>`;
  }).join("");
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
body{background:#f3f2ef;color:#274b3a;font-family:Larsseit,"Avenir Next","Segoe UI",sans-serif}
main{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2.5rem 1.25rem;text-align:center}
.logo{width:min(16rem,72vw);height:auto}
.eyebrow{margin:2rem 0 0;font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
h1{margin:.4rem 0 0;font-family:Recoleta,"Iowan Old Style",Palatino,Georgia,serif;font-size:clamp(2.1rem,6vw,3.25rem);font-weight:600;line-height:1.05}
.when{margin:.7rem 0 0;font-size:1.05rem}
.clock{display:flex;gap:.6rem;margin-top:1.6rem}
.unit{min-width:4.4rem;background:#fff;border-radius:1rem;padding:.75rem .55rem .6rem;box-shadow:0 8px 20px rgb(39 75 58 / 6%)}
.unit strong{display:block;font-family:Recoleta,"Iowan Old Style",Palatino,Georgia,serif;font-size:1.8rem;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.unit span{display:block;margin-top:.35rem;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
</style>
</head>
<body>
<main>
<img class="logo" src="/urban-grind-logo.png" alt="Urban Grind Coffee Co.">
<p class="eyebrow">Coming soon</p>
<h1>Wednesday, October 7</h1>
<p class="when">7:00 p.m. Eastern</p>
<div class="clock" id="count" role="timer" aria-label="${comingSoonLabel(left)}" data-opens="${COMING_SOON_AT}">${boxes}</div>
</main>
<script>
(function () {
  var root = document.getElementById("count");
  var opens = Number(root.getAttribute("data-opens"));
  var units = [["days","day"],["hours","hour"],["minutes","minute"],["seconds","second"]];
  function render() {
    var left = Math.max(0, opens - Date.now());
    var total = Math.floor(left / 1000);
    var parts = [Math.floor(total / 86400), Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60];
    var words = [];
    if (left <= 0) {
      root.setAttribute("aria-label", "Opening soon");
    }
    for (var i = 0; i < units.length; i++) {
      document.getElementById(units[i][0]).textContent = String(parts[i]);
      var label = parts[i] === 1 ? units[i][1] : units[i][0];
      document.getElementById(units[i][0] + "-label").textContent = label;
      words.push(parts[i] + " " + label);
    }
    if (left > 0) root.setAttribute("aria-label", words.join(", "));
  }
  render();
  setInterval(render, 1000);
})();
</script>
</body>
</html>`;
}
