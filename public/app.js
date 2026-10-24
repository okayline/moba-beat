// The daily page: a fight against the day's ghost (ghost.js), the one opponent everyone fights that day, over the day's
// song from /api/today. The song plays LOOPS times; each half of a run goes charge, the ghost acts, charge, you act.
// One button: a press is { down, up } in beats from the fight's first beat, timed on the Web Audio clock less the
// device's output delay (audio.js). Each step's measure is read by moves.js half a beat after it ends, and the fight
// so far is worked out again from all the reads (ghost.js). Nothing is saved yet.
// The lane (a canvas) scrolls the coming beats right to left past a line: each measure tinted by what happens in it,
// with dots where to press. The tap timing slider moves every press later or earlier, for devices whose sound delay the
// browser reports wrong; it is kept in this browser.
import { VERSION } from "./version.js";
import { TAP } from "./beat.js";
import { createAudio } from "./audio.js";
import { read } from "./moves.js";
import { HP, METER } from "./duel.js";
import { fight, STEPS, LOOPS } from "./ghost.js";
import { setupAccount } from "./account.js";
import { PERFECT } from "./score.js";

const $ = (id) => document.getElementById(id);
$("version").textContent = VERSION;

const MOVE = { attack: "Attack", super: "SUPER", guard: "Guard", none: "nothing", unclear: "nothing clear" };
// The moves, beat by beat (beats 0 to 3 across the measure): holds are [from, to], taps are a beat.
const GUIDE = [
  ["Charge", "you", [], [3]],
  ["Attack", "you", [], [2, 3]],
  ["Guard", "ghost", [[2, 3.3]], []],
  ["Super", "you", [[0, 2.3]], [3]],
];
$("guide").innerHTML = GUIDE.map(([name, who, holds, taps]) => `<div class="mv" data-move="${name}"><span class="nm ${who}">${name}</span>
  <div class="beats">${[1, 2, 3, 4].map((n) => `<span class="${n === 4 ? "four" : ""}">${n}</span>`).join("")}
  ${holds.map(([a, b]) => `<i class="hold" style="left:${a * 25 + 12.5}%;width:${(b - a) * 25}%"></i>`).join("")}
  ${taps.map((t) => `<i class="tap" style="left:${t * 25 + 12.5}%"></i>`).join("")}</div></div>`).join("");

// Tap timing: ms added to every press (positive counts your taps later), set by calibrating. Kept in this browser only.
let offset = 0;
try { offset = Number(localStorage.getItem("mb-offset")) || 0; } catch {}
const showOffset = () => { $("offsetVal").textContent = `Your timing: ${offset > 0 ? "+" : ""}${offset} ms`; };
showOffset();

// Calibrating: a hi-hat on every beat for CAL_BEATS beats at today's tempo; you tap along. The first CAL_SKIP taps are
// ignored, the rest are timed against their nearest beat, and the average (sign flipped) becomes the offset. Taps more
// than CAL_SPREAD ms apart from each other are too uneven to use.
const CAL_BEATS = 12, CAL_SKIP = 4, CAL_SPREAD = 100;
let cal = null;   // the taps' errors in ms while calibrating, else null
async function calibrate() {
  stop(); reset();
  const my = ++token;
  $("cal").textContent = "Stop";
  let a;
  try { a = await createAudio(day); } catch { if (my === token) { stop(); $("status").textContent = "Today's drums didn't load. Reload the page to try again."; } return; }
  if (my !== token) { try { a.ctx.close(); } catch {} return; }
  audio = a; try { await a.ctx.resume(); } catch {}
  spb = 60 / day.bpm; t0 = a.ctx.currentTime + 0.4; cal = [];
  for (let i = 0; i < CAL_BEATS; i++) a.sample("hat", t0 + i * spb, i % 4 === 0 ? 0.9 : 0.6);
  $("call").className = "call you"; $("call").textContent = "Tap along";
  const frame = () => {
    if (!audio || my !== token) return;
    const b = now();
    for (let i = 0; i < 4; i++) $("l" + i).classList.toggle("on", b >= 0 && b < CAL_BEATS && Math.floor(b % 4) === i);
    if (b < CAL_BEATS + 0.5) { raf = requestAnimationFrame(frame); return; }
    const used = cal.slice(CAL_SKIP);
    const spread = used.length ? Math.max(...used) - Math.min(...used) : Infinity;
    if (used.length < 4 || spread > CAL_SPREAD) $("call").textContent = "Too uneven, try again";
    else {
      offset = -Math.round(used.reduce((x, y) => x + y, 0) / used.length);
      try { localStorage.setItem("mb-offset", String(offset)); } catch {}
      showOffset(); $("call").textContent = "Calibrated!";
    }
    $("call").className = "call"; cal = null; stop();
  };
  frame();
}

