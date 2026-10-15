#!/usr/bin/env node
// Surveys the last year of GitHub activity and draws it as a topographic sheet.
// The contribution calendar becomes a height field, contoured with marching
// squares; featured repos become waypoint plates with their own route profile.
// No dependencies: Node 20+ (global fetch). Output goes to ./dist.
//
//   GITHUB_TOKEN=... node scripts/survey.mjs [login]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist");
const LOGIN = process.argv[2] || process.env.SURVEY_LOGIN || "noderaven";
const TOKEN = process.env.SURVEY_TOKEN || process.env.GITHUB_TOKEN;

// Repos shown as waypoint plates, in display order.
const WAYPOINTS = [
  "parallel-lanes",
  "solid-macro",
  "casebound-converter",
  "payload-obfuscator",
  "strava-overlay",
  "breach-web-scraper",
];

const BIO = [
  "Security & IT engineer who ships.",
  "I harden identity, Microsoft 365 and endpoints, study how",
  "systems break, and build the tools that come out of it.",
];

const THEMES = {
  light: {
    paper: "#E8ECE4", ink: "#1E2622", muted: "#5A6660", grid: "#B4BDB0",
    contour: "#B48A60", index: "#7D5530", magenta: "#B0186E", blue: "#2C64A0",
    neat: "#3A4540", fill: "#D9DFD3",
  },
  dark: {
    paper: "#121A1F", ink: "#E3E1D6", muted: "#8E9A98", grid: "#2C383E",
    contour: "#5F513B", index: "#A6875C", magenta: "#F0559F", blue: "#78A6D6",
    neat: "#7C8A88", fill: "#1A242A",
  },
};

// ---------------------------------------------------------------- data

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

async function commitActivity(repo) {
  // The stats endpoint answers 202 while GitHub computes; give it a few tries.
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`https://api.github.com/repos/${LOGIN}/${repo}/stats/commit_activity`, {
      headers: { Authorization: `bearer ${TOKEN}`, Accept: "application/vnd.github+json" },
    });
    if (res.status === 200) {
      const weeks = await res.json();
      if (Array.isArray(weeks)) return weeks.map((w) => w.total);
    }
    if (res.status !== 202) return null;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}

async function survey() {
  const data = await gql(
    `query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount weekday } }
          }
        }
        repositories(first: 100, privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false) {
          nodes {
            name description stargazerCount pushedAt url
            primaryLanguage { name color }
            languages(first: 10) { edges { size node { name color } } }
          }
        }
      }
    }`,
    { login: LOGIN },
  );
  const user = data.user;
  const cal = user.contributionsCollection.contributionCalendar;
  const repos = user.repositories.nodes;
  const featured = [];
  for (const name of WAYPOINTS) {
    const repo = repos.find((r) => r.name === name);
    if (!repo) continue;
    featured.push({ ...repo, activity: await commitActivity(name) });
  }
  return { cal, repos, featured };
}

// ---------------------------------------------------------------- helpers

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const r1 = (n) => Math.round(n * 10) / 10;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const fmtShort = (iso) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

const FONT = readFileSync(join(ROOT, "assets/fonts/archivo.woff2")).toString("base64");
const FONT_ITALIC = readFileSync(join(ROOT, "assets/fonts/archivo-italic.woff2")).toString("base64");
const fontFaces = (italic = true) => `
  @font-face { font-family: "Archivo"; font-style: normal; font-weight: 100 900; font-stretch: 62% 125%;
    src: url(data:font/woff2;base64,${FONT}) format("woff2"); }
  ${italic ? `@font-face { font-family: "Archivo"; font-style: italic; font-weight: 100 900; font-stretch: 62% 125%;
    src: url(data:font/woff2;base64,${FONT_ITALIC}) format("woff2"); }` : ""}`;

// Rough advance width for Archivo at normal width, in ems. Good enough to wrap.
const textWidth = (s, size, k = 0.54) => s.length * size * k;

function wrap(text, maxChars, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s,.;:]*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

