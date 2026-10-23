// moba-beat Worker.
//   GET  /api/today                      the UTC day, the registry head it was sealed with, the day's hash, the music
//                                        made from it, and your run today if you've sealed one
//   POST /api/run {day, taps}            your run: tap times in ms from the song's first beat. The server scores them
//                                        against the day's beat (not secret: anyone can work it out from the day's hash).
//                                        Your first run of the day is sealed on the ledger; later ones are practice and
//                                        answer {sealed: false, run}. New players: 3 an hour per address.
//   POST /api/duel/new {}                make a duel over today's song; answers {id}. Send its link to whoever you want to fight.
//   POST /api/duel/join {id}             take the empty seat in a duel (not your own)
//   GET  /api/duel?id=N                  the duel: its state, what happened, and what you can do next (act, react, wait, ...)
//   POST /api/duel/play {id, turn, presses}   play your part of the current turn: your move (the actor, recorded blind) or
//                                        your live answer to the other player's recording (the reactor). Presses are
//                                        [{down, up}] in ms from the start of that turn's measure. The server reads them
//                                        (public/moves.js) and works out the fight (public/duel.js).
//   GET  /api/duels                      your duels, newest first
//   GET  /api/ledger?before=ID&limit=N   the chain, newest first (N up to 100)
//   GET  /api/account                    your save codes and passkeys (never the codes themselves), and your devices
//   POST /api/codes {action: new | remove, id}              make a save code (shown once) or forget one
//   POST /api/load {code}                log this browser in with a save code
//   POST /api/passkey {action: register_options | register | login_options | login | remove}
//   POST /api/logout                     this browser forgets its player (needs a save code or passkey first)
//
// Players: a random token in an `mb` cookie; only its SHA-256 is stored. Made on your first run or your first save
// code or passkey (looking never makes one). Save codes and passkeys belong to an account in the shared Accounts
// service (dungeon-items, bound as ACCOUNTS), which says which player here is yours; they work in the other 88x31
// games too. (The account code is copied from dawn-baton src/worker.js.)
// After every seal, the ledger's entry count and newest hash go to the shared registry as a checkpoint (REGISTRY).
import { dayEntry, runInsert, seal, sha256, verifyTip } from "./ledger.js";
import { registryHeadAt } from "./registry.js";
import { beat } from "../public/beat.js";
import { MAX_TAPS, score } from "../public/score.js";
import { MAX_PRESSES, read } from "../public/moves.js";
import { play } from "../public/duel.js";

const GAME = "moba-beat";
const COOKIE = "mb";
const COOKIE_MAX_AGE = 400 * 86400;
const now = () => Math.floor(Date.now() / 1000);
const utcDay = () => new Date().toISOString().slice(0, 10);

class Oops extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const body = async (req) => {
  let b;
  try { b = await req.json(); } catch {}
  if (!b || typeof b !== "object") throw new Oops("That request didn't make sense.");
  return b;
};

// ---------- players ----------

function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const readCookie = (req) => { const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)mb=([A-Za-z0-9_-]{20,})/); return m ? m[1] : null; };
const cookieFor = (token) => `${COOKIE}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
const CLEAR_COOKIE = `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

// The player behind this request's cookie, or null; with `create`, a new one (and ctx.setCookie). The first device's
// token is players.token_hash; devices loaded later each have a row in sessions. A v0.8 player still has their plain
// token in token_hash: they're upgraded to the hash here.
async function player(ctx, create = false) {
  const { env } = ctx, token = readCookie(ctx.req);
  if (token) {
    const h = await sha256(token);
    let p = await env.DB.prepare("SELECT id FROM players WHERE token_hash = ?").bind(h).first();
    if (!p) {
      p = await env.DB.prepare("SELECT player_id AS id FROM sessions WHERE token_hash = ?").bind(h).first();
      if (p) await env.DB.prepare("UPDATE sessions SET seen_at = ? WHERE token_hash = ?").bind(now(), h).run();
    }
    if (!p) {
      p = await env.DB.prepare("SELECT id FROM players WHERE token_hash = ?").bind(token).first();
      if (p) await env.DB.prepare("UPDATE players SET token_hash = ? WHERE id = ?").bind(h, p.id).run();
    }
    if (p) return p;
  }
  if (!create) return null;
  if (!(await rateLimit(env, ctx.req, "new-guest", 3, 3600))) throw new Oops("Too many new players from here. Try again later.", 429);
  const fresh = newToken();
  const row = await env.DB.prepare("INSERT INTO players (token_hash, created_at) VALUES (?, ?) RETURNING id").bind(await sha256(fresh), now()).first();
  ctx.setCookie = cookieFor(fresh);
  return row;
}
const must = async (ctx) => { const p = await player(ctx); if (!p) throw new Oops("No player here.", 401); return p; };

