import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { beat, pattern, PROGRESSIONS, STYLES, TAP, KIT_DRUMS, THUMP_KITS, VOICES, PADS } from "../public/beat.js";
import { score, grade } from "../public/score.js";

const hex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("").padEnd(64, "0");

test("the day's patterns worked out by hand: A A A B | A A A C, nothing ever on beat 4", () => {
  // byte mod 108, read as digits base 3, 2, 3, 2, 3 for the "and" of 1, beat 2, the "and" of 2, beat 3, the "and" of 3
  //   0 -> 0 0 0 0 0: -, snare, -, kick, -           1 -> 1 0 0 0 0: hat, snare, -, kick, -
  //   107 -> 2 1 2 1 2: kick, kick, kick, snare, kick
  assert.deepEqual(pattern(0), [[0, "kick"], [1, "snare"], [2, "kick"]]);
  assert.deepEqual(pattern(1), [[0, "kick"], [0.5, "hat"], [1, "snare"], [2, "kick"]]);
  assert.deepEqual(pattern(107), [[0, "kick"], [0.5, "kick"], [1, "kick"], [1.5, "kick"], [2, "snare"], [2.5, "kick"]]);
  // a house day keeps the pattern's off-beat hats, so they show the patterns: A = 0, B = 1, C = 107
  const off = (m, hits) => hits.filter((h) => h.at >= m * 4 && h.at < m * 4 + 4 && h.at % 1 !== 0 && h.drum === "hat").map((h) => [h.at - m * 4, h.drum]);
  const b = beat(hex([0, 1, 107, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]));
  assert.equal(b.measures, 8);
  for (const [m, p] of [[0, 0], [1, 0], [2, 0], [3, 1], [4, 0], [5, 0], [6, 0], [7, 107]]) {
    assert.deepEqual(off(m, b.hits), pattern(p).filter(([at, d]) => at % 1 !== 0 && d === "hat"), "measure " + (m + 1));
  }
  assert.ok(b.hits.every((h) => h.at % 4 < 3), "beat 4 of every measure is the player's: no drum on it or after it");
  assert.equal(b.bpm, 128);
  // a fill the same as A moves to the next pattern: bytes 0, 1 = 5, 113 (113 mod 108 = 5) -> B is 6
  const c = beat(hex([5, 113, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]));
  assert.deepEqual(off(3, c.hits), pattern(6).filter(([at, d]) => at % 1 !== 0 && d === "hat"));
});

test("the harmony worked out by hand: key of D, I V vi IV, then I V and V to I, soft triads", () => {
  // byte 3 = 2 -> D; byte 4 = 0 -> I V vi IV; byte 20 = 0 -> hip-hop
  const b = beat(hex([0, 0, 0, 2, 0]));
  // I V vi IV I V V I in D: D A Bm G D A A D (roots in semitones above C: 2 9 11 7 2 9 9 2)
  assert.deepEqual(b.chords.map((c) => [c.root, c.quality]),
    [[2, "maj"], [9, "maj"], [11, "min"], [7, "maj"], [2, "maj"], [9, "maj"], [9, "maj"], [2, "maj"]]);
  assert.equal(b.style, "hip-hop");
  // pads start in measure 2 (the song opens on the drums alone): A major from C4 + 9 = 69 73 76; B minor 71 74 78
  assert.equal(b.pad.length, 7);
  assert.deepEqual(b.pad[0], { at: 4, dur: 4, midi: [69, 73, 76] });
  assert.deepEqual(b.pad[1].midi, [71, 74, 78]);
});

