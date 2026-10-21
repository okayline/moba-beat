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

// The day's entry: { hash, sealed }, sealing it first if it isn't on the chain yet (sealed is true only then).
// `day` is "YYYY-MM-DD", `getRegistryHead` is an async function giving the registry's head hash at 00:00 UTC that day,
// called only when the day is sealed.
export async function dayEntry(db, day, getRegistryHead, t) {
  const got = await db.prepare("SELECT hash FROM ledger WHERE kind = 'day' AND day = ?").bind(day).first();
  if (got) return { hash: got.hash, sealed: false };
  const record = JSON.stringify({ day, registry: await getRegistryHead() });
  const prev = await head(db), hash = await sha256(prev + "|" + record);
  await db.prepare("INSERT INTO ledger (kind, day, record, prev_hash, hash, created_at) VALUES ('day', ?, ?, ?, ?, ?)")
    .bind(day, record, prev, hash, t).run();
  return { hash, sealed: true };
}

// The insert for a run's entry, chained from `prev`, for the same D1 batch as the run's row.
export async function runInsert(db, prev, { day, record, t }) {
  const hash = await sha256(prev + "|" + record);
  return { hash, stmt: db.prepare("INSERT INTO ledger (kind, day, record, prev_hash, hash, created_at) VALUES ('run', ?, ?, ?, ?, ?)").bind(day, record, prev, hash, t) };
}
