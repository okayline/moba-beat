// The duel page. With no ?id it lists your duels and starts a new one; with ?id=N it is that duel: the board, the log,
// and one button that plays your part of the current turn.
//
// A turn is one measure of the duel's song. If it's your move you play it blind and the recording is saved; if it's the
// other player's move you watch their recording while you play the same measure live (you can answer on beat 3). Your
// button is held and tapped like the moves in moves.js; the page records when your finger went down and came up (in ms from
// beat 1 of the measure, less the device's output delay) and sends them. The server does the reading; the page reads
// your measure again only to say "Late!" right away.
import { VERSION } from "./version.js";
import { TAP } from "./beat.js";
import { read, MAX_PRESSES } from "./moves.js";
import { HP, METER, TRACK, TURNS, WINDUP_SHOWS_AFTER } from "./duel.js";
import { createAudio } from "./audio.js";
import { setupAccount } from "./account.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
$("version").textContent = VERSION;

async function api(path, data) {
  const r = await fetch("/api/" + path, data ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) } : {});
  const j = await r.json().catch(() => ({ error: "That didn't work. Try again." }));
  if (!r.ok) throw new Error(j.error || "That didn't work. Try again.");
  return j;
}

const id = Number(new URLSearchParams(location.search).get("id")) || null;
let view = null, audio = null, rec = null, raf = null, loadedFor = null;
const COUNT_IN = 3;   // silent beats before the measure: the countdown -3, -2, -1

const SHAPES = {
  me: '<svg viewBox="0 0 44 44"><path d="M22 2 L42 22 L22 42 L2 22 Z" fill="currentColor"/></svg>',
  them: '<svg viewBox="0 0 44 44"><path d="M22 3 L42 40 L2 40 Z" fill="currentColor"/></svg>',
};
const MOVES = [
  ["Attack", "press on beat 2, hold through beat 3, tap on beat 4"],
  ["Super", "press on beat 1, hold through beat 3, tap on beat 4 (needs a full meter)"],
  ["Advance", "tap on beat 4"],
  ["Retreat", "tap on beat 3, tap on beat 4"],
  ["Guard", "press on beat 3, hold through beat 4 (costs 1 meter; only worth it when answering an attack)"],
];

// ---------- the list of your duels, and starting one ----------

async function home() {
  document.title = "moba-beat duels";
  $("duel").innerHTML = `<h1>Duels</h1>
    <p class="how">A duel is a fight over one day's song, one measure a turn. Start one and send its link to who you want to fight.</p>
    <p><button class="play" id="new" type="button">Start a duel</button></p>
    <p class="status" id="msg" role="status"></p>
    <ul class="d-list" id="list"></ul>`;
  $("new").onclick = async () => {
    try { const r = await api("duel/new", {}); location.href = "duel.html?id=" + r.id; }
    catch (e) { $("msg").textContent = e.message; }
  };
  await homeList();
}
async function homeList() {
  let d;
  try { d = await api("duels"); } catch (e) { return; }
  const line = (x) => {
    const them = x.me === 0 ? 1 : 0, mine = x.hp[x.me], theirs = x.hp[them];
    const s = !x.joined ? "waiting for someone to join" : x.over ? (x.winner === null ? "a draw" : x.winner === x.me ? "you won" : "you lost") + `, ${mine} to ${theirs}`
      : x.role === "act" ? "your move" : x.role === "react" ? "answer their move" : "waiting for them";
    return `<li><a href="duel.html?id=${x.id}">Duel ${x.id}</a> <span class="m">${esc(x.day)} · ${esc(s)}</span></li>`;
  };
  $("list").innerHTML = d.duels.map(line).join("") || '<li class="m">No duels yet.</li>';
}

// ---------- one duel ----------

async function refresh() {
  view = await api("duel?id=" + id);
  if (loadedFor !== id) { loadedFor = id; audio = await createAudio(view.music).catch(() => null); }
  $("date").textContent = `${view.music.style} ${view.music.bpm} BPM · ${view.day}`;
  draw();
}

const who = (i) => (view.me === null ? `Player ${i + 1}` : i === view.me ? "You" : "They");
function say(e) {
  const a = who(e.actor), mv = { attack: "attacked", super: "used a super", advance: "stepped closer", retreat: "stepped back" }[e.move];
  let s;
  if (e.wasted) s = `${a} wasted the turn (1 life lost).`;
  else if (e.move === "advance" || e.move === "retreat") s = `${a} ${mv}.`;
  else if (e.whiff) s = `${a} ${mv}, but they were out of range.`;
  else s = `${a} ${mv}${e.crit ? " (crit)" : ""}: ${e.damage ? e.damage + " damage" : "no damage"}${e.guard ? `, blocked by a ${e.guard} guard` : ""}.`;
  if (e.reaction === "retreat" && e.move !== "advance") s += ` ${who(1 - e.actor)} stepped back.`;
  return s;
}

