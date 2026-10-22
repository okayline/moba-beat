// The day's music, from the day's ledger hash (the hash of the day's entry, see ledger.js). Pure: the same hash always
// gives the same music, here and anywhere else.
//
// Underneath is a fixed metronome: 8 measures of 4 beats (32 beats) at the day's tempo. It is never heard. Over it, a
// short song: drums and soft chords. The drums play beats 1, 2 and 3 of every measure and leave beat 4
// silent: beat 4 is the player's. They tap it, their tap plays the kit's sound for it (TAP), and it is scored against the metronome
// (score.js). Nothing new starts on beat 4: the chords can ring through it, but never begin on it.
//
// THE SHAPE: a drum loop with fills, A A A B | A A A C. Measure A repeats so the ear locks in; B and C are the fills
// that end each 4-measure phrase.
//
//   bytes 0, 1, 2    patterns A, B and C: value mod 108 picks one of 108 patterns (B or C moves to the next pattern
//                    along if it would be the same as A)
//
// (No kit plays the patterns below as they are: hip-hop is boom bap (boomBap), house has a kick on every beat and a
// snare on beat 2 (fourOnTheFloor), bounce is West Coast bounce (bounce) and tech-house is tech house (techHouse). Each
// starts from the day's patterns.)
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
// The chords are held softly under everything for the whole measure, from measure 2: measure 1 is the drums alone. Measure 7 is always V and measure 8 always I, so
// the song ends on V to I.
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
export const KIT_DRUMS = { "hip-hop": ["kick", "snare", "hat"], house: ["snare", "hat"], bounce: ["kick", "clap", "hat", "open"], "tech-house": ["kick", "clap", "hat", "open"] };   // the samples each kit loads
export const VOICES = { "hip-hop": { kick: 3, snare: 3, hat: 1 }, house: { snare: 3, hat: 1 }, bounce: { kick: 3, clap: 1, hat: 1, open: 1 }, "tech-house": { kick: 3, clap: 1, hat: 1, open: 1 } };   // how many recordings each kit has of each drum (samples/<kit>/<drum>-<n>.wav, n from 1)
export const VOICE_BYTE = { kick: 5, snare: 6, clap: 7, hat: 8, open: 9 };   // the byte that picks the day's recording of each drum
export const HAT_RATE = { "hip-hop": 1, house: 1.2, bounce: 0.9, "tech-house": 1.1 };   // the hats of three packs are the same recording, so each kit plays it at its own pitch
export const THUMP_KITS = ["house"];                      // kits whose kick is a made thump (a low sine that drops), not a sample
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

// How each kit plays the chords, so the pad is not the same tone in every song: the wave, the lowpass cutoff (Hz), the
// swell-in time (seconds), the volume, the detune of its two voices (cents), how much of the measure it holds (0 to 1)
// and a shift in semitones.
export const PADS = {
  "hip-hop": { type: "triangle", cutoff: 900, attack: 0.25, vol: 0.04, detune: 6, hold: 1, shift: 0 },
  house: { type: "sawtooth", cutoff: 2600, attack: 0.03, vol: 0.016, detune: 14, hold: 1, shift: 0 },
  bounce: { type: "square", cutoff: 1300, attack: 0.01, vol: 0.014, detune: 4, hold: 0.45, shift: 12 },
  "tech-house": { type: "sawtooth", cutoff: 600, attack: 0.5, vol: 0.022, detune: 10, hold: 1, shift: -12 },
};

export const PAD_LOW = 60;                                // C4, as a MIDI note number

// House drums: a kick on every beat the drums play (1, 2, 3) and a snare on beat 2, with the day's pattern's off-beat
// hi-hats. Beat 4 stays the player's, so there is no snare there.
function fourOnTheFloor(hits) {
  const on = hits.filter((h) => h.at % 1 !== 0 && h.drum === "hat");   // the pattern's off-beat hats (not its off-beat kicks, which doubled the kick)
  for (let m = 0; m < MEASURES; m++) {
    for (const b of [0, 1, 2]) on.push({ at: m * MEASURE + b, drum: "kick" });
    on.push({ at: m * MEASURE + 1, drum: "snare" });
  }
  return on.sort((x, y) => x.at - y.at);
}

// Hip-hop's drums are boom bap: a snare on beat 2 (your tap is the one on 4), closed hats on every eighth note, a kick on
// beat 1, and the day's other kicks chosen from the places boom bap puts them: the "a" of 1, the "and" of 2, beat 3,
// the "and" of 3 and the "a" of 3. Each of the day's patterns (A, B, C; value mod 32) is one set of those 5, a bit
// each; a pattern with fewer than 2 gets the "and" of 2 and beat 3, the classic ones.
const KICKS = [0.75, 1.5, 2, 2.5, 2.75];
function boomBap(pick) {
  const hits = [];
  SHAPE.forEach((x, m) => {
    let bits = pick[x] % 32;
    if (KICKS.filter((_, i) => (bits >> i) & 1).length < 2) bits |= 0b00110;
    for (const at of [0, 0.5, 1, 1.5, 2, 2.5]) hits.push({ at: m * MEASURE + at, drum: "hat" });
    for (const at of [0, ...KICKS.filter((_, i) => (bits >> i) & 1)]) hits.push({ at: m * MEASURE + at, drum: "kick" });
    hits.push({ at: m * MEASURE + 1, drum: "snare" });
  });
  return hits.sort((x, y) => x.at - y.at);
}