test("nothing new starts on beat 4 in any kit, and every progression's first half ends away from home", () => {
  for (const s of [0, 1, 2, 3]) {
    const bytes = Array(32).fill(0); bytes[20] = s;
    const b = beat(hex(bytes));
    assert.ok(b.pad.every((n) => n.at % 4 !== 3), b.style + " pad");
  }
  for (const p of PROGRESSIONS) assert.ok([5, 7].includes(p[3][0]), "measure 4 is IV or V");
  // every day ends V (measure 7) then I (measure 8), in its key
  for (let key = 0; key < 12; key++) for (let prog = 0; prog < PROGRESSIONS.length; prog++) {
    const b = beat(hex([0, 0, 0, key, prog]));
    assert.deepEqual([b.chords[6].root, b.chords[7].root], [(key + 7) % 12, key]);
  }
});

test("the day picks one recording of each drum from bytes 5 to 9, mod how many the kit has", () => {
  // bytes 5..9 = kick 4, snare 5, clap 6, hat 7, open 8; hip-hop has 3 kicks and 3 snares, 1 hat: 4%3 = 1, 5%3 = 2, 7%1 = 0
  assert.deepEqual(beat(hex([0, 0, 0, 0, 0, 4, 5, 6, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).voice, { kick: 1, snare: 2, hat: 0 });
  // bounce (byte 20 = 2): 3 kicks, 1 clap, 1 hat, 1 open: 4%3 = 1, the rest 0
  assert.deepEqual(beat(hex([0, 0, 0, 0, 0, 4, 5, 6, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2])).voice, { kick: 1, clap: 0, hat: 0, open: 0 });
  // every recording a day can pick is a file
  for (const k of STYLES) for (const [d, n] of Object.entries(VOICES[k])) for (let i = 1; i <= n; i++) assert.ok(existsSync(`public/samples/${k}/${d}-${i}.wav`), `${k}/${d}-${i}`);
  assert.deepEqual(Object.keys(VOICES).sort(), [...STYLES].sort());
  for (const k of STYLES) assert.deepEqual(Object.keys(VOICES[k]).sort(), [...KIT_DRUMS[k]].sort(), k);
});

test("wind-ups worked out by hand: cue on beat 1, lands 2 beats later on beat 3; claps on every beat 4", () => {
  // byte 10 = 0b10000101: bits 0, 2 and 7; bit 0 (measure 1) is ignored -> measures 3 and 8
  // units: measure index 2 -> byte 23 = 7 -> 1; index 7 -> byte 28 = 5 -> 2
  const bytes = Array(32).fill(0);
  bytes[10] = 0b10000101; bytes[23] = 7; bytes[28] = 5;
  const b = beat(hex(bytes));
  assert.deepEqual(b.cues, [{ at: 8, lands: 10, unit: 1 }, { at: 28, lands: 30, unit: 2 }]);
  assert.deepEqual(b.targets, [3, 7, 10, 11, 15, 19, 23, 27, 30, 31].map((at) => ({ at, kind: [10, 30].includes(at) ? "parry" : "clap" })));
  // no bits: the last measure gets the wind-up
  assert.deepEqual(beat(hex(Array(32).fill(0))).cues, [{ at: 28, lands: 30, unit: 0 }]);
});

test("there are 108 different patterns", () => {
  const seen = new Set(Array.from({ length: 108 }, (_, n) => JSON.stringify(pattern(n))));
  assert.equal(seen.size, 108);
});

test("the tempo is in the kit's range (house here, byte 20 = 1: always 128 BPM)", () => {
  // [byte 18, byte 19, BPM]: a range of one tempo, so any bytes give 128
  for (const [x, y, bpm] of [[0, 0, 128], [0, 30, 128], [1, 0, 128], [255, 255, 128]]) {
    const bytes = Array(32).fill(1); bytes[18] = x; bytes[19] = y;
    assert.equal(beat(hex(bytes)).bpm, bpm);
  }
});

test("the day's sound is one of 4 kits, from byte 20", () => {
  for (const [v, style] of [[0, "hip-hop"], [1, "house"], [2, "bounce"], [3, "tech-house"], [4, "hip-hop"], [7, "tech-house"]]) {
    const bytes = Array(32).fill(0); bytes[20] = v;
    assert.equal(beat(hex(bytes)).style, style);
  }
});

test("a bounce day is 90 to 100 BPM, from bytes 18, 19", () => {
  for (const [x, y, bpm] of [[0, 0, 90], [0, 10, 100], [0, 11, 90], [1, 5, 98]]) {   // 11 values; 256 + 5 = 261, 261 mod 11 = 8
    const bytes = Array(32).fill(0); bytes[18] = x; bytes[19] = y; bytes[20] = 2;
    assert.equal(beat(hex(bytes)).bpm, bpm);
  }
});

test("a hip-hop day is boom bap: a snare only on beat 2, hats on every eighth, a kick on beat 1, and kicks from a fixed set", () => {
  for (const n of [0, 1, 107, 50, 31]) {
    const bytes = Array(32).fill(0); bytes[0] = n; bytes[1] = n + 1; bytes[2] = n + 2;
    const b = beat(hex(bytes));
    assert.equal(b.style, "hip-hop");
    for (let m = 0; m < 8; m++) {
      const at = (t) => b.hits.filter((h) => h.at === m * 4 + t).map((h) => h.drum).sort();
      assert.deepEqual(at(1).filter((d) => d === "snare"), ["snare"], "measure " + (m + 1));
      assert.ok(at(0).includes("kick"));
      for (const t of [0, 0.5, 1, 1.5, 2, 2.5]) assert.ok(at(t).includes("hat"));
    }
    assert.ok(b.hits.filter((h) => h.drum === "snare").every((h) => h.at % 4 === 1));
    assert.ok(b.hits.filter((h) => h.drum === "kick").every((h) => [0, 0.75, 1.5, 2, 2.5, 2.75].includes(h.at % 4)));
  }
});

test("a house day has a kick on beats 1, 2 and 3 of every measure and a snare on beat 2, and none on beat 4", () => {
  const bytes = Array(32).fill(0); bytes[20] = 1;
  const b = beat(hex(bytes));
  for (let m = 0; m < 8; m++) {
    const at = (t, drum) => b.hits.some((h) => h.at === m * 4 + t && h.drum === drum);
    assert.ok(at(0, "kick") && at(1, "kick") && at(2, "kick") && at(1, "snare"), "measure " + (m + 1));
  }
  assert.ok(b.hits.every((h) => h.at % 4 < 3));
});

test("a bounce day: a clap on beat 2, a kick on 1 and the \"and\" of 3, hats on every eighth (one may be open), and every sound it plays is in its kit", () => {
  for (const n of [0, 1, 7, 8, 31, 107]) {
    const bytes = Array(32).fill(0); bytes[0] = n; bytes[1] = n + 1; bytes[2] = n + 2; bytes[20] = 2;
    const b = beat(hex(bytes));
    for (let m = 0; m < 8; m++) {
      const at = (t) => b.hits.filter((h) => h.at === m * 4 + t).map((h) => h.drum);
      assert.deepEqual(at(1).filter((d) => d === "clap"), ["clap"]);
      assert.ok(at(0).includes("kick") && at(2.5).includes("kick"));
      for (const t of [0, 0.5, 1, 1.5, 2, 2.5]) assert.equal(at(t).filter((d) => d === "hat" || d === "open").length, 1);
    }
    assert.ok(b.hits.every((h) => KIT_DRUMS.bounce.includes(h.drum) && h.at % 4 < 3));
  }
  // pattern 8: no extra kicks, the open hat on the "and" of 1 (8 >> 3 = 1)
  const bytes = Array(32).fill(0); bytes[0] = 8; bytes[1] = 8; bytes[2] = 8; bytes[20] = 2;
  const first = beat(hex(bytes)).hits.filter((h) => h.at < 4).map((h) => [h.at, h.drum]);
  assert.deepEqual(first.map(([a, d]) => a + d).sort(), ["0hat", "0kick", "0.5open", "1hat", "1clap", "1.5hat", "2hat", "2.5hat", "2.5kick"].sort());
});

test("a tech-house day: a kick on 1, 2 and 3, a clap on 2, hats only on the off-beats, and every sound is in its kit", () => {
  for (const n of [0, 1, 7, 8, 31, 107]) {
    const bytes = Array(32).fill(0); bytes[0] = n; bytes[1] = n + 1; bytes[2] = n + 2; bytes[20] = 3;
    const b = beat(hex(bytes));
    assert.equal(b.style, "tech-house");
    assert.equal(b.bpm, 128);
    for (let m = 0; m < 8; m++) {
      const at = (t) => b.hits.filter((h) => h.at === m * 4 + t).map((h) => h.drum);
      assert.ok(at(0).includes("kick") && at(1).includes("kick") && at(2).includes("kick"));
      assert.deepEqual(at(1).filter((d) => d === "clap"), ["clap"]);
      for (const t of [0.5, 1.5, 2.5]) assert.ok(at(t).includes("hat"));
      for (const t of [0, 1, 2]) assert.ok(!at(t).includes("hat") && !at(t).includes("open"), "no hat on the beat");
    }
    assert.ok(b.hits.every((h) => KIT_DRUMS["tech-house"].includes(h.drum) && h.at % 4 < 3));
  }
  // pattern 8: no syncopated hats, the open hat on the "and" of 1
  const bytes = Array(32).fill(0); bytes[0] = 8; bytes[1] = 8; bytes[2] = 8; bytes[20] = 3;
  assert.deepEqual(beat(hex(bytes)).hits.filter((h) => h.at < 4).map((h) => h.at + h.drum).sort(),
    ["0kick", "0.5hat", "0.5open", "1kick", "1clap", "1.5hat", "2kick", "2.5hat"].sort());
});

test("every kit has a tap sound that is one of its own samples or its made thump", () => {
  assert.deepEqual(Object.keys(TAP).sort(), [...STYLES].sort());
  assert.deepEqual(STYLES.map((s) => TAP[s]), ["snare", "kick", "clap", "kick"]);
  for (const k of STYLES) assert.ok(KIT_DRUMS[k].includes(TAP[k]) || (TAP[k] === "kick" && THUMP_KITS.includes(k)), k);
});

test("the same hash gives the same beat, another hash another beat", () => {
  assert.deepEqual(beat("ab".repeat(32)), beat("ab".repeat(32)));
  assert.notDeepEqual(beat("ab".repeat(32)), beat("cd".repeat(32)));
});

test("a tap is scored by its distance from the metronome: perfect within 35 ms, good within 80, else a miss", () => {
  assert.deepEqual([grade(0), grade(-35), grade(36), grade(80), grade(-81), grade(null)], ["perfect", "perfect", "good", "good", "miss", "miss"]);
  // targets 1000 ms apart; taps 20 ms late, 60 ms early, none near the third, 300 ms late (outside the 250 ms window)
  assert.deepEqual(score([1000, 2000, 3000, 4000], [1020, 1940, 2600, 4300]), [
    { err: 20, grade: "perfect" }, { err: -60, grade: "good" }, { err: null, grade: "miss" }, { err: null, grade: "miss" },
  ]);
  assert.deepEqual(score([1000], [900, 990, 1030]), [{ err: -10, grade: "perfect" }], "the nearest tap counts");
});

test("each kit plays the chords its own way: no two kits share a pad", () => {
  assert.deepEqual(Object.keys(PADS).sort(), [...STYLES].sort());
  const sound = (k) => JSON.stringify(PADS[k]);
  assert.equal(new Set(STYLES.map(sound)).size, STYLES.length);
  for (const k of STYLES) assert.ok(PADS[k].hold > 0 && PADS[k].hold <= 1 && PADS[k].attack > 0, k);
});