const runOf = (env, playerId, day) =>
  env.DB.prepare("SELECT perfect, good, miss FROM runs WHERE player_id = ? AND day = ?").bind(playerId, day).first();

// ---------- the day and runs ----------

async function sealToday(env) {
  const day = utcDay();
  const registryHead = () => registryHeadAt(day).catch((e) => { console.error(e); throw new Oops("Today's beat isn't ready yet. Try again in a moment.", 503); });
  const { hash, sealed } = await dayEntry(env.DB, day, registryHead, now());
  const { record } = await env.DB.prepare("SELECT record FROM ledger WHERE hash = ?").bind(hash).first();
  return { day, hash, sealed, registry: JSON.parse(record).registry };
}

async function today(ctx) {
  const t = await sealToday(ctx.env);
  if (t.sealed) ctx.waitUntil?.(checkpoint(ctx.env));
  const me = await player(ctx), run = me ? await runOf(ctx.env, me.id, t.day) : null;
  return { day: t.day, registry: t.registry, hash: t.hash, ...beat(t.hash), run };
}

async function saveRun(ctx) {
  const b = await body(ctx.req), { env } = ctx;
  const t = await sealToday(env);
  if (b.day !== t.day) throw new Oops("That day's beat is over. A new one starts at midnight UTC.", 409);
  const music = beat(t.hash), spb = 60000 / music.bpm, end = (music.measures * 4 + 1) * spb;
  if (!Array.isArray(b.taps) || b.taps.length > MAX_TAPS || !b.taps.every((x) => Number.isFinite(x) && x >= -3000 && x <= end))
    throw new Oops("Those taps don't fit today's beat.");
  const taps = b.taps.map(Math.round);   // scored as sealed, so the ledger's taps always give the ledger's score
  const res = score(music.targets.map((x) => x.at * spb), taps), n = (g) => res.filter((r) => r.grade === g).length;
  const run = { perfect: n("perfect"), good: n("good"), miss: n("miss") };

  const me = await player(ctx, true);
  const done = await runOf(env, me.id, t.day);
  if (done) return { sealed: false, run, today: done };
  const record = JSON.stringify({ day: t.day, player: me.id, taps, ...run });
  const sealed = await seal(env.DB, async (prev) => {
    const { hash, stmt } = await runInsert(env.DB, prev, { day: t.day, record, t: now() });
    return { hash, stmts: [
      env.DB.prepare("INSERT INTO runs (player_id, day, perfect, good, miss, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(me.id, t.day, run.perfect, run.good, run.miss, now()),
      stmt,
    ] };
  });
  if (sealed.duplicate) return { sealed: false, run, today: await runOf(env, me.id, t.day) };   // another tab sealed first
  ctx.waitUntil?.(checkpoint(env));
  return { sealed: true, run, hash: sealed.hash };
}

async function ledger(ctx) {
  const url = new URL(ctx.req.url);
  const before = Number(url.searchParams.get("before")) || Number.MAX_SAFE_INTEGER;
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 30));
  const { results } = await ctx.env.DB.prepare("SELECT id, kind, day, record, prev_hash, hash, created_at FROM ledger WHERE id < ? ORDER BY id DESC LIMIT ?").bind(before, limit).all();
  return { entries: results };
}

// The ledger so far goes to the shared registry as a checkpoint: its entry count and newest hash, which covers every
// entry before it. A registry that's away never stops a run: the next checkpoint covers it. (Copied from aura-farm's
// checkpoint.) It reads only the newest two entries (verifyTip, public/chain.js), so it costs the same however long the
// ledger is. Entries are never deleted, so the newest id is the entry count.
export async function checkpoint(env) {
  try {
    if (!env.REGISTRY) return;
    const rows = (await env.DB.prepare("SELECT id, record, prev_hash, hash FROM ledger ORDER BY id DESC LIMIT 2").all()).results.reverse();
    if (!rows.length) return;
    const last = rows[rows.length - 1], v = await verifyTip(rows);
    if (!v.ok) return console.error("The ledger is broken at entry " + v.at + ": no checkpoint sent.");
    const res = await env.REGISTRY.checkpoint({ game: GAME, entries: last.id, head: last.hash });
    if (res && res.error) console.error("The registry refused the checkpoint: " + res.error);
  } catch (e) { console.error(e); }
}