// Marching squares over a grid, returning chained polylines for one level.
function isolines(grid, cols, rows, level, toXY) {
  const segs = [];
  const v = (i, j) => grid[j * cols + i];
  const lerp = (a, b) => (level - a) / (b - a);
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      const code = (a > level) * 8 + (b > level) * 4 + (c > level) * 2 + (d > level);
      if (code === 0 || code === 15) continue;
      const top = [i + lerp(a, b), j], right = [i + 1, j + lerp(b, c)];
      const bottom = [i + lerp(d, c), j + 1], left = [i, j + lerp(a, d)];
      const center = (a + b + c + d) / 4 > level;
      const table = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
        5: center ? [[left, top], [bottom, right]] : [[left, bottom], [top, right]],
        6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]], 9: [[top, bottom]],
        10: center ? [[top, right], [left, bottom]] : [[left, top], [bottom, right]],
        11: [[top, right]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]],
      };
      for (const s of table[code]) segs.push(s);
    }
  }
  // Chain segments end to end.
  const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const byPoint = new Map();
  segs.forEach((s, idx) => {
    for (const p of s) {
      const k = key(p);
      if (!byPoint.has(k)) byPoint.set(k, []);
      byPoint.get(k).push(idx);
    }
  });
  const used = new Uint8Array(segs.length);
  const lines = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const line = [segs[s][0], segs[s][1]];
    for (const end of [1, 0]) {
      for (;;) {
        const tip = end ? line[line.length - 1] : line[0];
        const next = (byPoint.get(key(tip)) || []).find((n) => !used[n]);
        if (next === undefined) break;
        used[next] = 1;
        const [p, q] = segs[next];
        const other = key(p) === key(tip) ? q : p;
        end ? line.push(other) : line.unshift(other);
      }
    }
    lines.push(line.map(([i, j]) => toXY(i, j)));
  }
  return lines;
}

