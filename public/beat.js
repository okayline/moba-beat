// The day's music, from the day's ledger hash (the hash of the day's entry, see ledger.js). Pure: the same hash always
// gives the same music, here and anywhere else.
//
// Underneath is a fixed metronome: 8 measures of 4 beats (32 beats) at the day's tempo. It is never heard. Over it, a
// short song: the drums. The drums play beats 1, 2 and 3 of every measure and leave beat 4
// silent: beat 4 is the player's. They tap it, their tap plays the kit's sound for it (TAP), and it is scored against the metronome
// (score.js). Nothing starts on beat 4.
//
// THE SHAPE: a drum loop with fills, A A A B | A A A C. Measure A repeats so the ear locks in; B and C are the fills
// that end each 4-measure phrase.
//
//   bytes 0, 1, 2    patterns A, B and C: the whole byte (0 to 255) is the pattern's number (B or C moves to the next
//                    number if it would be the same as A)
//
// Each kit is a rule (an algorithm): some hits are always there (they make the style), and the pattern number's bits
// each switch on one more hit from the places that style puts them. 8 bits make 256 patterns per kit: boomBap, house,
// bounce and techHouse below.
//
// THE FILLS: B and C each add a lead-in across beats 2 and 3 to beat 4 on top of the kit's groove, so they sound like the end of a
// phrase. B (measure 4, ends the first half) is small and C (measure 8, ends the loop) is bigger. The figure comes from
// bytes 1 and 2 (value mod 8, FILLS); a hit the groove already has is not played twice. Everything stays before beat 4.
//
//   byte 1           which of the 3 small lead-ins B gets
//   byte 2           which of the 3 bigger lead-ins C gets
//
// THE HARMONY: a major key and a 4-chord progression played twice, one chord a measure. Each progression ends its first
// half away from home (on V or IV, a half cadence), and measure 8 is always I, so the song ends home.
//
//   byte 3           the key: value mod 12 semitones above C
//   byte 4           the progression (PROGRESSIONS, value mod their number)
//
// The chords are not played (the pad was taken out); they are kept as the day's record, shown on the ledger page.
//
//   bytes 18, 19     as one number, mod the size of the kit's tempo range (TEMPO): the tempo above its low end
//                    (hip-hop 80 to 100, house always 128, bounce 90 to 100, tech-house always 128)
//   bytes 5 to 9     which recording of each drum the kit plays today (kick, snare, clap, hat, open: VOICE_BYTE, value mod
//                    how many the kit has, VOICES)
//   byte 20          the day's kit (STYLES, value mod 4): hip-hop, house, bounce or tech-house
//
// ENEMY WIND-UPS (cue, then wait): in any measure but the first, an enemy may wind up on beat 1 with a cue sound; the
// attack lands WAIT beats later, on beat 3, and the player taps right then to parry it.
//
//   byte 10          bit m set means a wind-up in measure m + 1 (bit 0 is ignored; if no bit is set, the last
//                    measure gets one)
//   bytes 21 to 28   which of the 3 ghost units winds up in measure m + 1: byte 21 + m, value mod 3
//
// TARGETS is every tap the player should make, in order: a clap on beat 4 of every measure, and a parry where each
// wind-up lands.

