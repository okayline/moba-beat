import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { GENESIS, dayEntry, verifyChain } from "../src/ledger.js";

// a tiny D1 lookalike (copied from clutch-feed-tilt test/worker.test.mjs)
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const prep = (sql, args = []) => ({
    sql, args,
    bind: (...a) => prep(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
  });
  return { prepare: (sql) => prep(sql), raw: db };
}
const sha = (t) => createHash("sha256").update(t).digest("hex");

const R1 = "a".repeat(64), R2 = "b".repeat(64);

test("a day's entry is SHA-256(prev + '|' + record), chained from GENESIS, and sealed once", async () => {
  const db = fakeD1();
  const d1 = await dayEntry(db, "2027-01-01", R1, 100);
  assert.equal(d1, sha(GENESIS + "|" + JSON.stringify({ day: "2027-01-01", registry: R1 })));
  assert.equal(await dayEntry(db, "2027-01-01", R2, 200), d1, "the same day is not sealed twice, whatever head is offered");
  const d2 = await dayEntry(db, "2027-01-02", R1, 300);
  assert.equal(d2, sha(d1 + "|" + JSON.stringify({ day: "2027-01-02", registry: R1 })), "the next day chains from the first");
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM ledger").get().n, 2);
});

test("the beat differs every day, even when the registry head is the same", async () => {
  const db = fakeD1();
  assert.notEqual(await dayEntry(db, "2027-01-01", R1, 1), await dayEntry(db, "2027-01-02", R1, 2));
});

test("verifyChain accepts the chain and finds a changed record", async () => {
  const db = fakeD1();
  for (const d of ["2027-01-01", "2027-01-02", "2027-01-03"]) await dayEntry(db, d, R1, 1);
  const rows = () => db.raw.prepare("SELECT id, record, prev_hash, hash FROM ledger ORDER BY id").all();
  assert.deepEqual(await verifyChain(rows()), { ok: true });
  const bad = rows(); bad[1] = { ...bad[1], record: JSON.stringify({ day: "2027-01-02", registry: R2 }) };
  assert.deepEqual(await verifyChain(bad), { ok: false, at: bad[1].id });
});

test("GET /api/ledger lists the chain newest first, with before and limit", async () => {
  const { default: worker } = await import("../src/worker.js");
  const db = fakeD1();
  for (const d of ["2027-01-01", "2027-01-02", "2027-01-03"]) await dayEntry(db, d, R1, 1);
  const get = async (q) => (await (await worker.fetch(new Request("https://x/api/ledger" + q), { DB: db })).json()).entries;
  assert.deepEqual((await get("")).map((e) => e.day), ["2027-01-03", "2027-01-02", "2027-01-01"]);
  assert.deepEqual((await get("?limit=1")).map((e) => e.day), ["2027-01-03"]);
  assert.deepEqual((await get("?before=2")).map((e) => e.day), ["2027-01-01"]);
  assert.equal((await worker.fetch(new Request("https://x/nope"), { DB: db })).status, 404);
});
