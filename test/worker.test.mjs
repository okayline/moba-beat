// The Worker against a D1 lookalike, a stand-in registry ledger (for the day's head) and a stand-in REGISTRY binding.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/worker.js";
import { score } from "../public/score.js";

// a tiny D1 lookalike (copied from clutch-feed-tilt test/worker.test.mjs)
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const prep = (sql, args = []) => ({
    sql, args,
    bind: (...a) => prep(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
  });
  const batch = async (stmts) => {
    db.exec("BEGIN");
    try { const out = stmts.map((st) => db.prepare(st.sql).run(...st.args)); db.exec("COMMIT"); return out; }
    catch (e) { db.exec("ROLLBACK"); throw e; }
  };
  return { prepare: (sql) => prep(sql), batch, raw: db };
}
const sha = (t) => createHash("sha256").update(t).digest("hex");

// A stand-in for the shared accounts (the Accounts entrypoint of dungeon-items, tested there), copied from
// clutch-feed-tilt's tests (from scoundrel.exe's): same answers, kept in maps. A "passkey" is any credential { id }.
function fakeAccounts() {
  let n = 0; const codes = new Map(), keys = new Map(), links = new Map();
  const err = (error, status = 400) => ({ error, status });
  const own = (id) => [...codes].filter(([, v]) => v.acct === id);
  return {
    async createAccount() { return { accountId: ++n }; },
    async addCode(id) { const code = "CODE-" + (codes.size + 1) + "-" + id; codes.set(code, { acct: id, id: codes.size + 1 }); return { code }; },
    async removeCode(id, cid) { const e = [...codes].find(([, v]) => v.acct === id && v.id === cid); if (!e) return err("No such save code.", 404); codes.delete(e[0]); return { ok: true }; },
    async loginCode({ code }) { const v = codes.get(code); return v ? { accountId: v.acct } : err("That save code didn't work. Check it and try again.", 404); },
    async info(id) { return { codes: own(id).map(([, v]) => ({ id: v.id, created_at: 1, last_used_at: null })), passkeys: [...keys].filter(([, v]) => v.acct === id).map(([, v]) => ({ id: v.id, label: v.label })) }; },
    async waysIn(id) { return own(id).length + [...keys].filter(([, v]) => v.acct === id).length; },
    async playerFor(id, g) { return { playerId: links.get(id + "|" + g) ?? null }; },
    async link(id, g, p) {
      if (links.has(id + "|" + g)) return { playerId: links.get(id + "|" + g), linked: links.get(id + "|" + g) === p };
      links.set(id + "|" + g, p); return { playerId: p, linked: true };
    },
    async accountOf(g, p) { const e = [...links].find(([k, v]) => k.endsWith("|" + g) && v === p); return { accountId: e ? Number(e[0].split("|")[0]) : null }; },
    async passkeyRegisterOptions({ accountId }) { return { challenge: "c-" + accountId }; },
    async passkeyRegister({ accountId, credential, label }) { keys.set(credential.id, { acct: accountId, id: keys.size + 1, label }); return { ok: true }; },
    async passkeyLoginOptions() { return { challenge: "login" }; },
    async passkeyLogin({ credential }) { const k = keys.get(credential?.id); return k ? { accountId: k.acct } : err("That passkey isn't saved here.", 400); },
    async passkeyRemove(id, kid) { const e = [...keys].find(([, v]) => v.acct === id && v.id === kid); if (!e) return err("No such passkey.", 404); keys.delete(e[0]); return { ok: true }; },
  };
}
const GENESIS = "0".repeat(64), R1 = "a".repeat(64);

