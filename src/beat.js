// The day's drumbeat, from the day's ledger hash (the hash of the day's entry, see ledger.js). Pure: the same hash
// always gives the same beat, here and anywhere else.
//
// Underneath is a fixed metronome: 8 measures of 4 beats (32 beats) at the day's tempo. It is never heard. Over it,
// a drum pattern that plays beats 1, 2 and 3 of every measure and leaves beat 4 silent: beat 4 is the player's. They
// tap it, their tap plays a clap, and it is scored by how close it is to the metronome (score.js).
// Every measure has its own pattern, from one byte each (bytes 0 to 7): the value mod 108 picks one of 108 patterns,
// built slot by slot:
//
//   beat 1           always a kick
//   the "and" of 1   nothing, hi-hat or kick
//   beat 2           snare or kick
//   the "and" of 2   nothing, hi-hat or kick
//   beat 3           kick or snare
//   the "and" of 3   nothing, hi-hat or kick
//
// (3 x 2 x 3 x 2 x 3 = 108). Two measures can come out the same by chance (1 in 108 for any pair).
//
//   bytes 18, 19   as one number, mod 61: the tempo above BPM_MIN (70 to 130 BPM)
//   byte 20        the day's sound (STYLES, value mod 3): the same pattern, played on a hip-hop, electro or disco kit
//
// Enemy wind-ups (cue, then wait): in any measure but the first, an enemy may wind up on beat 1 with a cue sound; the
// attack lands WAIT beats later, on beat 3, and the player taps right then to parry it. Measure 1 never has one, so the
// 1-2-3-clap is heard first.
//
//   byte 10          bit m set means a wind-up in measure m + 1 (bit 0 is ignored; if no bit is set, the last
//                    measure gets one)
//   bytes 21 to 28   which of the 3 ghost units winds up in measure m + 1: byte 21 + m, value mod 3
//
// TARGETS is every tap the player should make, in order: a clap on beat 4 of every measure, and a parry where each
// wind-up lands.

export const MEASURES = 8, MEASURE = 4, BEATS = MEASURES * MEASURE;
export const BPM_MIN = 70, BPM_MAX = 130;
export const CLAPS = Array.from({ length: MEASURES }, (_, m) => m * MEASURE + 3);   // beat 4 of each measure (0-based)
export const STYLES = ["hip-hop", "electro", "disco"];
export const WAIT = 2;                                    // beats from a wind-up's cue to where it lands

const OFF = [null, "hat", "kick"];

// Pattern n (0 to 107): [[beat, drum], ...], beats 0 to 2.5; nothing on beat 4. n is read as digits, from the "and"
// of 1 to the "and" of 3: base 3, 2, 3, 2, 3.
export const PATTERNS = 3 * 2 * 3 * 2 * 3;
export function pattern(n) {
  const d = [];
  for (const base of [3, 2, 3, 2, 3]) { d.push(n % base); n = Math.floor(n / base); }
  const p = [[0, "kick"], [0.5, OFF[d[0]]], [1, ["snare", "kick"][d[1]]], [1.5, OFF[d[2]]],
    [2, ["kick", "snare"][d[3]]], [2.5, OFF[d[4]]]];
  return p.filter(([, drum]) => drum);
}

export function beat(hash) {
  const bytes = hash.match(/../g).map((h) => parseInt(h, 16));
  const hits = [];
  for (let m = 0; m < MEASURES; m++) for (const [at, drum] of pattern(bytes[m] % PATTERNS)) hits.push({ at: m * MEASURE + at, drum });
  let windups = Array.from({ length: MEASURES }, (_, m) => m).filter((m) => m > 0 && (bytes[10] >> m) & 1);
  if (!windups.length) windups = [MEASURES - 1];
  const cues = windups.map((m) => ({ at: m * MEASURE, lands: m * MEASURE + WAIT, unit: bytes[21 + m] % 3 }));
  const targets = [...CLAPS.map((at) => ({ at, kind: "clap" })), ...cues.map((c) => ({ at: c.lands, kind: "parry" }))]
    .sort((x, y) => x.at - y.at);
  const bpm = BPM_MIN + (((bytes[18] << 8) | bytes[19]) % (BPM_MAX - BPM_MIN + 1));
  return { measures: MEASURES, bpm, style: STYLES[bytes[20] % STYLES.length], hits, cues, targets };
}
