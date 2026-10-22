// The ledger: one SHA-256 hash chain, same design as the other games' ledgers (chain helpers copied from aura-farm
// src/ledger.js; the hash and the check are in public/chain.js so the ledger page uses the same code).
//
//   hash = SHA-256( prev_hash + "|" + record )
//
// Two kinds of entry:
//   day   { day, registry }: the day and the shared registry's chain head at 00:00 UTC that day. Its hash is the
//         day's music (public/beat.js). Sealed by the first request of the day.
//   run   { day, player, taps, perfect, good, miss }: a player's first finished run of the day: their tap times in ms
//         from the song's first beat, and the score the server worked out from them. Players are ids, never names.
//
// The first entry chains from GENESIS. Changing any old record breaks its hash and every hash after it. prev_hash is
// UNIQUE, so the chain can't fork.

import { GENESIS, sha256, verifyChain } from "../public/chain.js";
export { GENESIS, sha256, verifyChain };

export async function head(db) {
  const h = await db.prepare("SELECT hash FROM ledger ORDER BY id DESC LIMIT 1").first();
  return h ? h.hash : GENESIS;
}

// Two requests can read the same head at once; prev_hash UNIQUE lets only one of them build on it. The other one is
// sealed again on the new head (seal's retry is copied from dawn-baton src/ledger.js).
const chainClash = (e) => /UNIQUE/i.test(String(e && e.message)) && /ledger\.(prev_)?hash/.test(String(e.message));
const anyUnique = (e) => /UNIQUE/i.test(String(e && e.message));

// Seal on the current head. `build(prev)` gives { hash, stmts }: the ledger insert chained from prev and anything to
// go in the same D1 batch. Returns { hash }, or { duplicate: true } if another unique index says it's already there
// (that day's entry, that player's run that day).
export async function seal(db, build) {
  for (let i = 0; i < 8; i++) {
    const { hash, stmts } = await build(await head(db));
    try { await db.batch(stmts); return { hash }; }
    catch (e) {
      if (chainClash(e)) continue;
      if (anyUnique(e)) return { duplicate: true };
      throw e;
    }
  }
  throw new Error("The ledger is busy. Try again.");
}

// The day's entry: { hash, sealed }, sealing it first if it isn't on the chain yet (sealed is true only then).
// `day` is "YYYY-MM-DD", `getRegistryHead` is an async function giving the registry's head hash at 00:00 UTC that day,
// called only when the day is sealed.
const dayHash = (db, day) => db.prepare("SELECT hash FROM ledger WHERE kind = 'day' AND day = ?").bind(day).first();
export async function dayEntry(db, day, getRegistryHead, t) {
  const got = await dayHash(db, day);
  if (got) return { hash: got.hash, sealed: false };
  const record = JSON.stringify({ day, registry: await getRegistryHead() });
  const r = await seal(db, async (prev) => {
    const hash = await sha256(prev + "|" + record);
    return { hash, stmts: [db.prepare("INSERT INTO ledger (kind, day, record, prev_hash, hash, created_at) VALUES ('day', ?, ?, ?, ?, ?)")
      .bind(day, record, prev, hash, t)] };
  });
  if (r.duplicate) return { hash: (await dayHash(db, day)).hash, sealed: false };   // another request sealed the day first
  return { hash: r.hash, sealed: true };
}

// The insert for a run's entry, chained from `prev`, for the same D1 batch as the run's row.
export async function runInsert(db, prev, { day, record, t }) {
  const hash = await sha256(prev + "|" + record);
  return { hash, stmt: db.prepare("INSERT INTO ledger (kind, day, record, prev_hash, hash, created_at) VALUES ('run', ?, ?, ?, ?, ?)").bind(day, record, prev, hash, t) };
}