// ---------- duels ----------
// A duel is fought over one day's song (the day it was made); its 8 measures are 8 turns (public/duel.js). Every
// turn has two parts: the actor's recording, then the reactor's live answer to it. The state is worked out from the stored
// presses each time, so there is nothing to keep in step.

const readOf = (json, spb) => read(JSON.parse(json).map((p) => ({ down: p.down / spb, up: p.up == null ? null : p.up / spb })), spb);

// Presses off the wire: [{down, up}] in ms from the start of the measure. Sorted, rounded to whole ms, one finger at a time.
function cleanPresses(raw, spb) {
  const bad = () => new Oops("Those presses don't fit the measure.");
  if (!Array.isArray(raw) || raw.length > MAX_PRESSES) throw bad();
  const ps = raw.map((p) => {
    if (!p || !Number.isFinite(p.down) || p.down < -spb / 2 || p.down > spb * 4.5) throw bad();
    if (p.up != null && (!Number.isFinite(p.up) || p.up < p.down || p.up > p.down + spb * 8)) throw bad();
    return { down: Math.round(p.down), up: p.up == null ? null : Math.round(p.up) };
  }).sort((a, b) => a.down - b.down);
  for (let i = 1; i < ps.length; i++) if (ps[i - 1].up === null || ps[i - 1].up > ps[i].down) throw bad();
  return ps;
}

const duelIdOf = (v) => { const id = Number(v); if (!Number.isInteger(id) || id < 1) throw new Oops("No such duel.", 404); return id; };
async function duelRow(env, id) {
  const d = await env.DB.prepare("SELECT id, day, p0, p1 FROM duels WHERE id = ?").bind(id).first();
  if (!d) throw new Oops("No such duel.", 404);
  return d;
}

// Everything the page needs about a duel, for the player `myId` (null for a stranger): which seat they have, what has
// happened, the state now, and what they can do next. The actor's recording is shown only to the reactor who is about to
// answer it (`replay`); once a turn is finished both recordings are open to everyone.
async function duelView(env, duel, myId) {
  const { hash } = await env.DB.prepare("SELECT hash FROM ledger WHERE kind = 'day' AND day = ?").bind(duel.day).first();
  const music = beat(hash), spb = 60000 / music.bpm;
  const rows = (await env.DB.prepare("SELECT turn, act, react FROM duel_turns WHERE duel_id = ? ORDER BY turn").bind(duel.id).all()).results;
  const done = rows.filter((r) => r.react !== null), pending = rows.find((r) => r.react === null) ?? null;
  const g = play(done.map((r) => ({ actor: readOf(r.act, spb), reactor: readOf(r.react, spb) })));
  const me = myId === duel.p0 ? 0 : myId !== null && myId === duel.p1 ? 1 : null;
  const t = done.length, actor = t % 2;
  let next;
  if (!duel.p1) next = { role: me === 0 ? "wait" : "join" };
  else if (g.over) next = { role: "over" };
  else if (!pending) next = { turn: t, role: me === actor ? "act" : me === null ? "watch" : "wait" };
  else next = { turn: t, role: me === 1 - actor ? "react" : me === null ? "watch" : "wait", ...(me === 1 - actor ? { replay: JSON.parse(pending.act) } : {}) };
  return {
    id: duel.id, day: duel.day, me, joined: !!duel.p1, state: g.state, over: g.over, winner: g.winner, next,
    turns: g.log.map((e, i) => ({ ...e, act: JSON.parse(done[i].act), react: JSON.parse(done[i].react) })),
    music: { bpm: music.bpm, style: music.style, voice: music.voice, hits: music.hits, measures: music.measures },
  };
}

async function duelNew(ctx) {
  const { env } = ctx;
  if (!(await rateLimit(env, ctx.req, "new-duel", 10, 3600))) throw new Oops("Too many new duels from here. Try again later.", 429);
  const me = await player(ctx, true), t = await sealToday(env);
  if (t.sealed) ctx.waitUntil?.(checkpoint(env));
  const row = await env.DB.prepare("INSERT INTO duels (day, p0, created_at) VALUES (?, ?, ?) RETURNING id").bind(t.day, me.id, now()).first();
  return { id: row.id };
}

async function duelJoin(ctx) {
  const { env } = ctx, id = duelIdOf((await body(ctx.req)).id), duel = await duelRow(env, id);
  const me = await player(ctx, true);
  if (duel.p0 === me.id) throw new Oops("That's your own duel. Send its link to someone else.");
  const r = await env.DB.prepare("UPDATE duels SET p1 = ? WHERE id = ? AND p1 IS NULL").bind(me.id, id).run();
  if (!r.meta.changes && duel.p1 !== me.id) throw new Oops("That duel already has two players.", 409);
  return duelView(env, await duelRow(env, id), me.id);
}

