// The ledger: one SHA-256 hash chain, same design as the other games' ledgers (chain helpers copied from aura-farm
// src/ledger.js).
//
//   hash = SHA-256( prev_hash + "|" + record )
//
// A day's entry holds the day and the shared registry's chain head at 00:00 UTC that day (the last registry entry
// before midnight). The entry's hash is the day's beat: the date makes every day differ, the registry head ties it to
// what all the games did, and anyone can recompute it. The first entry chains from GENESIS.

export const GENESIS = "0".repeat(64);

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function head(db) {
  const h = await db.prepare("SELECT hash FROM ledger ORDER BY id DESC LIMIT 1").first();
  return h ? h.hash : GENESIS;
}

// The day's entry hash, sealing it first if it isn't on the chain yet. `day` is "YYYY-MM-DD", `registryHead` is the
// registry's head hash at 00:00 UTC that day.
export async function dayEntry(db, day, registryHead, t) {
  const got = await db.prepare("SELECT hash FROM ledger WHERE kind = 'day' AND day = ?").bind(day).first();
  if (got) return got.hash;
  const record = JSON.stringify({ day, registry: registryHead });
  const prev = await head(db), hash = await sha256(prev + "|" + record);
  await db.prepare("INSERT INTO ledger (kind, day, record, prev_hash, hash, created_at) VALUES ('day', ?, ?, ?, ?, ?)")
    .bind(day, record, prev, hash, t).run();
  return hash;
}

// Check rows (oldest first) form an unbroken chain from GENESIS: { ok: true } or { ok: false, at: id }.
export async function verifyChain(rows) {
  let p = GENESIS;
  for (const r of rows) {
    if (r.prev_hash !== p || (await sha256(p + "|" + r.record)) !== r.hash) return { ok: false, at: r.id };
    p = r.hash;
  }
  return { ok: true };
}
