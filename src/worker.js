// moba-beat Worker.
//   GET  /api/today                      the UTC day, the registry head it was sealed with, the day's hash, the music
//                                        made from it, and your run today if you've sealed one
//   POST /api/run {day, taps}            your run: tap times in ms from the song's first beat. The server scores them
//                                        against the day's hidden beat. Your first run of the day is sealed on the
//                                        ledger; later ones are practice and answer {sealed: false, run}.
//   GET  /api/ledger?before=ID&limit=N   the chain, newest first (N up to 100)
//
// Players are a random token in a cookie (mb): no name, no save code yet. Made on your first run.
// After every seal, the ledger's entry count and newest hash go to the shared registry as a checkpoint (dungeon-items,
// bound as REGISTRY), like the other games; the registry is timestamped hourly by 88x31-anchors.
import { dayEntry, head, runInsert, verifyChain } from "./ledger.js";
import { registryHeadAt } from "./registry.js";
import { beat } from "../public/beat.js";
import { score } from "../public/score.js";

const COOKIE = "mb";
const MAX_TAPS = 128;
const now = () => Math.floor(Date.now() / 1000);
const utcDay = () => new Date().toISOString().slice(0, 10);
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
const cookieOf = (req) => (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);

async function playerOf(env, req) {
  const token = cookieOf(req);
  return token ? await env.DB.prepare("SELECT id FROM players WHERE token = ?").bind(token).first() : null;
}
async function makePlayer(env) {
  const token = crypto.randomUUID();
  const { meta } = await env.DB.prepare("INSERT INTO players (token, created_at) VALUES (?, ?)").bind(token, now()).run();
  const id = meta.last_row_id ?? (await env.DB.prepare("SELECT id FROM players WHERE token = ?").bind(token).first()).id;
  return { id, cookie: `${COOKIE}=${token}; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax` };
}
const runOf = (env, playerId, day) =>
  env.DB.prepare("SELECT perfect, good, miss FROM runs WHERE player_id = ? AND day = ?").bind(playerId, day).first();

async function today(env) {
  const day = utcDay();
  const { hash, sealed } = await dayEntry(env.DB, day, () => registryHeadAt(day), now());
  const { record } = await env.DB.prepare("SELECT record FROM ledger WHERE hash = ?").bind(hash).first();
  return { day, hash, sealed, registry: JSON.parse(record).registry };
}

async function saveRun(req, env, ctx) {
  const b = await req.json().catch(() => ({}));
  const t = await today(env);
  if (b.day !== t.day) return json({ error: "That day's beat is over. A new one starts at midnight UTC." }, 409);
  const music = beat(t.hash), end = (music.measures * 4 + 1) * 60000 / music.bpm;
  const taps = b.taps;
  if (!Array.isArray(taps) || taps.length > MAX_TAPS || !taps.every((x) => Number.isFinite(x) && x >= -3000 && x <= end))
    return json({ error: "Those taps don't fit today's beat." }, 400);
  const spb = 60000 / music.bpm;
  const res = score(music.targets.map((x) => x.at * spb), taps), n = (g) => res.filter((r) => r.grade === g).length;
  const run = { perfect: n("perfect"), good: n("good"), miss: n("miss") };

  let player = await playerOf(env, req), cookie = null;
  if (!player) { const p = await makePlayer(env); player = { id: p.id }; cookie = p.cookie; }
  const headers = cookie ? { "set-cookie": cookie } : {};
  const done = await runOf(env, player.id, t.day);
  if (done) return json({ sealed: false, run, today: done }, 200, headers);

  const record = JSON.stringify({ day: t.day, player: player.id, taps: taps.map(Math.round), ...run });
  const { hash, stmt } = await runInsert(env.DB, await head(env.DB), { day: t.day, record, t: now() });
  await env.DB.batch([
    env.DB.prepare("INSERT INTO runs (player_id, day, perfect, good, miss, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(player.id, t.day, run.perfect, run.good, run.miss, now()),
    stmt,
  ]);
  ctx?.waitUntil?.(checkpoint(env));
  return json({ sealed: true, run, hash }, 200, headers);
}

// The ledger so far goes to the shared registry as a checkpoint: its entry count and newest hash, which covers every
// entry before it. Only a chain that checks out is sent. A registry that's away never stops a run: the next
// checkpoint covers it. (Copied from aura-farm's checkpoint.)
export async function checkpoint(env) {
  try {
    if (!env.REGISTRY) return;
    const rows = (await env.DB.prepare("SELECT id, record, prev_hash, hash FROM ledger ORDER BY id").all()).results;
    if (!rows.length) return;
    const v = await verifyChain(rows);
    if (!v.ok) return console.error("The ledger is broken at entry " + v.at + ": no checkpoint sent.");
    const res = await env.REGISTRY.checkpoint({ game: "moba-beat", entries: rows.length, head: rows[rows.length - 1].hash });
    if (res && res.error) console.error("The registry refused the checkpoint: " + res.error);
  } catch (e) { console.error(e); }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/api/today") {
      const t = await today(env);
      if (t.sealed) ctx?.waitUntil?.(checkpoint(env));
      const player = await playerOf(env, req), run = player ? await runOf(env, player.id, t.day) : null;
      return json({ day: t.day, registry: t.registry, hash: t.hash, ...beat(t.hash), run });
    }
    if (req.method === "POST" && url.pathname === "/api/run") return saveRun(req, env, ctx);
    if (req.method === "GET" && url.pathname === "/api/ledger") {
      const before = Number(url.searchParams.get("before")) || Number.MAX_SAFE_INTEGER;
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 30));
      const { results } = await env.DB.prepare("SELECT id, kind, day, record, prev_hash, hash, created_at FROM ledger WHERE id < ? ORDER BY id DESC LIMIT ?").bind(before, limit).all();
      return json({ entries: results });
    }
    return json({ error: "Not found." }, 404);
  },
};
