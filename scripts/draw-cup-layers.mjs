import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const GREEN = "#274b3a";
const CREAM = "#f3f2ef";
const WHITE = "#ffffff";
const COFFEE = "#4A3024";
const COFFEE_DARK = "#2A1A12";

const cupPath = "M86 132 H214 L198 286 Q150 312 102 286 Z";
const clip = `<defs><clipPath id="cup"><path d="${cupPath}"/></clipPath></defs>`;

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="390" viewBox="0 0 300 390">${body}</svg>`;
}

function steam() {
  return `<g fill="none" stroke="${COFFEE}" stroke-width="3" stroke-linecap="round" opacity="0.55">
    <path d="M118 120 C114 96 132 94 126 68"/>
    <path d="M150 116 C146 90 166 88 158 60"/>
    <path d="M182 122 C186 98 168 96 174 72"/>
  </g>`;
}

function ice() {
  return `<g>
    <g transform="translate(112 176) rotate(-18)"><rect width="40" height="28" rx="6" fill="${WHITE}" opacity="0.9"/></g>
    <g transform="translate(154 204) rotate(14)"><rect width="34" height="26" rx="6" fill="${CREAM}" opacity="0.85"/></g>
    <g transform="translate(126 230) rotate(-8)"><rect width="28" height="22" rx="5" fill="${WHITE}" opacity="0.7"/></g>
  </g>`;
}

function liquid(color, top, extra = "") {
  return `${clip}<g clip-path="url(#cup)"><rect x="70" y="${top}" width="170" height="${330 - top}" fill="${color}"/>${extra}</g>`;
}

function milkBand(fill, cy, rx, ry) {
  return `${clip}<g clip-path="url(#cup)"><ellipse cx="150" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/></g>`;
}

function drizzle(stroke, d, width) {
  return `${clip}<g clip-path="url(#cup)"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/></g>`;
}

function syrup(fill) {
  return `<rect x="28" y="168" width="18" height="54" rx="8" fill="${fill}"/>
    <rect x="32" y="158" width="10" height="14" rx="2" fill="${GREEN}"/>`;
}

function specks(dots) {
  const circles = dots
    .map(([cx, cy, r, fill]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`)
    .join("");
  return `${clip}<g clip-path="url(#cup)">${circles}</g>`;
}

function foam(body) {
  return body;
}

const layers = {
  cup: `<ellipse cx="150" cy="318" rx="104" ry="16" fill="${GREEN}" opacity="0.14"/>
    <ellipse cx="150" cy="312" rx="80" ry="10" fill="${CREAM}"/>
    <path d="M214 168 C260 174 258 252 202 258" fill="none" stroke="${GREEN}" stroke-width="8" stroke-linecap="round"/>
    <path d="${cupPath}" fill="${WHITE}" fill-opacity="0.35" stroke="${GREEN}" stroke-width="3"/>
    <ellipse cx="150" cy="132" rx="64" ry="13" fill="none" stroke="${GREEN}" stroke-width="3"/>
    <path d="M118 138 C126 148 140 148 148 138" fill="none" stroke="${WHITE}" stroke-width="2" opacity="0.8"/>`,
  "double-espresso": liquid(COFFEE_DARK, 214) + steam(),
  "cold-brew": liquid(COFFEE_DARK, 158, ice()),
  "iced-coffee": liquid(COFFEE, 156, ice()),
  "drip-coffee": liquid(COFFEE, 168) + steam(),
  chai: liquid(CREAM, 164, `<rect x="70" y="164" width="170" height="22" fill="${COFFEE}"/>`) + steam(),
  matcha: liquid(GREEN, 160),
  milk: milkBand(WHITE, 186, 54, 16),
  cream: milkBand(CREAM, 176, 60, 20),
  oat: milkBand(CREAM, 190, 48, 12),
  almond: milkBand(WHITE, 194, 44, 14),
  "protein-milk": milkBand(WHITE, 184, 50, 12) + milkBand(GREEN, 196, 36, 4),
  "white-chocolate": drizzle(CREAM, "M108 206 C132 176 168 228 196 190", 8),
  "dark-chocolate": drizzle(COFFEE_DARK, "M106 214 C140 168 162 236 198 186", 7),
  caramel: drizzle(COFFEE, "M110 198 C148 236 152 160 194 210", 8),
  vanilla: syrup(CREAM),
  "salted-caramel": syrup(COFFEE),
  hazelnut: syrup(COFFEE_DARK),
  "toasted-marshmallow": syrup(WHITE),
  "sea-salt": specks([
    [122, 176, 3.2, WHITE],
    [136, 166, 2.4, CREAM],
    [148, 180, 2, WHITE],
    [160, 168, 3, CREAM],
  ]),
  cinnamon: specks([
    [128, 172, 2.2, COFFEE],
    [140, 164, 1.8, COFFEE_DARK],
    [152, 176, 2.4, COFFEE],
    [166, 168, 1.6, COFFEE_DARK],
    [144, 184, 1.8, COFFEE],
  ]),
  "cinnamon-sugar": specks([
    [126, 170, 2.6, CREAM],
    [140, 180, 2.2, COFFEE],
    [154, 166, 2.8, WHITE],
    [168, 176, 2, COFFEE_DARK],
    [136, 160, 1.8, CREAM],
  ]),
  "cocoa-powder": `${clip}<g clip-path="url(#cup)"><ellipse cx="146" cy="174" rx="34" ry="9" fill="${COFFEE_DARK}"/></g>`,
  "vanilla-cold-foam": foam(`<ellipse cx="150" cy="112" rx="58" ry="16" fill="${CREAM}"/>`),
  "salted-caramel-cold-foam": foam(`<ellipse cx="150" cy="114" rx="64" ry="12" fill="${COFFEE}"/>`),
  "cheesecake-cold-foam": foam(`<path d="M92 126 Q150 78 208 126 Q150 108 92 126" fill="${CREAM}"/>`),
  "chocolate-cold-foam": foam(`<ellipse cx="150" cy="114" rx="54" ry="18" fill="${COFFEE_DARK}"/>`),
};

const outDir = path.resolve("public/cup-layers");
await mkdir(outDir, { recursive: true });

const keep = new Set(["cup", "double-espresso"]);
for (const [name, body] of Object.entries(layers)) {
  if (keep.has(name)) continue;
  const png = new Resvg(svg(body), { fitTo: { mode: "width", value: 600 } }).render().asPng();
  await writeFile(path.join(outDir, `${name}.png`), png);
}

console.log(`wrote ${Object.keys(layers).length} pictures`);
