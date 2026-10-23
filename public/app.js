// The page: today's music from /api/today: the drums, through a little reverb. The drums play beats 1 to 3 of each measure over a fixed metronome at the
// day's tempo; the metronome is never heard and beat 4 is silent. The feed (feed.js) scrolls the song past a line while you play. The player taps beat 4 (the tap plays the kit's sound for it). Some
// measures have an enemy wind-up: a cue sound on beat 1, and the attack lands 2 beats later, where the player taps to
// parry. Every tap is scored against the metronome (score.js). Everything is
// scheduled on the Web Audio clock, and taps are timed on the same clock. A good tap makes your squad flash. The duel is
// its own page (duel.html).
import { VERSION } from "./version.js";
import { TAP } from "./beat.js";
import { createAudio } from "./audio.js";
import { MAX_TAPS, score } from "./score.js";
import { setupAccount } from "./account.js";
import { drawFeed } from "./feed.js";

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
let day, audio, ctx, start, spb, targets, taps = [], raf = null, playing = false;
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
  try {
    audio = await createAudio(day);                      // starts paused; Play resumes it (browsers need a tap first)
    ctx = audio.ctx;
  } catch {
    $("status").textContent = "Today's drums didn't load. Reload the page to try again.";
    return;
  }
  $("play").disabled = false;
  drawFeed($("feed"), day, -COUNT_IN);
}

// Sounds come from audio.js (shared with the duel page).
const sample = (kind, t, vol) => audio.sample(kind, t, vol);

function play() {
  $("reveal").hidden = true;                             // the grid stays hidden while you play: you play by ear
  spb = 60 / day.bpm;
  start = ctx.currentTime + 0.15 + COUNT_IN * spb;      // the song's first beat, on the audio clock
  for (const h of day.hits) sample(h.drum, start + h.at * spb);
  for (const c of day.cues) sample("cue", start + c.at * spb, 0.6);
  targets = day.targets.map((x) => x.at * spb * 1000);   // ms from the song's first beat
  taps = []; playing = true;
  $("results").innerHTML = ""; $("status").textContent = ""; $("sealed").textContent = "";
  $("play").disabled = true; $("tap").disabled = false; $("tap").focus();
  raf = requestAnimationFrame(frame);
}

let lastBeat = null;
function frame() {
  const at = (ctx.currentTime - start) / spb;           // in beats from the song's first beat
  drawFeed($("feed"), day, at);
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

// A tap is timed by when you heard the beat: the audio clock less the device's output delay (audio.js). Taps past
// MAX_TAPS aren't counted (the server takes no more).
const heardLate = () => audio.heardLate();
function tap() {
  if (!playing) return;
  const ms = Math.round((ctx.currentTime - heardLate() - start) * 1000);
  if (taps.length < MAX_TAPS) taps.push(ms);
  sample(TAP[day.style], ctx.currentTime);
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
  seal();
  $("reveal").hidden = false;                            // the full beat is shown once you've played it
}

// Send the taps to the server, which scores them itself. Your first run of the day is sealed on the ledger.
async function seal() {
  try {
    const r = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ day: day.day, taps }) });
    const a = await r.json();
    if (!r.ok) throw new Error(a.error);
    $("sealed").textContent = a.sealed ? "Sealed on the ledger." : `Practice. Today's sealed run: ${a.today.perfect} perfect, ${a.today.good} good, ${a.today.miss} missed.`;
  } catch (e) {
    $("sealed").textContent = (e && e.message) || "This run couldn't be saved.";
  }
}

$("play").addEventListener("click", () => ctx.resume().then(play));
$("tap").addEventListener("pointerdown", (e) => { e.preventDefault(); tap(); });
document.addEventListener("keydown", (e) => { if (e.code === "Space" && playing) { e.preventDefault(); if (!e.repeat) tap(); } });   // holding Space is one tap, not one every key repeat

// after logging in or out, today's sealed run may be someone else's: ask again
setupAccount(async () => {
  try { const d = await (await fetch("/api/today")).json(); $("sealed").textContent = d.run ? `Today's sealed run: ${d.run.perfect} perfect, ${d.run.good} good, ${d.run.miss} missed.` : ""; } catch {}
});

load();