export const MEASURES = 8, MEASURE = 4, BEATS = MEASURES * MEASURE;
export const TEMPO = { "hip-hop": [80, 100], house: [128, 128], bounce: [90, 100], "tech-house": [128, 128] };   // each kit's tempo range, BPM
export const CLAPS = Array.from({ length: MEASURES }, (_, m) => m * MEASURE + 3);   // beat 4 of each measure (0-based)
export const STYLES = ["hip-hop", "house", "bounce", "tech-house"];
export const TAP = { "hip-hop": "snare", house: "kick", bounce: "clap", "tech-house": "kick" };   // what the player's tap on beat 4 plays: the backbeat's 4, the fourth kick, a clap
export const KIT_DRUMS = { "hip-hop": ["kick", "snare", "hat"], house: ["kick", "snare", "hat"], bounce: ["kick", "clap", "hat", "open"], "tech-house": ["kick", "clap", "hat", "open"] };   // the samples each kit loads
export const VOICES = { "hip-hop": { kick: 3, snare: 3, hat: 1 }, house: { kick: 1, snare: 3, hat: 1 }, bounce: { kick: 3, clap: 1, hat: 1, open: 1 }, "tech-house": { kick: 3, clap: 1, hat: 1, open: 1 } };   // how many recordings each kit has of each drum (samples/<kit>/<drum>-<n>.wav, n from 1)
export const VOICE_BYTE = { kick: 5, snare: 6, clap: 7, hat: 8, open: 9 };   // the byte that picks the day's recording of each drum
export const HAT_RATE = { "hip-hop": 1, house: 1.2, bounce: 0.9, "tech-house": 1.1 };   // the hats of three packs are the same recording, so each kit plays it at its own pitch
export const WAIT = 2;                                    // beats from a wind-up's cue to where it lands
export const SHAPE = ["A", "A", "A", "B", "A", "A", "A", "C"];


// Chords as scale degrees of the major key: [semitones above the key, quality]. Each list is one 4-measure half.
const I = [0, "maj"], ii = [2, "min"], iii = [4, "min"], IV = [5, "maj"], V = [7, "maj"], vi = [9, "min"];
export const PROGRESSIONS = [
  [I, V, vi, IV],     // the pop progression
  [I, vi, IV, V],     // the fifties progression
  [vi, IV, I, V],     // the same four, starting sad
  [I, IV, vi, V],
  [ii, V, I, IV],     // jazzy: two-five-one
  [I, iii, IV, V],
];

// The lead-ins, as [beat, drum] with acc = the kit's backbeat drum (snare or clap). Beats are 0 to 2.75: a lead-in ends on
// the "a" of 3 and never reaches beat 4.
const ACC = { "hip-hop": "snare", house: "snare", bounce: "clap", "tech-house": "clap" };
export const FILLS = (acc) => ({
  B: [
    [[2, acc], [2.5, acc], [2.75, acc]],
    [[2.25, "kick"], [2.5, "kick"], [2.75, acc]],
    [[2, "hat"], [2.25, "hat"], [2.5, "hat"], [2.75, acc]],
    [[2.25, acc], [2.5, acc], [2.75, acc]],
    [[1.75, "kick"], [2.5, acc], [2.75, acc]],
    [[2, acc], [2.25, "kick"], [2.75, acc]],
    [[2.25, "hat"], [2.5, acc], [2.75, "hat"]],
    [[1.5, acc], [2.5, "kick"], [2.75, acc]],
  ],
  C: [
    [[1.5, acc], [1.75, acc], [2, acc], [2.25, acc], [2.5, acc], [2.75, acc]],
    [[1.75, "kick"], [2, acc], [2.25, "kick"], [2.5, acc], [2.75, acc]],
    [[1.5, "kick"], [2, acc], [2.25, acc], [2.5, "kick"], [2.75, acc]],
    [[1.25, acc], [1.5, acc], [2, acc], [2.5, acc], [2.75, acc]],
    [[1.5, acc], [1.75, acc], [2, "kick"], [2.25, "kick"], [2.5, acc], [2.75, acc]],
    [[1.5, "hat"], [1.75, "hat"], [2, acc], [2.25, acc], [2.5, acc], [2.75, acc]],
    [[1.5, "kick"], [1.75, "kick"], [2, acc], [2.25, "hat"], [2.5, acc], [2.75, acc]],
    [[1.25, "kick"], [1.75, acc], [2, "kick"], [2.25, acc], [2.5, acc], [2.75, acc]],
  ],
});