// The lane: 6 beats ahead of the line and 4 behind, so a finished measure's label stays in view a moment. Charge measures are gold with a dot on beat 4, the
// ghost's are pink with a ring on beat 3 (where a guard starts), yours are blue with dots on beats 3 and 4 (attack).
const KIND = { charge: ["#ffb020", [3], false], ghost: ["#ff6b8a", [2], true], player: ["#5b82ff", [2, 3], false] };
function drawLane(b) {
  const c = $("lane"), r = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); }
  const g = c.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, w, h);
  const lineX = w * 0.4, perBeat = w * 0.1, x = (beat) => lineX + (beat - b) * perBeat;
  STEPS.forEach((step, i) => {
    const [color, dots, ring] = KIND[step.kind], m0 = step.measure * 4;
    if (x(m0 + 4) < 0 || x(m0) > w) return;
    g.globalAlpha = 0.16; g.fillStyle = color; g.fillRect(x(m0), 6, perBeat * 4, h - 12); g.globalAlpha = 1;
    for (const d of dots) {
      g.beginPath(); g.arc(x(m0 + d), h / 2, 8, 0, Math.PI * 2);
      if (ring) { g.strokeStyle = color; g.lineWidth = 3; g.stroke(); } else { g.fillStyle = color; g.fill(); }
    }
    // once the measure has been read: what happened, over its last dot
    const e = f && f.log[i];
    if (e) {
      g.fillStyle = "#e7ebf5"; g.font = "700 13px " + getComputedStyle(document.body).fontFamily; g.textAlign = "center";
      g.fillText(label(e), x(m0 + dots[dots.length - 1]), 18);
    }
  });
  g.strokeStyle = "#3a4361"; g.lineWidth = 1;
  for (let k = Math.floor(b - 5); k < b + 7; k++) { if (k < 0) continue; const xx = x(k); g.beginPath(); g.moveTo(xx, k % 4 === 0 ? 4 : h - 16); g.lineTo(xx, h - 4); g.stroke(); }
  // "Late!" where a late press landed, scrolling away with it
  g.fillStyle = "#ff6b8a"; g.font = "800 12px " + getComputedStyle(document.body).fontFamily; g.textAlign = "center";
  for (const at of lates) if (x(at) > -30) g.fillText("Late!", x(at), h - 10);
  g.strokeStyle = "#e7ebf5"; g.lineWidth = 2; g.beginPath(); g.moveTo(lineX, 2); g.lineTo(lineX, h - 2); g.stroke();
}

let lates = [];   // beats where a late press landed, for the lane
let day, audio = null, spb = 0, t0 = 0, raf = 0, token = 0, presses = [], reads = [], down = null, f = null, cueAt = -1, shown = -1;

function drawState(state) {
  for (const p of [0, 1]) {
    $("hp" + p).textContent = state.hp[p];
    $("life" + p).style.width = (100 * state.hp[p] / HP) + "%";
    $("meter" + p).innerHTML = Array.from({ length: METER }, (_, i) =>
      `<b class="${state.meter[p] >= i + 1 ? "on" : state.meter[p] >= i + 0.5 ? "half" : ""}"></b>`).join("");
  }
}