// Catmull-Rom through points, emitted as cubic Béziers.
function smoothPath(pts) {
  if (pts.length < 3) return "";
  const closed = Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.01;
  const p = closed ? pts.slice(0, -1) : pts;
  const n = p.length;
  const at = (k) => (closed ? p[(k + n) % n] : p[Math.max(0, Math.min(n - 1, k))]);
  let d = `M${r1(p[0][0])} ${r1(p[0][1])}`;
  const last = closed ? n : n - 1;
  for (let k = 0; k < last; k++) {
    const p0 = at(k - 1), p1 = at(k), p2 = at(k + 1), p3 = at(k + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? d + "Z" : d;
}

const pathLength = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

// ---------------------------------------------------------------- hero sheet

function heroSheet(cal, themeName, surveyedAt) {
  const t = THEMES[themeName];
  const Wd = 900, Ht = 450;
  const mx = 58, my = 52, mw = 812, mh = 250; // map frame
  const weeks = cal.weeks;
  const nW = weeks.length;
  const colW = mw / nW, rowH = mh / 7;
  const dayXY = (w, d) => [mx + (w + 0.5) * colW, my + (d + 0.5) * rowH];

  const days = [];
  weeks.forEach((wk, w) => wk.contributionDays.forEach((day) => days.push({ ...day, w, d: day.weekday })));
  const active = days.filter((d) => d.contributionCount > 0);

  // Height field: one gaussian hill per day, height log2(1 + count).
  // The field runs past the frame so hills at the edges keep their shape;
  // the frame clips them like a map sheet cuts the terrain.
  const cell = 4, pad = 48;
  const cols = Math.ceil((mw + 2 * pad) / cell) + 1, rows = Math.ceil((mh + 2 * pad) / cell) + 1;
  const gx = (i) => mx - pad + i * cell, gy = (j) => my - pad + j * cell;
  const grid = new Float64Array(cols * rows);
  const sx = colW * 1.5, sy = rowH * 0.72;
  for (const day of active) {
    const [cx, cy] = dayXY(day.w, day.d);
    const h = Math.log2(1 + day.contributionCount);
    const i0 = Math.max(1, Math.floor((cx - 4 * sx - gx(0)) / cell)), i1 = Math.min(cols - 2, Math.ceil((cx + 4 * sx - gx(0)) / cell));
    const j0 = Math.max(1, Math.floor((cy - 4 * sy - gy(0)) / cell)), j1 = Math.min(rows - 2, Math.ceil((cy + 4 * sy - gy(0)) / cell));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = (gx(i) - cx) / sx, dy = (gy(j) - cy) / sy;
        grid[j * cols + i] += h * Math.exp(-(dx * dx + dy * dy) / 2);
      }
  }
  let peak = 0;
  for (const h of grid) peak = Math.max(peak, h);

  const ci = peak > 12 ? 0.75 : 0.5; // contour interval in height units
  const levels = [];
  for (let l = ci * 0.6; l < peak; l += ci) levels.push(l);
  const toXY = (i, j) => [gx(i), gy(j)];

  let contours = "";
  levels.forEach((level, li) => {
    const isIndex = (li + 1) % 5 === 0;
    for (const line of isolines(grid, cols, rows, level, toXY)) {
      if (line.length < 4 || pathLength(line) < 6) continue;
      const d = smoothPath(line);
      if (!d) continue;
      contours += `<path class="c${isIndex ? " ix" : ""}" style="animation-delay:${r1(0.15 + li * 0.07)}s" pathLength="1" d="${d}"/>`;
    }
  });

  // Summits: local maxima, strongest first, kept apart from one another.
  const maxima = [];
  for (let j = 1; j < rows - 1; j++)
    for (let i = 1; i < cols - 1; i++) {
      const h = grid[j * cols + i];
      if (h < ci * 2 || gx(i) < mx || gx(i) > mx + mw || gy(j) < my || gy(j) > my + mh) continue;
      let top = true;
      for (let dj = -1; dj <= 1 && top; dj++)
        for (let di = -1; di <= 1; di++) if ((di || dj) && grid[(j + dj) * cols + i + di] >= h) { top = false; break; }
      if (top) maxima.push({ x: gx(i), y: gy(j), h });
    }
  maxima.sort((a, b) => b.h - a.h);
  const summits = [];
  for (const m of maxima) {
    if (summits.length >= 5) break;
    if (summits.some((s) => Math.hypot(s.x - m.x, (s.y - m.y) * 0.6) < 70)) continue;
    // The busiest real day near this peak names it.
    let best = null;
    for (const d of active) {
      const [x, y] = dayXY(d.w, d.d);
      if (Math.hypot(x - m.x, y - m.y) > 2.2 * Math.max(colW, rowH)) continue;
      if (!best || d.contributionCount > best.contributionCount) best = d;
    }
    if (best) summits.push({ ...m, day: best });
  }
  summits.sort((a, b) => a.x - b.x);

  // Day grid: one survey point per day, like the familiar contribution grid.
  let points = "";
  for (const d of days) {
    const [x, y] = dayXY(d.w, d.d);
    points += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${d.contributionCount ? 1.3 : 0.9}"/>`;
  }

  // Collar: months along the top, weekdays down the side.
  let collar = "";
  let lastMonth = -1;
  weeks.forEach((wk, w) => {
    const m = new Date(wk.contributionDays[0].date).getUTCMonth();
    if (m !== lastMonth && w > 0) {
      const x = mx + w * colW;
      collar += `<line x1="${r1(x)}" y1="${my - 6}" x2="${r1(x)}" y2="${my}" class="tick"/>`;
      if (w < nW - 2) collar += `<text x="${r1(x + 4)}" y="${my - 9}" class="axis">${MONTHS[m]}</text>`;
    }
    lastMonth = m;
  });
  for (const [d, label] of [[1, "Mon"], [3, "Wed"], [5, "Fri"]]) {
    const y = my + (d + 0.5) * rowH;
    collar += `<text x="${mx - 9}" y="${r1(y + 4)}" class="axis" text-anchor="end">${label}</text>`;
  }

  // Name: set like a range label across the quietest stretch of terrain.
  const nameSize = 46, nameTrack = 12, name = LOGIN.toUpperCase();
  const nameW = name.length * (nameSize * 1.04 + nameTrack);
  let nameX = mx + 24, quiet = Infinity;
  for (let x = mx + 24; x + nameW < mx + mw - 24; x += 8) {
    let load = 0;
    for (let j = 1; j < rows - 1; j++) {
      const y = gy(j);
      if (y < my + mh * 0.25 || y > my + mh * 0.8) continue;
      for (let i = Math.floor((x - gx(0)) / cell); i < Math.floor((x + nameW - gx(0)) / cell); i++) load += grid[j * cols + i] || 0;
    }
    if (load < quiet - 0.01) { quiet = load; nameX = x; }
  }
  const nameY = my + mh * 0.56;

  // Flight line: from the start of the year through each summit to today.
  const today = dayXY(nW - 1, weeks.at(-1).contributionDays.length - 1);
  const route = [...summits.map((s) => [s.x, s.y]), today];
  const routeD = route.map((p, i) => `${i ? "L" : "M"}${r1(p[0])} ${r1(p[1])}`).join("");

  let summitMarks = "";
  summits.forEach((s, k) => {
    const flip = s.x > mx + mw - 90;
    const above = k % 2 === 1 || s.y > my + mh - 40;
    const lx = flip ? s.x - 10 : s.x + 10;
    const ly = above ? s.y - 14 : s.y + 20;
    const anchor = flip ? "end" : "start";
    summitMarks += `<g class="summit">
      <path d="M${r1(s.x)} ${r1(s.y - 6)}l5.5 9.5h-11z" class="tri"/>
      <text x="${r1(lx)}" y="${r1(ly)}" text-anchor="${anchor}" class="spot">${s.day.contributionCount}<tspan class="spotdate" dx="5">${fmtShort(s.day.date)}</tspan></text>
    </g>`;
  });

  const first = days[0].date, last = days.at(-1).date;
  const total = cal.totalContributions.toLocaleString("en-US");
  const fourWeeks = colW * 4;
  const my2 = my + mh;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht}" width="${Wd}" height="${Ht}" role="img" aria-labelledby="title desc">
<title id="title">${esc(LOGIN)}: a year of contributions surveyed as terrain</title>
<desc id="desc">Topographic map of ${total} GitHub contributions from ${fmtDate(first)} to ${fmtDate(last)}. Each day is a survey point; busy days rise into hills. ${summits.map((s) => `${s.day.contributionCount} on ${fmtDate(s.day.date)}`).join(", ")}.</desc>
<style>${fontFaces()}
  text { font-family: "Archivo", sans-serif; fill: ${t.ink}; font-variant-numeric: tabular-nums lining-nums; }
  .c { fill: none; stroke: ${t.contour}; stroke-width: 0.9; stroke-dasharray: 1; stroke-dashoffset: 0;
       animation: draw 1.6s cubic-bezier(.3,.1,.2,1) both; }
  .c.ix { stroke: ${t.index}; stroke-width: 1.6; }
  .pts circle { fill: ${t.grid}; }
  .neat { fill: none; stroke: ${t.neat}; stroke-width: 1; }
  .tick { stroke: ${t.neat}; stroke-width: 1; }
  .axis { font-size: 11px; font-stretch: 90%; fill: ${t.muted}; }
  .name { font-size: ${nameSize}px; font-weight: 760; font-stretch: 125%; letter-spacing: ${nameTrack}px;
          paint-order: stroke; stroke: ${t.paper}; stroke-width: 7px; stroke-linejoin: round; }
  .role { font-size: 15px; font-style: italic; font-stretch: 100%; font-weight: 420; fill: ${t.ink};
          paint-order: stroke; stroke: ${t.paper}; stroke-width: 5px; stroke-linejoin: round; letter-spacing: 0.2px; }
  .route { fill: none; stroke: ${t.magenta}; stroke-width: 1.6; stroke-dasharray: 7 5; }
  .reveal { fill: none; stroke: #fff; stroke-width: 8; stroke-dasharray: 1; animation: draw 2.2s 2.1s ease-in-out both; }
  .fix { fill: ${t.paper}; stroke: ${t.magenta}; stroke-width: 1.6; animation: appear .5s 4.2s both; }
  .summit { animation: appear .6s 1.9s both; }
  .tri { fill: ${t.ink}; stroke: ${t.paper}; stroke-width: 1.5; }
  .spot { font-size: 13px; font-weight: 640; paint-order: stroke; stroke: ${t.paper}; stroke-width: 4px; stroke-linejoin: round; }
  .spotdate { font-style: italic; font-weight: 420; fill: ${t.muted}; }
  .mg { font-size: 12.5px; fill: ${t.ink}; }
  .mg.dim { fill: ${t.muted}; }
  .mg.big { font-size: 13.5px; font-weight: 600; }
  .bar { fill: ${t.ink}; } .bar.o { fill: ${t.paper}; stroke: ${t.ink}; stroke-width: 1; }
  @keyframes draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  @keyframes appear { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<rect width="${Wd}" height="${Ht}" rx="10" fill="${t.paper}"/>
<g class="pts">${points}</g>
<clipPath id="frame"><rect x="${mx}" y="${my}" width="${mw}" height="${mh}"/></clipPath>
<g clip-path="url(#frame)">${contours}</g>
<mask id="fly" maskUnits="userSpaceOnUse"><path class="reveal" pathLength="1" d="${routeD}"/></mask>
<path class="route" d="${routeD}" mask="url(#fly)"/>
${route.map((p) => `<circle class="fix" cx="${r1(p[0])}" cy="${r1(p[1])}" r="3.6"/>`).join("")}
${summitMarks}
<text x="${r1(nameX)}" y="${r1(nameY)}" class="name">${esc(name)}</text>
<text x="${r1(nameX + 3)}" y="${r1(nameY + 27)}" class="role">A year of commits, surveyed as terrain</text>
<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" class="neat"/>
${collar}
<line x1="${mx}" y1="${my2 + 26}" x2="${mx + mw}" y2="${my2 + 26}" class="tick" opacity=".35"/>
<text x="${mx}" y="${my2 + 54}" class="mg big">${esc(BIO[0])}</text>
<text x="${mx}" y="${my2 + 74}" class="mg">${esc(BIO[1])}</text>
<text x="${mx}" y="${my2 + 92}" class="mg">${esc(BIO[2])}</text>
<text x="${mx}" y="${my2 + 122}" class="mg dim">${total} contributions, ${fmtDate(first)} to ${fmtDate(last)}. Surveyed ${fmtDate(surveyedAt)} by GitHub Actions.</text>
<g transform="translate(${mx + mw - fourWeeks * 2}, ${my2 + 44})">
  <rect x="0" y="0" width="${r1(fourWeeks)}" height="5" class="bar"/>
  <rect x="${r1(fourWeeks)}" y="0" width="${r1(fourWeeks)}" height="5" class="bar o"/>
  <text x="0" y="22" class="mg dim">0</text>
  <text x="${r1(fourWeeks)}" y="22" class="mg dim" text-anchor="middle">4</text>
  <text x="${r1(fourWeeks * 2)}" y="22" class="mg dim" text-anchor="end">8 weeks</text>
  <text x="${r1(fourWeeks * 2)}" y="43" class="mg dim" text-anchor="end">Contours rise with each day’s commits</text>
</g>
</svg>`;
}

// ---------------------------------------------------------------- waypoint plates

function waypointPlate(repo, themeName) {
  const t = THEMES[themeName];
  const W = 440, H = 184;
  const lines = wrap(repo.description || "No description yet.", 56, 2);
  const lang = repo.primaryLanguage;
  const weeks = repo.activity || new Array(52).fill(0);
  const px = 22, pw = W - 44, py = 132, ph = 34;
  const peak = Math.max(1, ...weeks);
  const pts = weeks.map((v, i) => [px + (i / (weeks.length - 1)) * pw, py - (Math.sqrt(v) / Math.sqrt(peak)) * ph]);
  const line = smoothPath(pts) || `M${px} ${py}H${px + pw}`;
  const commits = weeks.reduce((a, b) => a + b, 0);
  const stars = repo.stargazerCount;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="title">
<title id="title">${esc(repo.name)}: ${esc(repo.description || "")}</title>
<style>${fontFaces(false)}
  text { font-family: "Archivo", sans-serif; fill: ${t.ink}; font-variant-numeric: tabular-nums lining-nums; }
  .name { font-size: 19px; font-weight: 680; font-stretch: 104%; }
  .desc { font-size: 13.5px; font-weight: 400; }
  .meta { font-size: 12px; fill: ${t.muted}; }
  .prof { fill: none; stroke: ${t.index}; stroke-width: 1.4; stroke-linejoin: round; }
  .area { fill: ${t.fill}; }
  .base { stroke: ${t.contour}; stroke-width: 1; }
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="9" fill="${t.paper}" stroke="${t.contour}" stroke-opacity=".7"/>
<circle cx="${px + 6}" cy="31" r="7.5" fill="none" stroke="${t.magenta}" stroke-width="1.6"/>
<circle cx="${px + 6}" cy="31" r="2.6" fill="${t.magenta}"/>
<text x="${px + 22}" y="37.5" class="name">${esc(repo.name)}</text>
${stars ? `<g transform="translate(${W - px}, 37)"><text class="meta" text-anchor="end" style="font-size:13px">${stars} ${stars === 1 ? "star" : "stars"}</text></g>` : ""}
${lines.map((l, i) => `<text x="${px}" y="${66 + i * 20}" class="desc">${esc(l)}</text>`).join("")}
<path class="area" d="${line}L${px + pw} ${py}L${px} ${py}Z"/>
<path class="prof" d="${line}"/>
<line x1="${px}" y1="${py + 0.5}" x2="${px + pw}" y2="${py + 0.5}" class="base"/>
${lang ? `<circle cx="${px + 4}" cy="${H - 22}" r="4" fill="${lang.color || t.muted}"/><text x="${px + 14}" y="${H - 18}" class="meta">${esc(lang.name)}</text>` : ""}
<text x="${W - px}" y="${H - 18}" class="meta" text-anchor="end">${commits ? `${commits} ${commits === 1 ? "commit" : "commits"} this year, last ${fmtDate(repo.pushedAt)}` : `Last push ${fmtDate(repo.pushedAt)}`}</text>
</svg>`;
}

// ---------------------------------------------------------------- legend plate

function legendPlate(repos, themeName) {
  const t = THEMES[themeName];
  const W = 900, H = 200;
  const totals = new Map();
  for (const r of repos)
    for (const e of r.languages.edges) {
      const cur = totals.get(e.node.name) || { size: 0, color: e.node.color };
      cur.size += e.size;
      totals.set(e.node.name, cur);
    }
  const all = [...totals.entries()].sort((a, b) => b[1].size - a[1].size);
  const sum = all.reduce((s, [, v]) => s + v.size, 0) || 1;
  const shown = all.filter(([, v]) => v.size / sum >= 0.02).slice(0, 7);
  const x0 = 58, bw = 784, by = 64;
  let x = x0, bars = "", labels = "";
  const rest = 1 - shown.reduce((s, [, v]) => s + v.size / sum, 0);
  const parts = [...shown.map(([n, v]) => [n, v.size / sum, v.color]), ...(rest > 0.005 ? [["Other", rest, t.grid]] : [])];
  let labelX = x0;
  parts.forEach(([name, share, color], i) => {
    const w = share * bw;
    bars += `<rect x="${r1(x)}" y="${by}" width="${r1(Math.max(w - 2, 1))}" height="10" fill="${color || t.muted}"/>`;
    const lx = Math.max(x, labelX);
    if (lx + 80 < x0 + bw + 20) {
      labels += `<text x="${r1(lx)}" y="${by + 30}" class="ln">${esc(name)}</text><text x="${r1(lx)}" y="${by + 46}" class="lp">${Math.round(share * 100)}%</text>`;
      labelX = lx + Math.max(textWidth(name, 13) + 14, 52);
    }
    x += w;
  });
  const row = (y, head, body) =>
    `<text x="${x0}" y="${y}" class="lh">${head}</text><text x="${x0 + 110}" y="${y}" class="lb">${esc(body)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="title">
<title id="title">Legend: languages across public repositories, tools, and ground covered</title>
<style>${fontFaces()}
  text { font-family: "Archivo", sans-serif; fill: ${t.ink}; font-variant-numeric: tabular-nums lining-nums; }
  .title { font-size: 15px; font-weight: 680; font-stretch: 110%; }
  .note { font-size: 12.5px; font-style: italic; fill: ${t.muted}; }
  .ln { font-size: 13px; font-weight: 560; } .lp { font-size: 12px; fill: ${t.muted}; }
  .lh { font-size: 13px; font-weight: 640; } .lb { font-size: 13px; }
</style>
<rect width="${W}" height="${H}" rx="10" fill="${t.paper}"/>
<text x="${x0}" y="40" class="title">Legend</text>
<text x="${x0 + bw}" y="40" class="note" text-anchor="end">Language share by bytes across public repos</text>
${bars}${labels}
<line x1="${x0}" y1="${by + 66}" x2="${x0 + bw}" y2="${by + 66}" stroke="${t.contour}" stroke-opacity=".6"/>
${row(by + 92, "Build", ".NET and WPF, React, Node and Express, PHP")}
${row(by + 114, "Ground", "Microsoft 365, Exchange Online, identity, endpoint hardening, Windows, Linux")}
</svg>`;
}

// ---------------------------------------------------------------- main

const { cal, repos, featured } = await survey();
const now = new Date().toISOString();
mkdirSync(OUT, { recursive: true });
for (const theme of Object.keys(THEMES)) {
  writeFileSync(join(OUT, `sheet-${theme}.svg`), heroSheet(cal, theme, now));
  writeFileSync(join(OUT, `legend-${theme}.svg`), legendPlate(repos, theme));
  for (const repo of featured) writeFileSync(join(OUT, `wp-${repo.name}-${theme}.svg`), waypointPlate(repo, theme));
}
console.log(`Surveyed ${cal.totalContributions} contributions, ${featured.length} waypoints -> ${OUT}`);