// Small changes inside the repeated A measures (measures 2, 3, 6 and 7, from bytes 12, 13, 16, 17, value mod 4), so A
// is never played exactly the same twice in a row: an extra kick, or extra hi-hats.
export const SPICE = [[[1.75, "kick"]], [[0.75, "kick"]], [[2.25, "hat"], [2.75, "hat"]], [[0.25, "hat"], [1.25, "hat"]]];
// The second half (measures 5 to 8) lifts: hi-hats on the "a" of 1 and the "a" of 2.
export const LIFT = [[0.75, "hat"], [1.75, "hat"]];

// House drums: a kick on every beat the drums play (1, 2, 3), a snare on beat 2 and hats on every off-beat; the
// pattern's bits add sixteenth-note hats (the "e" and "a" of 1, 2 and 3, 6 bits) and one extra kick (none, the "a" of 1,
// the "and" of 3 or the "a" of 3, 2 bits).
const HOUSE_HATS = [0.25, 0.75, 1.25, 1.75, 2.25, 2.75], HOUSE_KICK = [null, 0.75, 2.5, 2.75];
function house(pick) {
  const hits = [];
  SHAPE.forEach((x, m) => {
    const n = pick[x];
    for (const at of [0.5, 1.5, 2.5, ...HOUSE_HATS.filter((_, i) => (n >> i) & 1)]) hits.push({ at: m * MEASURE + at, drum: "hat" });
    for (const at of [0, 1, 2]) hits.push({ at: m * MEASURE + at, drum: "kick" });
    if (HOUSE_KICK[n >> 6]) hits.push({ at: m * MEASURE + HOUSE_KICK[n >> 6], drum: "kick" });
    hits.push({ at: m * MEASURE + 1, drum: "snare" });
  });
  return hits.sort((x, y) => x.at - y.at);
}

// Hip-hop's drums are boom bap: a snare on beat 2 (your tap is the one on 4), closed hats on every eighth note, a kick on
// beat 1, and the day's other kicks chosen from the 8 places boom bap puts them: the "e", "and" and "a" of 1, the "and"
// and "a" of 2, beat 3, the "and" and "a" of 3. Each pattern (A, B, C) is one set of those 8, a bit each; a pattern with
// fewer than 2 gets the "and" of 2 and beat 3, the classic ones.
const KICKS = [0.25, 0.5, 0.75, 1.5, 1.75, 2, 2.5, 2.75];
function boomBap(pick) {
  const hits = [];
  SHAPE.forEach((x, m) => {
    let bits = pick[x];
    if (KICKS.filter((_, i) => (bits >> i) & 1).length < 2) bits |= 0b101000;
    for (const at of [0, 0.5, 1, 1.5, 2, 2.5]) hits.push({ at: m * MEASURE + at, drum: "hat" });
    for (const at of [0, ...KICKS.filter((_, i) => (bits >> i) & 1)]) hits.push({ at: m * MEASURE + at, drum: "kick" });
    hits.push({ at: m * MEASURE + 1, drum: "snare" });
  });
  return hits.sort((x, y) => x.at - y.at);
}

// Bounce's drums, West Coast style (Mustard's): a clap on beat 2 (your tap is the clap on 4), a kick on beat 1 and on the
// "and" of 3, closed hats on every eighth note, and the day's extra bits: 6 bits pick extra kicks (the "e" and "a" of 1,
// the "and" and "a" of 2, the "e" and "a" of 3) and 2 bits which off-beat hat is open (none, the "and" of 1, 2 or 3).
const EXTRA_KICKS = [0.25, 0.75, 1.5, 1.75, 2.25, 2.75], OPEN_AT = [null, 0.5, 1.5, 2.5];
function bounce(pick) {
  const hits = [];
  SHAPE.forEach((x, m) => {
    const n = pick[x], open = OPEN_AT[n >> 6];
    for (const at of [0, 0.5, 1, 1.5, 2, 2.5]) hits.push({ at: m * MEASURE + at, drum: at === open ? "open" : "hat" });
    for (const at of [0, 2.5, ...EXTRA_KICKS.filter((_, i) => (n >> i) & 1)]) hits.push({ at: m * MEASURE + at, drum: "kick" });
    hits.push({ at: m * MEASURE + 1, drum: "clap" });
  });
  return hits.sort((x, y) => x.at - y.at);
}

