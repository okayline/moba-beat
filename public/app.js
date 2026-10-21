// The page: today's beat from /api/today, drawn as 16 beats in 4 measures, and played on a tap (browsers only start
// sound after one). The squads stand in the lane and move on the beat; the fight itself isn't built yet.
import { VERSION } from "./version.js";

const $ = (id) => document.getElementById(id);
$("version").textContent = VERSION;

// working names for the three roles, each with its own shape
const SHAPES = {
  Clutch: '<svg viewBox="0 0 44 44"><path d="M22 2 L42 22 L22 42 L2 22 Z" fill="currentColor"/></svg>',
  Feed: '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="currentColor"/></svg>',
  Tilt: '<svg viewBox="0 0 44 44"><path d="M22 3 L42 40 L2 40 Z" fill="currentColor"/></svg>',
};
function squad(el) {
  el.innerHTML = Object.entries(SHAPES).map(([name, svg]) => `<div class="unit"><div class="token">${svg}</div><span>${name}</span></div>`).join("");
}
squad($("you")); squad($("ghost"));

let day = null, timer = null, ctx = null, step = 0;

async function load() {
  try {
    const r = await fetch("/api/today");
    if (!r.ok) throw new Error();
    day = await r.json();
  } catch {
    $("status").textContent = "Today's beat didn't load. Reload the page to try again.";
    return;
  }
  $("date").textContent = day.day;
  $("bpm").textContent = day.bpm;
  const bars = [0, 1, 2, 3].map((m) => day.beats.slice(m * 4, m * 4 + 4)
    .map((b, i) => `<span class="${b}" aria-label="Beat ${m * 4 + i + 1}: ${b}"></span>`).join(""));
  $("track").innerHTML = bars.map((b, m) => `<li aria-label="Measure ${m + 1}">${b}</li>`).join("");
  $("play").disabled = false;
}

// a short click for each beat: higher and louder on a strong beat, nothing on a rest
function click(kind) {
  if (kind === "rest") return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.frequency.value = kind === "strong" ? 880 : 520;
  g.gain.setValueAtTime(kind === "strong" ? 0.35 : 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.13);
}

function tick() {
  const cells = $("track").querySelectorAll("span"), kind = day.beats[step], arena = document.querySelector(".arena");
  for (const c of cells) c.classList.remove("now");
  cells[step].classList.add("now");
  click(kind);
  arena.classList.toggle("strong", kind === "strong");
  arena.classList.toggle("hit", kind !== "rest");
  setTimeout(() => arena.classList.remove("hit"), 110);
  step = (step + 1) % day.beats.length;
}

$("play").addEventListener("click", () => {
  if (timer) {
    clearInterval(timer); timer = null;
    for (const c of $("track").querySelectorAll("span")) c.classList.remove("now");
    $("play").textContent = "Play";
    return;
  }
  ctx ||= new AudioContext();
  step = 0; tick();
  timer = setInterval(tick, 60000 / day.bpm);
  $("play").textContent = "Stop";
});

load();
