// The ledger page: the chain from /api/ledger, newest first. A day entry shows the music its hash makes (beat.js, the
// same code the game uses); a run shows its score. "Check the chain" fetches every entry and checks every hash in
// this browser (chain.js, the same check the server runs).
import { beat } from "./beat.js";
import { verifyChain } from "./chain.js";

const $ = (id) => document.getElementById(id);
const NOTE = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const short = (h) => h.slice(0, 10) + "…";
let oldest = null;

function row(e) {
  const r = JSON.parse(e.record);
  let what;
  if (e.kind === "day") {
    const m = beat(e.hash);
    what = `<b>${r.day}</b>: ${m.style} at ${m.bpm} BPM in ${NOTE[m.key]} major, chords ${m.chords.map((c) => NOTE[c.root] + (c.quality === "min" ? "m" : "")).join(" ")}
      <span class="sub">made from the registry's head at midnight UTC, <span title="${r.registry}">${short(r.registry)}</span></span>`;
  } else {
    what = `<b>Player ${r.player}</b> played ${r.day}: ${r.perfect} perfect, ${r.good} good, ${r.miss} missed
      <span class="sub">${r.taps.length} taps</span>`;
  }
  return `<li class="${e.kind}"><span class="n">#${e.id}</span><span class="what">${what}</span><span class="hash" title="${e.hash}">${short(e.hash)}</span></li>`;
}

async function page() {
  const r = await fetch("/api/ledger?limit=50" + (oldest ? "&before=" + oldest : ""));
  const { entries } = await r.json();
  $("entries").insertAdjacentHTML("beforeend", entries.map(row).join(""));
  if (entries.length) oldest = entries[entries.length - 1].id;
  $("more").hidden = entries.length < 50;
  if (!entries.length && !oldest) $("entries").innerHTML = "<li>Nothing sealed yet. The first visit of the day seals its beat.</li>";
}

$("check").addEventListener("click", async () => {
  $("checked").textContent = "Checking…";
  const all = [];
  for (let before = ""; ;) {
    const { entries } = await (await fetch("/api/ledger?limit=100" + before)).json();
    all.push(...entries);
    if (entries.length < 100) break;
    before = "&before=" + entries[entries.length - 1].id;
  }
  const v = await verifyChain(all.reverse());
  $("checked").textContent = v.ok ? `All ${all.length} entries check out.` : `The chain breaks at entry #${v.at}.`;
});
$("more").addEventListener("click", page);
page();