// Tech house's drums: a kick on every beat the drums play, a clap on beat 2 (your tap is the kick on 4), closed hats on
// the off-beats, and the day's extras: 6 bits pick syncopated hats (the "e" and "a" of 1, 2 and 3) and 2 bits which
// off-beat has an open hat under it (none, the "and" of 1, 2 or 3).
const SYNC_HATS = [0.25, 0.75, 1.25, 1.75, 2.25, 2.75];
function techHouse(pick) {
  const hits = [];
  SHAPE.forEach((x, m) => {
    const n = pick[x];
    for (const at of [0.5, 1.5, 2.5, ...SYNC_HATS.filter((_, i) => (n >> i) & 1)]) hits.push({ at: m * MEASURE + at, drum: "hat" });
    if (OPEN_AT[n >> 6]) hits.push({ at: m * MEASURE + OPEN_AT[n >> 6], drum: "open" });
    for (const at of [0, 1, 2]) hits.push({ at: m * MEASURE + at, drum: "kick" });
    hits.push({ at: m * MEASURE + 1, drum: "clap" });
  });
  return hits.sort((x, y) => x.at - y.at);
}

export function beat(hash) {
  const bytes = hash.match(/../g).map((h) => parseInt(h, 16));

  // drums: A A A B | A A A C
  const a = bytes[0];
  const other = (v) => (v === a ? (a + 1) % 256 : v);
  const pick = { A: a, B: other(bytes[1]), C: other(bytes[2]) };
  const style = STYLES[bytes[20] % STYLES.length];
  const hits = { "hip-hop": boomBap, house, bounce, "tech-house": techHouse }[style](pick);
  const add = (m, at, drum) => { if (!hits.some((h) => h.at === m * MEASURE + at && h.drum === drum)) hits.push({ at: m * MEASURE + at, drum }); };
  for (const m of [1, 2, 5, 6]) for (const [at, drum] of SPICE[bytes[11 + m] % SPICE.length]) add(m, at, drum);
  for (let m = 4; m < MEASURES; m++) for (const [at, drum] of LIFT) add(m, at, drum);
  const fills = FILLS(ACC[style]);
  SHAPE.forEach((x, m) => {
    if (x === "A") return;
    const set = fills[x], byte = x === "B" ? bytes[1] : bytes[2];
    for (const [at, drum] of set[byte % set.length]) add(m, at, drum);
  });
  hits.sort((x, y) => x.at - y.at);

  // harmony: the progression twice, measure 8 home on I
  const key = bytes[3] % 12, prog = PROGRESSIONS[bytes[4] % PROGRESSIONS.length];
  const chords = [...prog, ...prog.slice(0, 3), I].map(([deg, q]) => ({ root: (key + deg) % 12, quality: q }));

  // wind-ups and targets
  let windups = Array.from({ length: MEASURES }, (_, m) => m).filter((m) => m > 0 && (bytes[10] >> m) & 1);
  if (!windups.length) windups = [MEASURES - 1];
  const cues = windups.map((m) => ({ at: m * MEASURE, lands: m * MEASURE + WAIT, unit: bytes[21 + m] % 3 }));
  const targets = [...CLAPS.map((at) => ({ at, kind: "clap" })), ...cues.map((c) => ({ at: c.lands, kind: "parry" }))]
    .sort((x, y) => x.at - y.at);

  const [lo, hi] = TEMPO[style];
  const bpm = lo + (((bytes[18] << 8) | bytes[19]) % (hi - lo + 1));
  const voice = Object.fromEntries(KIT_DRUMS[style].map((d) => [d, bytes[VOICE_BYTE[d]] % VOICES[style][d]]));
  return { measures: MEASURES, bpm, style, voice, key, chords, hits, cues, targets };
}