async function duelGet(ctx) {
  const id = duelIdOf(new URL(ctx.req.url).searchParams.get("id")), me = await player(ctx);
  return duelView(ctx.env, await duelRow(ctx.env, id), me ? me.id : null);
}

async function duelPlay(ctx) {
  const { env } = ctx, b = await body(ctx.req), id = duelIdOf(b.id), me = await must(ctx), duel = await duelRow(env, id);
  const view = await duelView(env, duel, me.id), { role, turn } = view.next;
  if (role !== "act" && role !== "react") throw new Oops(view.over ? "That duel is over." : "It's not your turn.", 409);
  if (b.turn !== turn) throw new Oops("That isn't the current turn.", 409);
  const spb = 60000 / view.music.bpm, presses = JSON.stringify(cleanPresses(b.presses, spb));
  if (role === "act") {
    try { await env.DB.prepare("INSERT INTO duel_turns (duel_id, turn, act, created_at) VALUES (?, ?, ?, ?)").bind(id, turn, presses, now()).run(); }
    catch (e) { if (/UNIQUE|PRIMARY/i.test(String(e && e.message))) throw new Oops("That turn was already played.", 409); throw e; }
  } else {
    const r = await env.DB.prepare("UPDATE duel_turns SET react = ? WHERE duel_id = ? AND turn = ? AND react IS NULL").bind(presses, id, turn).run();
    if (!r.meta.changes) throw new Oops("That turn was already played.", 409);
  }
  return duelView(env, duel, me.id);
}

// Your duels, newest first, each in a line: whose turn it is and the score so far.
async function duelList(ctx) {
  const me = await player(ctx);
  if (!me) return { duels: [] };
  const { results } = await ctx.env.DB.prepare("SELECT id, day, p0, p1 FROM duels WHERE p0 = ? OR p1 = ? ORDER BY id DESC LIMIT 20").bind(me.id, me.id).all();
  const duels = [];
  for (const d of results) {
    const v = await duelView(ctx.env, d, me.id);
    duels.push({ id: v.id, day: v.day, me: v.me, joined: v.joined, over: v.over, winner: v.winner, hp: v.state.hp, role: v.next.role });
  }
  return { duels };
}

// ---------- save codes and passkeys (kept by the shared Accounts service in dungeon-items) ----------
// This game keeps its own players and cookie. Save codes and passkeys belong to an account there; the account says which
// player here is yours. A player gets an account the first time they make a code or passkey.

const ACC = (env) => { if (!env.ACCOUNTS) throw new Oops("Accounts are unavailable right now. Try again in a moment.", 503); return env.ACCOUNTS; };
const ipOf = (req) => req.headers.get("cf-connecting-ip") || "unknown";
const ok = (r) => { if (r && r.error) throw new Oops(r.error, r.status || 400); return r; };

