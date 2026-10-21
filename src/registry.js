// The shared registry's chain head as of 00:00 UTC on a day: the hash of the last registry entry made before midnight.
// Read from the registry's public ledger (88x31.app passes it through from dungeon-items), newest first, 100 at a time.
import { GENESIS } from "./ledger.js";

const LEDGER = "https://88x31.app/api/registry/ledger";

export async function registryHeadAt(day) {
  const cut = Date.parse(day + "T00:00:00Z") / 1000;
  let before = "";
  for (;;) {
    const { entries } = await (await fetch(`${LEDGER}?limit=100${before}`)).json();
    const hit = entries.find((e) => e.at < cut);
    if (hit) return hit.hash;
    if (entries.length < 100) return GENESIS;   // the registry had no entries before midnight
    before = "&before=" + entries[entries.length - 1].id;
  }
}
