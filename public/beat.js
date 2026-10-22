// The day's music, from the day's ledger hash (the hash of the day's entry, see ledger.js). Pure: the same hash always
// gives the same music, here and anywhere else.
//
// Underneath is a fixed metronome: 8 measures of 4 beats (32 beats) at the day's tempo. It is never heard. Over it, a
// short song: drums, a bassline and soft chords. The drums play beats 1, 2 and 3 of every measure and leave beat 4
// silent: beat 4 is the player's. They tap it, their tap plays a clap, and it is scored against the metronome
// (score.js). Nothing new starts on beat 4: chords and bass notes can ring through it, but never begin on it.
//
// THE SHAPE: a drum loop with fills, A A A B | A A A C. Measure A repeats so the ear locks in; B and C are the fills
// that end each 4-measure phrase.
//
//   bytes 0, 1, 2    patterns A, B and C: value mod 108 picks one of 108 patterns (B or C moves to the next pattern
//                    along if it would be the same as A)
//
// A pattern, slot by slot:
//
//   beat 1           always a kick
//   the "and" of 1   nothing, hi-hat or kick
//   beat 2           snare or kick
//   the "and" of 2   nothing, hi-hat or kick
//   beat 3           kick or snare
//   the "and" of 3   nothing, hi-hat or kick
//
// THE HARMONY: a major key and a 4-chord progression played twice, one chord a measure. Each progression ends its first
// half away from home (on V or IV, a half cadence), and measure 8 is always I, so the song ends home.
//
//   byte 3           the key: value mod 12 semitones above C
//   byte 4           the progression (PROGRESSIONS, value mod their number)
//
// The bass follows the chords: its rhythm and which chord notes it plays come from the kit (BASS); the chords are held
// softly under everything for the whole measure.
//
//   bytes 18, 19     as one number, mod the size of the kit's tempo range (TEMPO): the tempo above its low end
//                    (hip-hop 80 to 100, electro always 128, trap 70 to 85: its snare is on beat 3, so it feels half as fast)
//   byte 20          the day's kit (STYLES, value mod 3): hip-hop, electro or trap
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
export const TEMPO = { "hip-hop": [80, 100], electro: [128, 128], trap: [70, 85] };   // each kit's tempo range, BPM
export const CLAPS = Array.from({ length: MEASURES }, (_, m) => m * MEASURE + 3);   // beat 4 of each measure (0-based)
export const STYLES = ["hip-hop", "electro", "trap"];
export const WAIT = 2;                                    // beats from a wind-up's cue to where it lands
export const SHAPE = ["A", "A", "A", "B", "A", "A", "A", "C"];

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
const TRIAD = { maj: [0, 4, 7], min: [0, 3, 7] };

// The bass for each kit: [beat, which note] for one measure, where the note is "root", or "fifth" of the
// measure's chord. No note starts on beat 4 (beat 3.0); the last one rings through it into the next measure.
export const BASS = {
  "hip-hop": [[0, "root"], [1.5, "root"], [2.5, "fifth"]],                                   // laid back
  electro: [[0, "root"], [0.75, "root"], [1.5, "root"], [2.25, "fifth"], [2.5, "root"]],    // tight and repeated
  trap: [[0, "root"], [1.75, "root"], [2.5, "fifth"]],                                         // long, low and sparse
};
const BASS_NOTE = { root: 0, fifth: 7 };
export const BASS_LOW = 36, PAD_LOW = 60;                 // C2 and C4, as MIDI note numbers

export function beat(hash) {
  const bytes = hash.match(/../g).map((h) => parseInt(h, 16));

  // drums: A A A B | A A A C
  const a = bytes[0] % PATTERNS;
  const other = (v) => (v % PATTERNS === a ? (a + 1) % PATTERNS : v % PATTERNS);
  const pick = { A: a, B: other(bytes[1]), C: other(bytes[2]) };
  const hits = [];
  SHAPE.forEach((x, m) => { for (const [at, drum] of pattern(pick[x])) hits.push({ at: m * MEASURE + at, drum }); });

  // harmony: the progression twice, measure 8 home on I
  const key = bytes[3] % 12, prog = PROGRESSIONS[bytes[4] % PROGRESSIONS.length];
  const chords = [...prog, ...prog.slice(0, 3), I].map(([deg, q]) => ({ root: (key + deg) % 12, quality: q }));
  const style = STYLES[bytes[20] % STYLES.length];
  const pad = chords.map((c, m) => ({ at: m * MEASURE, dur: MEASURE, midi: TRIAD[c.quality].map((s) => PAD_LOW + c.root + s) }));
  const bass = [];
  chords.forEach((c, m) => {
    for (const [at, n] of BASS[style]) bass.push({ at: m * MEASURE + at, midi: BASS_LOW + c.root + BASS_NOTE[n] });
  });
  bass.forEach((b, i) => { b.dur = (i + 1 < bass.length ? bass[i + 1].at : BEATS) - b.at; });

  // wind-ups and targets
  let windups = Array.from({ length: MEASURES }, (_, m) => m).filter((m) => m > 0 && (bytes[10] >> m) & 1);
  if (!windups.length) windups = [MEASURES - 1];
  const cues = windups.map((m) => ({ at: m * MEASURE, lands: m * MEASURE + WAIT, unit: bytes[21 + m] % 3 }));
  const targets = [...CLAPS.map((at) => ({ at, kind: "clap" })), ...cues.map((c) => ({ at: c.lands, kind: "parry" }))]
    .sort((x, y) => x.at - y.at);

  const [lo, hi] = TEMPO[style];
  const bpm = lo + (((bytes[18] << 8) | bytes[19]) % (hi - lo + 1));
  return { measures: MEASURES, bpm, style, key, chords, hits, bass, pad, cues, targets };
}