function setup() {
  const DB = fakeD1(), calls = [], waits = [];
  const env = { DB, ACCOUNTS: fakeAccounts(), REGISTRY: { checkpoint: async (c) => { calls.push(c); return { ok: true, created: true } } } };
  const ctx = { waitUntil: (p) => waits.push(p) };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ entries: [{ id: 1, hash: R1, at: 1 }] }) });
  const call = async (path, { body, cookie, ip } = {}) => {
    const r = await worker.fetch(new Request("https://x" + path, {
      method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(ip ? { "cf-connecting-ip": ip } : {}) },
      ...(body ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
    }), env, ctx);
    await Promise.all(waits.splice(0));
    return { status: r.status, cookie: r.headers.get("set-cookie"), ...(await r.json()) };
  };
  return { env, call, calls };
}

test("a run is scored by the server against the hidden beat and sealed once a day; the registry gets a checkpoint", async () => {
  const real = globalThis.fetch;
  try {
    const { env, call, calls } = setup();
    const t = await call("/api/today");
    const day = new Date().toISOString().slice(0, 10), dayRec = JSON.stringify({ day, registry: R1 });
    assert.equal(t.hash, sha(GENESIS + "|" + dayRec), "today's hash is the day entry's, chained from GENESIS");
    assert.equal(t.run, null);
    assert.deepEqual(calls, [{ game: "moba-beat", entries: 1, head: t.hash }], "sealing the day sends a checkpoint");

    // taps on every target, except: the first is skipped (a miss) and the second is 50 ms late (good, not perfect)
    const spb = 60000 / t.bpm, at = t.targets.map((x) => x.at * spb);
    const taps = at.slice(1).map((ms, i) => (i === 0 ? ms + 50 : ms));
    const want = { perfect: at.length - 2, good: 1, miss: 1 };
    const a = await call("/api/run", { body: { day, taps } });
    assert.equal(a.status, 200);
    assert.equal(a.sealed, true);
    assert.deepEqual(a.run, want);
    assert.match(a.cookie, /^mb=[A-Za-z0-9_-]{43}; Path=\/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax$/);
    assert.equal(env.DB.raw.prepare("SELECT token_hash FROM players").get().token_hash, sha(a.cookie.split(";")[0].slice(3)), "only the token's hash is kept");
    const runRec = JSON.stringify({ day, player: 1, taps: taps.map(Math.round), ...want });
    assert.equal(a.hash, sha(t.hash + "|" + runRec), "the run chains from the day entry; the record holds the player's id, never a name");
    assert.deepEqual(env.DB.raw.prepare("SELECT kind, record FROM ledger ORDER BY id").all().map((r) => [r.kind, r.record]), [["day", dayRec], ["run", runRec]]);
    assert.deepEqual(calls[1], { game: "moba-beat", entries: 2, head: a.hash });

    // the same player again: practice, not sealed; today shows their sealed run
    const me = a.cookie.split(";")[0];
    const b = await call("/api/run", { body: { day, taps: [] }, cookie: me });
    assert.deepEqual([b.sealed, b.run.miss, b.today], [false, at.length, want]);
    assert.deepEqual((await call("/api/today", { cookie: me })).run, want);
    assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM ledger").get().n, 2, "practice isn't sealed");

    // someone new is a second player, chained after the first run
    const c = await call("/api/run", { body: { day, taps: [] } });
    assert.equal(c.sealed, true);
    assert.equal(c.hash, sha(a.hash + "|" + JSON.stringify({ day, player: 2, taps: [], perfect: 0, good: 0, miss: at.length })));

    // refused
    assert.equal((await call("/api/run", { body: { day: "2020-01-01", taps: [] } })).status, 409, "another day's beat");
    assert.equal((await call("/api/run", { body: { day, taps: "x" } })).status, 400, "taps aren't a list");
    assert.equal((await call("/api/run", { body: { day, taps: [1e9] } })).status, 400, "a tap long after the song ends");
    assert.equal((await call("/api/run", { body: { day, taps: Array(129).fill(0) } })).status, 400, "too many taps");
    assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM runs").get().n, 2);
  } finally { globalThis.fetch = real; }
});