// Light up the moves you can do in this measure and dim the rest; null shows them all.
function lightGuide(kind) {
  const can = kind === "charge" ? ["Charge"] : kind === "ghost" ? ["Guard", "Charge"]
    : kind === "player" ? ["Charge", "Attack", ...(f.state.meter[0] >= METER ? ["Super"] : [])] : null;
  $("guide").classList.toggle("live", !!can);
  for (const c of $("guide").children) c.classList.toggle("can", !!can && can.includes(c.dataset.move));
}

// The lane's label for a step's log entry.
function label(e) {
  if (e.kind === "charge" || e.move === "charge") return e.charged ? "Perfect!" : "Missed!";
  if (e.kind === "ghost") return e.guard === "perfect" ? "Blocked!" : e.guard === "good" ? "Half!" : e.damage > 0 ? "Hit!" : "Missed!";
  if (e.wasted || !e.damage) return "Missed!";
  return e.crit ? "Crit!" : "Hit!";
}

function line(e) {
  if (e.kind === "charge" || e.move === "charge") return e.charged ? "You charged: perfect, +½ pip." : "You charged: no pip.";
  const who = e.actor === 0 ? "You" : "Ghost";
  let s = `${who}: ${MOVE[e.move] ?? e.move}`;
  if (e.wasted) s += `, a wasted turn${e.lost ? ": −½ pip" : ""}`;
  else if (e.move === "attack" || e.move === "super") s += `${e.crit ? " (crit)" : ""}, ${e.damage} damage`;
  if (e.reaction === "guard") s += `. ${e.actor === 0 ? "The ghost" : "You"} guarded (${e.guard})`;
  if (e.charged) s += ". You charged: +½ pip";
  return s + ".";
}

function callFor(M) {
  const c = $("call"), k = reads.length, step = STEPS[k], A = step.measure, m = f.next?.move;
  lightGuide(M === A ? step.kind : null);
  if (M < A) { c.className = "call"; c.textContent = "Get ready"; }
  else if (step.kind === "charge") { c.className = "call you"; c.textContent = "Charge!"; }
  else if (step.kind === "ghost") {
    c.className = "call ghost";
    c.textContent = m === "super" ? "Ghost charging a SUPER" : "Ghost winds up...";
  } else { c.className = "call you"; c.textContent = "Your move!"; }
}

function reset() {
  presses = []; reads = []; lates = []; f = fight(day.hash, []);
  drawState(f.state); $("log").innerHTML = ""; $("result").textContent = ""; drawLane(-4);
  $("call").className = "call"; $("call").textContent = "Press Start!";
}

function stop() {
  token++; cancelAnimationFrame(raf);
  if (audio) { try { audio.ctx.close(); } catch {} }
  audio = null; down = null; $("pad").classList.remove("down");
  $("play").textContent = "Start fight"; $("cal").textContent = "Calibrate"; cal = null;
  for (let i = 0; i < 4; i++) $("l" + i).classList.remove("on");
  if (f) lightGuide(null);
}

const now = () => (audio.ctx.currentTime - audio.heardLate() - t0) / spb;   // beats since the fight's first beat, as heard
const pressAt = () => now() + offset / 1000 / spb;                             // a press, moved by the tap timing