function board() {
  const s = view.state, me = view.me ?? 0, them = 1 - me;
  const pips = (n, max, cls) => Array.from({ length: max }, (_, i) => `<i class="${cls}${i < n ? " on" : ""}"></i>`).join("");
  const side = (i, cls, label) => `<div class="d-side ${cls}"><div class="d-name">${label}</div>
    <div class="d-hp" aria-label="${s.hp[i]} life">${pips(s.hp[i], HP, "hp")}</div>
    <div class="d-meter" aria-label="meter ${s.meter[i]} of ${METER}">${pips(s.meter[i], METER, "mt")}</div></div>`;
  const cells = Array.from({ length: TRACK }, (_, x) => `<span class="d-cell">${s.pos[me] === x ? `<span class="tok me" title="${who(me)}">${SHAPES.me}</span>` : ""}${s.pos[them] === x ? `<span class="tok them" id="them-token" title="${who(them)}">${SHAPES.them}</span>` : ""}</span>`).join("");
  return `${side(me, "me", view.me === null ? "Player " + (me + 1) : "You")}${side(them, "them", view.me === null ? "Player " + (them + 1) : "They")}<div class="d-track">${cells}</div>`;
}

function statusLine() {
  const n = view.next;
  if (view.over) return view.winner === null ? "The duel is over: a draw." : view.me === null ? `The duel is over: player ${view.winner + 1} won.` : view.winner === view.me ? "The duel is over: you won." : "The duel is over: you lost.";
  if (n.role === "join") return "Waiting for a second player. Open the link to join.";
  if (n.role === "wait" && !view.joined) return "Waiting for someone to open your link and join.";
  const t = `Turn ${n.turn + 1} of ${TURNS}. `;
  return t + { act: "Your move: you play it blind.", react: "Their move is recorded: watch it, and answer it live.", wait: "Waiting for the other player. This page checks for them.", watch: "You're watching this duel." }[n.role];
}

function draw() {
  document.title = `moba-beat duel ${view.id}`;
  const n = view.next, link = `${location.origin}/duel.html?id=${view.id}`;
  $("duel").innerHTML = `<h1>Duel ${view.id}</h1>
    <p class="status" id="line">${esc(statusLine())}</p>
    ${n.role === "wait" && !view.joined ? `<p class="d-link"><input id="link" readonly value="${esc(link)}" aria-label="Link to send"> <button class="play" id="copy" type="button">Copy link</button></p>` : ""}
    <section class="d-board">${board()}</section>
    <div class="controls">
      ${n.role === "join" ? '<button class="play" id="join" type="button">Join this duel</button>' : ""}
      ${n.role === "act" || n.role === "react" ? `<button class="play" id="go" type="button">${n.role === "act" ? "Play your move" : "Watch and answer"}</button>` : ""}
      <button class="d-pad" id="pad" type="button" hidden aria-label="Your button: hold and tap on the beat">Hold / tap</button>
      <p class="count" id="count" aria-live="polite"></p>
    </div>
    <p class="d-flash" id="flash" role="status"></p>
    <p class="status" id="msg" role="status"></p>
    <ol class="d-log">${view.turns.map((e) => `<li>${esc(say(e))}</li>`).reverse().join("")}</ol>
    <details class="d-moves"><summary>The moves</summary>
      <p class="how">One button. Beat 4 is silent, so count it. Hold and tap on the beats like this:</p>
      <ul>${MOVES.map(([m, how]) => `<li><b>${m}</b>: ${how}.</li>`).join("")}</ul>
      <p class="how">A press has to land close to its beat or the move is missed. Hit beat 4 (or a guard's beat 3) dead on for a crit. Playing nothing, or something that isn't a move, costs a life on your own turn.</p></details>`;
  const on = (el, f) => { const b = $(el); if (b) b.onclick = async () => { try { await f(); } catch (e) { $("msg").textContent = e.message; } }; };
  on("copy", async () => { try { await navigator.clipboard.writeText(link); $("msg").textContent = "Copied."; } catch { $("link").select(); $("msg").textContent = "Select the link and copy it by hand."; } });
  on("join", async () => { view = await api("duel/join", { id }); draw(); });
  on("go", startPlay);
}

// ---------- playing a measure ----------