test("save codes and passkeys: load your player on another device, log out only with a way back in", async () => {
  const real = globalThis.fetch;
  try {
    const { env, call } = setup();
    assert.equal((await call("/api/account")).player, false, "just looking makes no player");
    const made = await call("/api/codes", { body: { action: "new" } });
    const ann = made.cookie.split(";")[0];
    assert.equal((await call("/api/account", { cookie: ann })).codes.length, 1);
    assert.equal((await call("/api/load", { body: { code: "WRONG" } })).status, 404);
    const phone = (await call("/api/load", { body: { code: made.code } })).cookie.split(";")[0];
    assert.notEqual(phone, ann, "the phone gets its own token");
    assert.deepEqual([(await call("/api/account", { cookie: phone })).id, (await call("/api/account", { cookie: phone })).devices], [1, 2]);
    await call("/api/passkey", { body: { action: "register", label: "phone", credential: { id: "key1" } }, cookie: phone });
    assert.equal((await call("/api/account", { cookie: ann })).passkeys.length, 1);
    assert.equal((await call("/api/logout", { body: {}, cookie: ann })).status, 200);
    assert.equal((await call("/api/account", { cookie: ann })).player, false, "logged out");
    const back = (await call("/api/passkey", { body: { action: "login", credential: { id: "key1" } } })).cookie.split(";")[0];
    assert.equal((await call("/api/account", { cookie: back })).id, 1);
    assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM players").get().n, 1, "logging in never made a second player");
    // a browser with no code or passkey can't log out
    const bo = (await call("/api/run", { body: { day: new Date().toISOString().slice(0, 10), taps: [] } })).cookie.split(";")[0];
    assert.equal((await call("/api/logout", { body: {}, cookie: bo })).status, 400);
  } finally { globalThis.fetch = real; }
});

test("a player from v0.8 (a plain token in the database) is found and upgraded to the hash", async () => {
  const real = globalThis.fetch;
  try {
    const { env, call } = setup();
    const token = "0123456789abcdef0123456789abcdef";
    env.DB.raw.prepare("INSERT INTO players (token_hash, created_at) VALUES (?, 1)").run(token);
    assert.equal((await call("/api/account", { cookie: "mb=" + token })).id, 1);
    assert.equal(env.DB.raw.prepare("SELECT token_hash FROM players").get().token_hash, sha(token));
    assert.equal((await call("/api/account", { cookie: "mb=" + token })).id, 1, "and found by the hash after that");
  } finally { globalThis.fetch = real; }
});

test("the migrations build the same tables as schema.sql", () => {
  const fresh = new DatabaseSync(":memory:"), old = new DatabaseSync(":memory:");
  fresh.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  // the ledger table came first, straight from schema.sql (v0.1); then the migrations
  old.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8").split("-- v0.8")[0]);
  for (const m of ["001_runs.sql", "002_accounts.sql"]) old.exec(readFileSync(new URL("../migrations/" + m, import.meta.url), "utf8"));
  const shape = (d) => d.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map((r) => r.name + ":" + d.prepare(`SELECT group_concat(name || ' ' || type || ' ' || "notnull", ',') AS c FROM pragma_table_info('${r.name}')`).get().c);
  assert.deepEqual(shape(old), shape(fresh));
});

test("two runs sealed at the same moment both land on the chain, one after the other", async () => {
  const real = globalThis.fetch;
  try {
    const { env, call } = setup();
    const day = new Date().toISOString().slice(0, 10);
    const [a, b] = await Promise.all([call("/api/today"), call("/api/today")]);
    assert.equal(a.hash, b.hash, "the day is sealed once even when two first visits race");
    const runs = await Promise.all([call("/api/run", { body: { day, taps: [] }, ip: "1.1.1.1" }), call("/api/run", { body: { day, taps: [] }, ip: "2.2.2.2" })]);
    assert.deepEqual(runs.map((r) => [r.status, r.sealed]), [[200, true], [200, true]]);
    const rows = env.DB.raw.prepare("SELECT kind, prev_hash, hash FROM ledger ORDER BY id").all();
    assert.deepEqual(rows.map((r) => r.kind), ["day", "run", "run"]);
    assert.deepEqual([rows[1].prev_hash, rows[2].prev_hash], [rows[0].hash, rows[1].hash], "the second run was sealed again on the first one");
  } finally { globalThis.fetch = real; }
});