async function begin() {
  stop(); reset();
  const my = ++token;
  $("play").textContent = "Stop";
  let a;
  try { a = await createAudio(day); } catch { if (my === token) { stop(); $("status").textContent = "Today's drums didn't load. Reload the page to try again."; } return; }
  if (my !== token) { try { a.ctx.close(); } catch {} return; }
  audio = a; try { await a.ctx.resume(); } catch {}
  spb = 60 / day.bpm;
  const lead = a.ctx.currentTime + 0.2;
  t0 = lead + 4 * spb;                                                        // one measure of count-in
  for (let i = 0; i < 4; i++) a.sample("hat", lead + i * spb, i === 3 ? 0.9 : 0.5);
  for (let l = 0; l < LOOPS; l++) for (const h of day.hits) a.sample(h.drum, t0 + (l * day.measures * 4 + h.at) * spb);
  cueAt = -1; shown = -1; callFor(0);
  const end = LOOPS * day.measures * 4;
  const frame = () => {
    if (!audio || my !== token) return;
    const b = now();
    drawLane(b);
    for (let i = 0; i < 4; i++) $("l" + i).classList.toggle("on", b >= 0 && b < end && Math.floor(b % 4) === i);
    const k = reads.length, A = STEPS[k].measure, M = Math.floor(b / 4);
    if (b >= 0 && M !== shown && M <= A) { shown = M; callFor(M); }
    // the ghost's wind-up sound on beat 2 of its measure
    if (STEPS[k].kind === "ghost" && cueAt !== k && b >= A * 4 - 1) { cueAt = k; audio.sample("cue", t0 + (A * 4 + 1) * spb, 0.7); }
    // a step's measure is read half a beat after it ends (a late tap on beat 4 still counts)
    if (b >= (A + 1) * 4 + 0.5) {
      const mine = presses.filter((p) => Math.floor((p.down + 0.5) / 4) === A)
        .map((p) => ({ down: p.down - A * 4, up: p.up == null ? null : p.up - A * 4 }));
      reads.push(read(mine, spb * 1000));
      f = fight(day.hash, reads);
      drawState(f.state);
      const e = f.log[f.log.length - 1];
      const li = document.createElement("li"); li.className = e.actor === 0 ? "you" : "ghost"; li.textContent = line(e); $("log").prepend(li);
      if (f.over || reads.length === STEPS.length) { finish(); return; }
      shown = -1;
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
}

function finish() {
  const w = f.winner, [h0, h1] = f.state.hp;
  $("call").className = "call"; $("call").textContent = "Fight over.";
  $("result").textContent = w === 0 ? `You win, ${h0} to ${h1}.` : w === 1 ? `The ghost wins, ${h1} to ${h0}.` : `A draw, ${h0} each.`;
  const a = audio; setTimeout(() => { if (audio === a) stop(); }, 1500);
}

function press() {
  if (!audio || down) return;
  if (cal) {   // calibrating: time the tap, unmoved by the current offset, against the nearest beat
    const b = now();
    if (b > -0.5) cal.push(Math.round((b - Math.round(b)) * spb * 1000));
    down = { down: b, up: null }; $("pad").classList.add("down");
    audio.sample(TAP[day.style], audio.ctx.currentTime, 0.9); return;
  }
  down = { down: pressAt(), up: null }; presses.push(down);
  // later than perfect against the nearest beat: a little "Late!" (early shows nothing)
  const late = (down.down - Math.round(down.down)) * spb * 1000;
  if (down.down >= 0 && late > PERFECT) lates.push(down.down);
  $("pad").classList.add("down");
  audio.sample(TAP[day.style], audio.ctx.currentTime, 0.9);
}
function release() {
  if (!down) return;
  if (audio) down.up = pressAt();
  down = null; $("pad").classList.remove("down");
}

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
  reset();
  $("play").disabled = false; $("cal").disabled = false;
}

$("play").addEventListener("click", () => { if (audio) { stop(); reset(); } else begin(); });
$("cal").addEventListener("click", () => { if (audio) { stop(); reset(); } else calibrate(); });
const pad = $("pad");
pad.addEventListener("pointerdown", (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch {} press(); });
pad.addEventListener("pointerup", release); pad.addEventListener("pointercancel", release);
document.addEventListener("keydown", (e) => { if (e.code !== "Space" || e.repeat) return; if (e.target.closest?.("button:not(#pad), input")) return; e.preventDefault(); press(); });
document.addEventListener("keyup", (e) => { if (e.code === "Space") { e.preventDefault(); release(); } });

setupAccount(() => {});
load();
