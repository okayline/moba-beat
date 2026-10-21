// The page: today's drumbeat from /api/today. The drums play beats 1 to 3 of each measure over a fixed metronome at the
// day's tempo; the metronome is never heard and beat 4 is silent. The player taps beat 4 (the tap plays a clap). Some
// measures have an enemy wind-up: a cue sound on beat 1, and the attack lands 2 beats later, where the player taps to
// parry. Every tap is scored against the metronome (score.js). Everything is
// scheduled on the Web Audio clock, and taps are timed on the same clock. The fight isn't built yet; a good tap makes
// your squad flash, which is where the crit will go.
import { VERSION } from "./version.js";
import { score } from "./score.js";

const $ = (id) => document.getElementById(id);
$("version").textContent = VERSION;

// working names for the three roles, each with its own shape
const SHAPES = {
  Clutch: '<svg viewBox="0 0 44 44"><path d="M22 2 L42 22 L22 42 L2 22 Z" fill="currentColor"/></svg>',
  Feed: '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="currentColor"/></svg>',
  Tilt: '<svg viewBox="0 0 44 44"><path d="M22 3 L42 40 L2 40 Z" fill="currentColor"/></svg>',
};
for (const id of ["you", "ghost"]) $(id).innerHTML = Object.entries(SHAPES).map(([n, svg]) => `<div class="unit"><div class="token">${svg}</div><span>${n}</span></div>`).join("");

const COUNT_IN = 3;                 // silent beats before the song: the countdown -3, -2, -1
let day, ctx, start, spb, targets, taps = [], raf = null, playing = false;
const arena = document.querySelector(".arena");
const cells = () => $("track").querySelectorAll(".step.on");

async function load() {
  try {
    const r = await fetch("/api/today");
    if (!r.ok) throw new Error();
    day = await r.json();
  } catch {
    $("status").textContent = "Today's song didn't load. Reload the page to try again.";
    return;
  }
  $("date").textContent = day.day;
  $("bpm").textContent = day.bpm;
  $("style").textContent = day.style;
  // a step grid per measure: 8 eighths wide, one row per drum; beat 4 is the player's column
  const ROWS = ["enemy", "hat", "snare", "kick"];
  $("track").innerHTML = Array.from({ length: day.measures }, (_, m) => m).map((m) => {
    const cells = ROWS.flatMap((drum, r) => Array.from({ length: 8 }, (_, e) => {
      const at = m * 4 + e / 2;
      if (drum === "enemy") {
        const cue = day.cues.some((c) => c.at === at), lands = day.cues.some((c) => c.lands === at);
        return `<span class="step enemy${cue ? " cue" : ""}${lands ? " parry" : ""}" style="grid-row:1;grid-column:${e + 1}"></span>`;
      }
      const hit = day.hits.findIndex((h) => h.at === at && h.drum === drum);
      const you = e === 6 && drum === "snare";
      return `<span class="step ${hit >= 0 ? "on " + drum : ""}${you ? " you" : ""}${e >= 6 ? " yours" : ""}" style="grid-row:${r + 1};grid-column:${e + 1}"${hit >= 0 ? ` data-k="${hit}"` : ""}></span>`;
    }));
    return `<li aria-label="Measure ${m + 1}">${cells.join("")}</li>`;
  }).join("");
  $("play").disabled = false;
}

// drums from Web Audio, in three kits (the day's style). Every sound is made here, from oscillators and noise.
let noiseBuf;
function noise(t, dur, vol, type, freq) {
  noiseBuf ||= (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination); src.start(t); src.stop(t + dur + 0.02);
}
// a pitched hit: from f0 down to f1 over drop seconds, fading out over dur
function tone(t, f0, f1, drop, dur, vol, type = "sine") {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + drop);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
const KITS = {
  // dusty and punchy: a round kick with a click, a fat snare, a soft hat
  "hip-hop": {
    kick: (t) => { tone(t, 130, 48, 0.1, 0.32, 0.95); noise(t, 0.01, 0.3, "highpass", 3000); },
    snare: (t) => { noise(t, 0.22, 0.5, "bandpass", 1800); tone(t, 200, 160, 0.05, 0.1, 0.3); },
    hat: (t) => noise(t, 0.03, 0.12, "highpass", 8000),
    clap: (t) => { for (const d of [0, 0.012, 0.024]) noise(t + d, 0.1, 0.5, "bandpass", 1300); },
  },
  // drum machine: a long booming kick, a snappy rim snare, a tight metallic hat
  electro: {
    kick: (t) => tone(t, 75, 40, 0.3, 0.6, 1),
    snare: (t) => { noise(t, 0.09, 0.4, "highpass", 2500); tone(t, 340, 330, 0.02, 0.06, 0.25, "triangle"); },
    hat: (t) => { noise(t, 0.02, 0.15, "highpass", 9500); tone(t, 6200, 6000, 0.02, 0.02, 0.03, "square"); },
    clap: (t) => { for (const d of [0, 0.01, 0.02]) noise(t + d, 0.05, 0.45, "bandpass", 1100); noise(t + 0.03, 0.18, 0.25, "bandpass", 1100); },
  },
  // dance floor: a tight kick, a bright clap-snare, an open hat that rings
  disco: {
    kick: (t) => tone(t, 110, 55, 0.06, 0.18, 0.9),
    snare: (t) => { for (const d of [0, 0.01]) noise(t + d, 0.16, 0.4, "bandpass", 1600); tone(t, 240, 200, 0.03, 0.06, 0.15); },
    hat: (t) => noise(t, 0.22, 0.13, "highpass", 6500),
    clap: (t) => { for (const d of [0, 0.012, 0.024, 0.036]) noise(t + d, 0.12, 0.45, "bandpass", 1700); },
  },
};
function drum(kind, t) {
  if (kind === "cue") {                                   // the enemy's wind-up: two rising blips, the same in every kit
    for (const [f, d] of [[660, 0], [990, 0.07]]) tone(t + d, f, f, 0.01, 0.09, 0.12, "square");
    return;
  }
  KITS[day.style][kind](t);
}