// Bounce's drums, West Coast style (Mustard's): a clap on beat 2 (your tap is the clap on 4), a kick on beat 1 and on the
// "and" of 3, closed hats on every eighth note, and the day's extra bits: each pattern (A, B, C; value mod 32) picks
// which of 3 extra kicks play (the "a" of 1, the "a" of 2, the "a" of 3) and which off-beat hat is open (none, or the
// "and" of 1, 2 or 3).
const EXTRA_KICKS = [0.75, 1.75, 2.75], OPEN_AT = [null, 0.5, 1.5, 2.5];
function bounce(pick) {
  const hits = [];
  SHAPE.forEach((x, m) => {
    const n = pick[x] % 32, open = OPEN_AT[n >> 3];
    for (const at of [0, 0.5, 1, 1.5, 2, 2.5]) hits.push({ at: m * MEASURE + at, drum: at === open ? "open" : "hat" });
    for (const at of [0, 2.5, ...EXTRA_KICKS.filter((_, i) => (n >> i) & 1)]) hits.push({ at: m * MEASURE + at, drum: "kick" });
    hits.push({ at: m * MEASURE + 1, drum: "clap" });
  });
  return hits.sort((x, y) => x.at - y.at);
}

// Tech house's drums: a kick on every beat the drums play, a clap on beat 2 (your tap is the kick on 4), closed hats only on
// the off-beats (between the kick and the clap), and the day's extras: each pattern (A, B, C; value mod 32) picks
// whether a syncopated hat plays on the "a" of 2 and the "a" of 3, and which off-beat has an open hat under it (none, or
// the "and" of 1, 2 or 3).
const SYNC_HATS = [1.75, 2.75];
function techHouse(pick) {
  const hits = [];
  SHAPE.forEach((x, m) => {
    const n = pick[x] % 32;
    for (const at of [0.5, 1.5, 2.5, ...SYNC_HATS.filter((_, i) => (n >> i) & 1)]) hits.push({ at: m * MEASURE + at, drum: "hat" });
    if (OPEN_AT[n >> 3]) hits.push({ at: m * MEASURE + OPEN_AT[n >> 3], drum: "open" });
    for (const at of [0, 1, 2]) hits.push({ at: m * MEASURE + at, drum: "kick" });
    hits.push({ at: m * MEASURE + 1, drum: "clap" });
  });
  return hits.sort((x, y) => x.at - y.at);
}

export function beat(hash) {
  const bytes = hash.match(/../g).map((h) => parseInt(h, 16));

  // drums: A A A B | A A A C
  const a = bytes[0] % PATTERNS;
  const other = (v) => (v % PATTERNS === a ? (a + 1) % PATTERNS : v % PATTERNS);
  const pick = { A: a, B: other(bytes[1]), C: other(bytes[2]) };
  const style = STYLES[bytes[20] % STYLES.length];
  let hits = [];
  SHAPE.forEach((x, m) => { for (const [at, drum] of pattern(pick[x])) hits.push({ at: m * MEASURE + at, drum }); });
  if (style === "house") hits = fourOnTheFloor(hits);
  if (style === "hip-hop") hits = boomBap(pick);
  if (style === "bounce") hits = bounce(pick);
  if (style === "tech-house") hits = techHouse(pick);

  // harmony: the progression twice, measure 8 home on I
  const key = bytes[3] % 12, prog = PROGRESSIONS[bytes[4] % PROGRESSIONS.length];
  const chords = [...prog, ...prog.slice(0, 2), V, I].map(([deg, q]) => ({ root: (key + deg) % 12, quality: q }));
  const pad = chords.map((c, m) => ({ at: m * MEASURE, dur: MEASURE, midi: TRIAD[c.quality].map((s) => PAD_LOW + c.root + s) })).slice(1);   // from measure 2: the song opens on the drums alone

  // wind-ups and targets
  let windups = Array.from({ length: MEASURES }, (_, m) => m).filter((m) => m > 0 && (bytes[10] >> m) & 1);
  if (!windups.length) windups = [MEASURES - 1];
  const cues = windups.map((m) => ({ at: m * MEASURE, lands: m * MEASURE + WAIT, unit: bytes[21 + m] % 3 }));
  const targets = [...CLAPS.map((at) => ({ at, kind: "clap" })), ...cues.map((c) => ({ at: c.lands, kind: "parry" }))]
    .sort((x, y) => x.at - y.at);

  const [lo, hi] = TEMPO[style];
  const bpm = lo + (((bytes[18] << 8) | bytes[19]) % (hi - lo + 1));
  const voice = Object.fromEntries(KIT_DRUMS[style].map((d) => [d, bytes[VOICE_BYTE[d]] % VOICES[style][d]]));
  return { measures: MEASURES, bpm, style, voice, key, chords, hits, pad, cues, targets };
}
