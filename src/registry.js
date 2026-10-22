// The shared registry's chain head as of 00:00 UTC on a day: the hash of the last registry entry made before midnight.
// Read from the registry's public ledger (88x31.app passes it through from dungeon-items), newest first, 100 at a time.
// A ledger that's away or slow (5 s a page) throws, so the day isn't sealed and the next request tries again.
import { GENESIS } from "./ledger.js";

const LEDGER = "https://88x31.app/api/registry/ledger";

export async function registryHeadAt(day) {
  const cut = Date.parse(day + "T00:00:00Z") / 1000;
  let before = "";
  for (;;) {
    const r = await fetch(`${LEDGER}?limit=100${before}`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error("The registry's ledger answered " + r.status);
    const { entries } = await r.json();
    const hit = entries.find((e) => e.at < cut);
    if (hit) return hit.hash;
    if (entries.length < 100) return GENESIS;   // the registry had no entries before midnight
    before = "&before=" + entries[entries.length - 1].id;
  }
}
