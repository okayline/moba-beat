// The daily page: a fight against the day's ghost (ghost.js), the one opponent everyone fights that day, over the day's
// song from /api/today. The song plays LOOPS times; each half of a run goes charge, the ghost acts, charge, you act.
// One button: a press is { down, up } in beats from the fight's first beat, timed on the Web Audio clock less the
// device's output delay (audio.js). Each step's measure is read by moves.js half a beat after it ends, and the fight
// so far is worked out again from all the reads (ghost.js). Nothing is saved yet.
import { VERSION } from "./version.js";
import { TAP } from "./beat.js";
import { createAudio } from "./audio.js";
import { read } from "./moves.js";
import { HP, METER } from "./duel.js";
import { fight, STEPS, LOOPS } from "./ghost.js";
import { setupAccount } from "./account.js";

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

function line(e) {
  if (e.kind === "charge" || e.move === "charge") return e.charged ? "You charged: perfect, +½ pip." : "You charged: no pip.";
  const who = e.actor === 0 ? "You" : "Ghost";
  let s = `${who}: ${MOVE[e.move] ?? e.move}`;
  if (e.wasted) s += ", a wasted turn: 1 life lost";
  else if (e.move === "attack" || e.move === "super") s += `${e.crit ? " (crit)" : ""}, ${e.damage} damage`;
  if (e.reaction === "guard") s += `. ${e.actor === 0 ? "The ghost" : "You"} guarded (${e.guard})`;
  if (e.charged) s += ". You charged: +½ pip";
  return s + ".";
}

function callFor(M) {
  const c = $("call"), k = reads.length, step = STEPS[k], A = step.measure, m = f.next?.move;
  lightGuide(M === A ? step.kind : null);
  if (M < A) { c.className = "call"; c.textContent = "Get ready"; }
  else if (step.kind === "charge") { c.className = "call you"; c.textContent = "Charge! Tap beat 4"; }
  else if (step.kind === "ghost") {
    c.className = "call ghost";
    c.textContent = m === "super" ? "The ghost winds up a SUPER!" : "The ghost winds up an attack!";
  } else { c.className = "call you"; c.textContent = "Your move!"; }
}

function reset() {
  presses = []; reads = []; f = fight(day.hash, []);
  drawState(f.state); $("log").innerHTML = ""; $("result").textContent = "";
  $("call").className = "call"; $("call").textContent = "Press Start. Measure 1 is your first charge.";
}

function stop() {
  token++; cancelAnimationFrame(raf);
  if (audio) { try { audio.ctx.close(); } catch {} }
  audio = null; down = null; $("pad").classList.remove("down");
  $("play").textContent = "Start fight";
  for (let i = 0; i < 4; i++) $("l" + i).classList.remove("on");
  if (f) lightGuide(null);
}

const now = () => (audio.ctx.currentTime - audio.heardLate() - t0) / spb;   // beats since the fight's first beat, as heard

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
      const li = document.createElement("li"); li.className = e.actor === 0 ? "you" : "ghost"; li.textContent = line(e); $("log").appendChild(li);
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
  down = { down: now(), up: null }; presses.push(down);
  $("pad").classList.add("down");
  audio.sample(TAP[day.style], audio.ctx.currentTime, 0.9);
}
function release() {
  if (!down) return;
  if (audio) down.up = now();
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
  $("play").disabled = false;
}

$("play").addEventListener("click", () => { if (audio) { stop(); reset(); } else begin(); });
const pad = $("pad");
pad.addEventListener("pointerdown", (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch {} press(); });
pad.addEventListener("pointerup", release); pad.addEventListener("pointercancel", release);
document.addEventListener("keydown", (e) => { if (e.code !== "Space" || e.repeat) return; if (e.target.closest?.("button:not(#pad), input")) return; e.preventDefault(); press(); });
document.addEventListener("keyup", (e) => { if (e.code === "Space") { e.preventDefault(); release(); } });

setupAccount(() => {});
load();