test("a fourth new player from one address in an hour is turned away, and nothing is sealed for it", async () => {
  const real = globalThis.fetch;
  try {
    const { env, call } = setup();
    const day = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < 3; i++) assert.equal((await call("/api/run", { body: { day, taps: [] }, ip: "9.9.9.9" })).status, 200);
    const r = await call("/api/run", { body: { day, taps: [] }, ip: "9.9.9.9" });
    assert.equal(r.status, 429);
    assert.equal((await call("/api/codes", { body: { action: "new" }, ip: "9.9.9.9" })).status, 429, "a save code doesn't make one either");
    assert.equal((await call("/api/run", { body: { day, taps: [] }, ip: "8.8.8.8" })).status, 200, "another address still can");
    assert.deepEqual([env.DB.raw.prepare("SELECT COUNT(*) AS n FROM players").get().n, env.DB.raw.prepare("SELECT COUNT(*) AS n FROM ledger WHERE kind = 'run'").get().n], [4, 4]);
  } finally { globalThis.fetch = real; }
});

test("the checkpoint sends the newest id and hash, and nothing when the newest entry doesn't chain", async () => {
  const real = globalThis.fetch;
  try {
    const { env, call, calls } = setup();
    const day = new Date().toISOString().slice(0, 10);
    await call("/api/today");
    const a = await call("/api/run", { body: { day, taps: [] }, ip: "1.1.1.1" });
    assert.deepEqual(calls.at(-1), { game: "moba-beat", entries: 2, head: a.hash });
    env.DB.raw.prepare("UPDATE ledger SET record = '{}' WHERE id = 2").run();
    const n = calls.length;
    await call("/api/run", { body: { day, taps: [] }, ip: "2.2.2.2" });
    assert.equal(calls.length, n + 1, "the third entry chains from the second as it stands, so it's sent");
    env.DB.raw.prepare("UPDATE ledger SET record = '{}' WHERE id = 3").run();
    const { checkpoint } = await import("../src/worker.js");
    await checkpoint(env);
    assert.equal(calls.length, n + 1, "a newest entry whose hash is wrong is not sent");
  } finally { globalThis.fetch = real; }
});

test("taps are rounded to whole ms before scoring, so the sealed taps give the sealed score", async () => {
  const real = globalThis.fetch;
  try {
    const { env, call } = setup();
    const t = await call("/api/today"), day = t.day, spb = 60000 / t.bpm;
    const taps = t.targets.map((x, i) => x.at * spb + 34.5 + i / 7);   // around the 35 ms edge, never whole
    const a = await call("/api/run", { body: { day, taps } });
    const rec = JSON.parse(env.DB.raw.prepare("SELECT record FROM ledger WHERE kind = 'run'").get().record);
    assert.ok(rec.taps.every(Number.isInteger));
    const again = score(t.targets.map((x) => x.at * spb), rec.taps), n = (g) => again.filter((r) => r.grade === g).length;
    assert.deepEqual(a.run, { perfect: n("perfect"), good: n("good"), miss: n("miss") });
  } finally { globalThis.fetch = real; }
});

test("a body that isn't an object is a 400; a registry that's away is a 503 and seals nothing", async () => {
  const real = globalThis.fetch;
  try {
    const { env, call } = setup();
    assert.equal((await call("/api/run", { body: "null" })).status, 400);
    globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => ({}) });
    assert.equal((await call("/api/today")).status, 503);
    assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM ledger").get().n, 0);
  } finally { globalThis.fetch = real; }
});
