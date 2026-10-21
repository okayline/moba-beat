// The day's beat, from the day's ledger hash (the hash of the day's entry, see ledger.js). Pure: the same hash always
// gives the same beat, here and anywhere else. 4 measures of 4 beats = 16 beats.
//
//   bytes 0 to 15  one per beat: its value mod 4 says what that beat is
//                    0 rest (no crit can land on it), 1 or 2 normal, 3 strong (a crit there is worth more)
//                  beat 1 of every measure is never a rest, so each bar has an anchor (a rest there is a normal beat)
//   byte 16        the tempo: BPM_MIN plus its value mod the width of the range
//
// The tempo range and the shares of rest, normal and strong (a quarter, a half, a quarter) are first guesses.

export const BEATS = 16, MEASURE = 4;
export const BPM_MIN = 80, BPM_MAX = 120;
export const REST = "rest", NORMAL = "normal", STRONG = "strong";

export function beat(hash) {
  const bytes = hash.match(/../g).map((h) => parseInt(h, 16));
  const beats = bytes.slice(0, BEATS).map((b, i) => {
    const v = b % 4;
    if (v === 3) return STRONG;
    if (v === 0 && i % MEASURE !== 0) return REST;
    return NORMAL;
  });
  return { bpm: BPM_MIN + (bytes[BEATS] % (BPM_MAX - BPM_MIN + 1)), beats };
}