// Fixed window per hashed IP and action. Returns true if allowed.
async function rateLimit(env, req, action, limit, windowSecs) {
  const key = action + ":" + (await sha256("ip:" + ipOf(req))).slice(0, 32);
  const t = now(), windowStart = t - (t % windowSecs);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`).bind(key, windowStart).first();
  return row.count <= limit;
}

// This player's account id (or null; made on the spot with `make`).
async function accountFor(env, me, make = false) {
  const acc = ACC(env);
  let id = (await acc.accountOf(GAME, me.id)).accountId;
  if (id || !make) return id ?? null;
  id = (await acc.createAccount()).accountId;
  if (!ok(await acc.link(id, GAME, me.id)).linked) throw new Oops("That didn't work. Try again.");
  return id;
}

// Log this browser in as the account's player here: the one it already has, else this browser's own player (if it has
// no account yet), else a new one. The browser gets its own session token.
async function enter(ctx, accountId) {
  const { env } = ctx, acc = ACC(env);
  let { playerId } = await acc.playerFor(accountId, GAME);
  if (!playerId) {
    const cur = await player(ctx);
    if (cur && !(await acc.accountOf(GAME, cur.id)).accountId) playerId = cur.id;
    else {
      if (!(await rateLimit(env, ctx.req, "new-player", 20, 3600))) throw new Oops("Too many new players from here. Try again later.", 429);
      playerId = (await env.DB.prepare("INSERT INTO players (token_hash, created_at) VALUES (?, ?) RETURNING id").bind(await sha256(newToken()), now()).first()).id;
    }
    playerId = ok(await acc.link(accountId, GAME, playerId)).playerId;
  }
  const token = newToken();
  await env.DB.prepare("INSERT INTO sessions (token_hash, player_id, created_at, seen_at) VALUES (?, ?, ?, ?)").bind(await sha256(token), playerId, now(), now()).run();
  ctx.setCookie = cookieFor(token);
}

async function account(ctx) {
  const me = await player(ctx);
  if (!me) return { player: false, codes: [], passkeys: [], devices: 0 };
  const id = await accountFor(ctx.env, me);
  const ways = id ? ok(await ACC(ctx.env).info(id)) : { codes: [], passkeys: [] };
  const devices = 1 + (await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?").bind(me.id).first()).n;
  return { player: true, id: me.id, codes: ways.codes, passkeys: ways.passkeys, devices };
}

async function codes(ctx) {
  const b = await body(ctx.req);
  if (b.action === "new") {
    const me = await player(ctx, true);
    return { code: ok(await ACC(ctx.env).addCode(await accountFor(ctx.env, me, true))).code };
  }
  if (b.action === "remove") {
    const me = await must(ctx), id = await accountFor(ctx.env, me);
    if (!id) throw new Oops("No such save code.", 404);
    ok(await ACC(ctx.env).removeCode(id, Number(b.id)));
    return { ok: true };
  }
  throw new Oops("Unknown action.");
}

// Type a save code: this device becomes that player.
async function loadCode(ctx) {
  const r = ok(await ACC(ctx.env).loginCode({ code: (await body(ctx.req)).code, ip: ipOf(ctx.req) }));
  await enter(ctx, r.accountId);
  return { ok: true };
}

async function passkey(ctx) {
  const b = await body(ctx.req), { env, req } = ctx, acc = ACC(env), origin = new URL(req.url).origin;
  if (b.action === "login_options") return ok(await acc.passkeyLoginOptions({ origin, ip: ipOf(req) }));
  if (b.action === "login") {
    const r = ok(await acc.passkeyLogin({ origin, ip: ipOf(req), credential: b.credential }));
    await enter(ctx, r.accountId);
    return { ok: true };
  }
  if (b.action === "register_options" || b.action === "register") {
    const me = await player(ctx, true), accountId = await accountFor(env, me, true);
    if (b.action === "register_options") return ok(await acc.passkeyRegisterOptions({ accountId, origin }));
    return ok(await acc.passkeyRegister({ accountId, origin, credential: b.credential, label: b.label }));
  }
  if (b.action === "remove") {
    const me = await must(ctx), id = await accountFor(env, me);
    if (!id) throw new Oops("No such passkey.", 404);
    return ok(await acc.passkeyRemove(id, Number(b.id)));
  }
  throw new Oops("Unknown action.");
}

// Log out: this browser forgets its player, but only once there's a save code or passkey to get back in. A device
// loaded later just loses its session; the first device's token is replaced with one nobody has.
async function logout(ctx) {
  const me = await player(ctx), { env } = ctx;
  if (!me) { ctx.setCookie = CLEAR_COOKIE; return { ok: true }; }
  const id = await accountFor(env, me);
  if (!(id ? await ACC(env).waysIn(id) : 0)) throw new Oops("Make a save code or passkey first, or you'd have no way back in.");
  const h = await sha256(readCookie(ctx.req));
  const s = await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(h).run();
  if (!s.meta.changes) await env.DB.prepare("UPDATE players SET token_hash = ? WHERE id = ? AND token_hash = ?").bind(await sha256(newToken()), me.id, h).run();
  ctx.setCookie = CLEAR_COOKIE;
  return { ok: true };
}

// ---------- routing ----------

const ROUTES = {
  "GET /api/today": today, "POST /api/run": saveRun, "GET /api/ledger": ledger,
  "POST /api/duel/new": duelNew, "POST /api/duel/join": duelJoin, "GET /api/duel": duelGet, "POST /api/duel/play": duelPlay, "GET /api/duels": duelList,
  "GET /api/account": account, "POST /api/codes": codes, "POST /api/load": loadCode, "POST /api/passkey": passkey, "POST /api/logout": logout,
};

export default {
  async fetch(req, env, ectx) {
    const url = new URL(req.url), route = ROUTES[req.method + " " + url.pathname];
    if (!route) return json({ error: "Not found." }, 404);
    const ctx = { req, env, waitUntil: (p) => ectx?.waitUntil?.(p), setCookie: null };
    try {
      const res = json(await route(ctx));
      if (ctx.setCookie) res.headers.append("set-cookie", ctx.setCookie);
      return res;
    } catch (e) {
      if (e instanceof Oops) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Something broke. Try again in a moment." }, 500);
    }
  },
};