function play() {
  ctx ||= new AudioContext();
  spb = 60 / day.bpm;
  start = ctx.currentTime + 0.15 + COUNT_IN * spb;      // the song's first beat, on the audio clock
  for (const h of day.hits) drum(h.drum, start + h.at * spb);
  for (const c of day.cues) drum("cue", start + c.at * spb);
  targets = day.targets.map((x) => x.at * spb * 1000);   // ms from the song's first beat
  taps = []; playing = true;
  $("results").innerHTML = ""; $("status").textContent = "";
  $("play").disabled = true; $("tap").disabled = false; $("tap").focus();
  raf = requestAnimationFrame(frame);
}

let lastBeat = null;
function frame() {
  const at = (ctx.currentTime - start) / spb;           // in beats from the song's first beat
  // where you are: a countdown -3, -2, -1, then the beat of the measure, 1 to 3; beat 4 (your clap) shows nothing
  const beatNo = Math.floor(at) % 4 + 1;
  const count = at < -COUNT_IN ? "" : at < 0 ? String(Math.floor(at)) : at < day.measures * 4 && beatNo < 4 ? String(beatNo) : "";
  if ($("count").textContent !== count) {
    $("count").textContent = count;
    $("count").classList.remove("pop"); void $("count").offsetWidth; $("count").classList.add("pop");
  }
  $("track").querySelectorAll("li").forEach((li, m) => li.classList.toggle("live", at >= m * 4 && at < m * 4 + 4));
  let k = -1; day.hits.forEach((h, i) => { if (h.at <= at) k = i; });
  if (k !== lastBeat) {                                  // a new note: light it and pulse the squads
    lastBeat = k;
    const t = k >= 0 ? day.hits[k].at : -1;
    cells().forEach((c) => c.classList.toggle("now", day.hits[Number(c.dataset.k)].at === t));
    if (k >= 0) { arena.classList.add("hit"); setTimeout(() => arena.classList.remove("hit"), 110); }
    if (k === 0) $("status").textContent = "";
  }
  // a ghost unit winds up from its cue until the attack lands
  const ghosts = $("ghost").querySelectorAll(".unit");
  ghosts.forEach((u, i) => u.classList.toggle("winding", day.cues.some((c) => c.unit === i && at >= c.at && at < c.lands + 0.25)));
  if (at >= day.measures * 4 + 1) return finish();
  raf = requestAnimationFrame(frame);
}

function tap() {
  if (!playing) return;
  const ms = (ctx.currentTime - start) * 1000;
  taps.push(ms);
  drum("clap", ctx.currentTime);
  $("tap").classList.add("hit"); setTimeout(() => $("tap").classList.remove("hit"), 90);
  // judge against the nearest target now, so a good tap lands right away
  const near = targets.reduce((a, t, i) => (Math.abs(t - ms) < Math.abs(targets[a] - ms) ? i : a), 0);
  const g = score([targets[near]], [ms])[0].grade;
  if (g !== "miss") {
    const cls = day.targets[near].kind === "parry" ? "parried" : "crit";   // a parry blocks the enemy; a clap crits
    arena.classList.add(cls); setTimeout(() => arena.classList.remove(cls), 240);
  }
}

function finish() {
  playing = false; cancelAnimationFrame(raf); lastBeat = null;
  cells().forEach((c) => c.classList.remove("now"));
  $("count").textContent = "";
  $("track").querySelectorAll("li").forEach((li) => li.classList.remove("live"));
  const res = score(targets, taps), n = (g) => res.filter((r) => r.grade === g).length;
  // one dot per clap or parry, in order, coloured by how it went; hover or long-press for the measure and the timing
  $("results").innerHTML = res.map((r, i) => `<li class="${r.grade} ${day.targets[i].kind}" title="Measure ${Math.floor(day.targets[i].at / 4) + 1} ${day.targets[i].kind}: ${
    r.err === null ? "miss" : `${r.grade}, ${Math.abs(r.err)} ms ${r.err < 0 ? "early" : "late"}`}"></li>`).join("");
  const hit = res.filter((r) => r.err !== null), avg = hit.length ? Math.round(hit.reduce((a, r) => a + r.err, 0) / hit.length) : null;
  $("status").textContent = `${n("perfect")} perfect, ${n("good")} good, ${n("miss")} missed.` +
    (avg === null ? "" : ` On average ${Math.abs(avg)} ms ${avg < 0 ? "early" : "late"}.`);
  $("play").textContent = "Play again"; $("play").disabled = false; $("tap").disabled = true;
}

$("play").addEventListener("click", play);
$("tap").addEventListener("pointerdown", (e) => { e.preventDefault(); tap(); });
document.addEventListener("keydown", (e) => { if (e.code === "Space" && playing) { e.preventDefault(); tap(); } });

load();
