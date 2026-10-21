// The Worker against a D1 lookalike, a stand-in registry ledger (for the day's head) and a stand-in REGISTRY binding.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/worker.js";
import { beat } from "../public/beat.js";

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
const GENESIS = "0".repeat(64), R1 = "a".repeat(64);

function setup() {
  const DB = fakeD1(), calls = [], waits = [];
  const env = { DB, REGISTRY: { checkpoint: async (c) => { calls.push(c); return { ok: true, created: true } } } };
  const ctx = { waitUntil: (p) => waits.push(p) };
  globalThis.fetch = async () => ({ json: async () => ({ entries: [{ id: 1, hash: R1, at: 1 }] }) });
  const call = async (path, { body, cookie } = {}) => {
    const r = await worker.fetch(new Request("https://x" + path, {
      method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
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
    assert.match(a.cookie, /^mb=[0-9a-f-]{36}; Path=\/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax$/);
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

test("the migrations build the same tables as schema.sql", () => {
  const fresh = new DatabaseSync(":memory:"), old = new DatabaseSync(":memory:");
  fresh.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  // the ledger table came first, straight from schema.sql (v0.1); then the migrations
  old.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8").split("-- v0.8")[0]);
  old.exec(readFileSync(new URL("../migrations/001_runs.sql", import.meta.url), "utf8"));
  const shape = (d) => d.prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
  assert.deepEqual(shape(old), shape(fresh));
});