function down() {
  if (!rec || rec.open || rec.presses.length >= MAX_PRESSES) return;
  rec.open = { down: nowMs(), up: null }; rec.presses.push(rec.open);
  $("pad").classList.add("down");
  audio.sample(TAP[view.music.style], audio.ctx.currentTime);
}
function up() {
  if (!rec || !rec.open) return;
  rec.open.up = nowMs(); rec.open = null;
  $("pad").classList.remove("down");
}
const nowMs = () => Math.round((audio.ctx.currentTime - audio.heardLate() - rec.start) * 1000);

async function startPlay() {
  if (!audio) throw new Error("Today's drums didn't load. Reload the page to try again.");
  await audio.ctx.resume();
  const m = view.next.turn, spb = 60 / view.music.bpm, role = view.next.role;
  const start = audio.ctx.currentTime + 0.15 + COUNT_IN * spb;
  for (const h of view.music.hits) if (Math.floor(h.at / 4) === m) audio.sample(h.drum, start + (h.at - 4 * m) * spb);
  rec = { turn: m, role, spb, start, presses: [], open: null, replay: role === "react" ? view.next.replay : null };
  $("go").hidden = true; $("pad").hidden = false; $("pad").focus(); $("flash").textContent = ""; $("msg").textContent = "";
  raf = requestAnimationFrame(frame);
}

function frame() {
  const t = audio.ctx.currentTime - rec.start, at = t / rec.spb;   // beats from beat 1 of the measure
  const count = at < -COUNT_IN ? "" : at < 0 ? String(Math.floor(at)) : at < 3 ? String(Math.floor(at) + 1) : "";   // -3, -2, -1, then 1 to 3; beat 4 is yours and shows nothing
  if ($("count").textContent !== count) $("count").textContent = count;
  if (rec.replay) paintReplay(t * 1000);
  if (at >= 5) return finishPlay();
  raf = requestAnimationFrame(frame);
}

// The other player's recording, drawn as it plays: their finger down, and an attack's wind-up shortly after it starts.
function paintReplay(ms) {
  const ps = rec.replay, spbMs = rec.spb * 1000, tok = $("them-token");
  if (!tok) return;
  const fingerDown = ps.some((p) => ms >= p.down && (p.up === null || ms < p.up));
  const first = ps[0], winding = !!first && first.down < 1.5 * spbMs && ms >= first.down + WINDUP_SHOWS_AFTER * spbMs && ms < 4.25 * spbMs;
  tok.classList.toggle("down", fingerDown); tok.classList.toggle("winding", winding);
}

async function finishPlay() {
  cancelAnimationFrame(raf);
  const r = rec; rec = null;
  $("pad").hidden = true; $("pad").classList.remove("down"); $("count").textContent = "";
  const spbMs = r.spb * 1000, mine = read(r.presses.map((p) => ({ down: p.down / spbMs, up: p.up === null ? null : p.up / spbMs })), spbMs);
  $("flash").textContent = mine.miss > 0 ? "Late!" : mine.miss < 0 ? "Early!" : mine.move === "none" ? "Nothing played." : mine.move === "unclear" ? "Not a move." : `${mine.move[0].toUpperCase() + mine.move.slice(1)}${mine.crit ? ", crit!" : "."}`;
  try {
    view = await api("duel/play", { id, turn: r.turn, presses: r.presses });
    const flash = $("flash").textContent;
    draw();
    $("flash").textContent = flash;
  } catch (e) {
    $("msg").textContent = e.message;
    $("go").hidden = false;
  }
}

// ---------- the pad: finger down and up, by pointer and by Space ----------

document.addEventListener("pointerdown", (e) => { if (e.target.closest("#pad")) { e.preventDefault(); e.target.closest("#pad").setPointerCapture?.(e.pointerId); down(); } });
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) document.addEventListener(type, () => up());
document.addEventListener("contextmenu", (e) => { if (e.target.closest("#pad")) e.preventDefault(); });
document.addEventListener("keydown", (e) => { if (e.code === "Space" && rec) { e.preventDefault(); if (!e.repeat) down(); } });
document.addEventListener("keyup", (e) => { if (e.code === "Space" && rec) { e.preventDefault(); up(); } });

// ---------- start ----------

setupAccount(async () => { if (id) await refresh(); else await homeList(); });
if (!id) home();
else {
  refresh().catch((e) => { $("duel").innerHTML = `<h1>Duel</h1><p class="status">${esc(e.message)}</p>`; });
  setInterval(() => { if (!rec && !document.hidden && view && ["wait", "join"].includes(view.next.role) && !view.over) refresh().catch(() => {}); }, 15000);
}
