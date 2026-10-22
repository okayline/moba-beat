import { test } from "node:test";
import assert from "node:assert/strict";
import { beat, pattern, PROGRESSIONS } from "../public/beat.js";
import { score, grade } from "../public/score.js";

const hex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("").padEnd(64, "0");

test("a drumbeat worked out by hand: A A A B | A A A C, nothing ever on beat 4", () => {
  // byte mod 108, read as digits base 3, 2, 3, 2, 3 for the "and" of 1, beat 2, the "and" of 2, beat 3, the "and" of 3
  //   0 -> 0 0 0 0 0: -, snare, -, kick, -           1 -> 1 0 0 0 0: hat, snare, -, kick, -
  //   107 -> 2 1 2 1 2: kick, kick, kick, snare, kick
  const P0 = [[0, "kick"], [1, "snare"], [2, "kick"]];
  const P1 = [[0, "kick"], [0.5, "hat"], [1, "snare"], [2, "kick"]];
  const P107 = [[0, "kick"], [0.5, "kick"], [1, "kick"], [1.5, "kick"], [2, "snare"], [2.5, "kick"]];
  const b = beat(hex([0, 1, 107, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40]));
  const want = [P0, P0, P0, P1, P0, P0, P0, P107].flatMap((p, m) => p.map(([at, drum]) => ({ at: m * 4 + at, drum })));
  assert.equal(b.measures, 8);
  assert.deepEqual(b.hits, want);
  assert.ok(b.hits.every((h) => h.at % 4 < 3), "beat 4 of every measure is the player's: no drum on it or after it");
  assert.equal(b.bpm, 99, "hip-hop (byte 20 = 0), bytes 18, 19 = 0, 40: 40 mod 21 = 19, + 80");
  // a fill the same as A moves to the next pattern: bytes 0, 1 = 5, 113 (113 mod 108 = 5) -> B is 6
  const c = beat(hex([5, 113, 6]));
  assert.deepEqual(c.hits.filter((h) => h.at >= 12 && h.at < 16).map((h) => [h.at - 12, h.drum]), pattern(6));
});

test("the harmony worked out by hand: key of D, I V vi IV twice with measure 8 home, hip-hop bass, soft triads", () => {
  // byte 3 = 2 -> D; byte 4 = 0 -> I V vi IV; byte 20 = 0 -> hip-hop
  const b = beat(hex([0, 0, 0, 2, 0]));
  // I V vi IV I V vi I in D: D A Bm G D A Bm D (roots in semitones above C: 2 9 11 7 2 9 11 2)
  assert.deepEqual(b.chords.map((c) => [c.root, c.quality]),
    [[2, "maj"], [9, "maj"], [11, "min"], [7, "maj"], [2, "maj"], [9, "maj"], [11, "min"], [2, "maj"]]);
  assert.equal(b.style, "hip-hop");
  // hip-hop bass, measure 1 on D (36 + 2 = 38): root, root, fifth (45); measure 2 on A (45): 45, 45, 52
  assert.deepEqual(b.bass.slice(0, 6).map((n) => [n.at, n.midi, n.dur]),
    [[0, 38, 1.5], [1.5, 38, 1], [2.5, 45, 1.5], [4, 45, 1.5], [5.5, 45, 1], [6.5, 52, 1.5]]);
  assert.equal(b.bass.at(-1).at + b.bass.at(-1).dur, 32, "the last bass note rings to the end");
  // pads: D major from C4 + 2 = 62 66 69; B minor 71 74 78
  assert.deepEqual(b.pad[0], { at: 0, dur: 4, midi: [62, 66, 69] });
  assert.deepEqual(b.pad[2].midi, [71, 74, 78]);
});

test("nothing new starts on beat 4 in any kit, and every progression's first half ends away from home", () => {
  for (const s of [0, 1, 2]) {
    const bytes = Array(32).fill(0); bytes[20] = s;
    const b = beat(hex(bytes));
    assert.ok(b.bass.every((n) => n.at % 4 !== 3), b.style + " bass");
    assert.ok(b.pad.every((n) => n.at % 4 !== 3), b.style + " pad");
  }
  for (const p of PROGRESSIONS) assert.ok([5, 7].includes(p[3][0]), "measure 4 is IV or V");
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

test("the tempo is in the kit's range (electro here, byte 20 = 1: always 128 BPM)", () => {
  // [byte 18, byte 19, BPM]: a range of one tempo, so any bytes give 128
  for (const [x, y, bpm] of [[0, 0, 128], [0, 30, 128], [1, 0, 128], [255, 255, 128]]) {
    const bytes = Array(32).fill(1); bytes[18] = x; bytes[19] = y;
    assert.equal(beat(hex(bytes)).bpm, bpm);
  }
});

test("the day's sound is one of 3 kits, from byte 20", () => {
  for (const [v, style] of [[0, "hip-hop"], [1, "electro"], [2, "trap"], [3, "hip-hop"], [7, "electro"]]) {
    const bytes = Array(32).fill(0); bytes[20] = v;
    assert.equal(beat(hex(bytes)).style, style);
  }
});

test("a trap day is slow: 70 to 85 BPM, from bytes 18, 19", () => {
  for (const [x, y, bpm] of [[0, 0, 70], [0, 15, 85], [0, 16, 70], [1, 5, 75]]) {   // 256 mod 16 = 0, so 261 -> 5 -> 75
    const bytes = Array(32).fill(0); bytes[18] = x; bytes[19] = y; bytes[20] = 2;
    assert.equal(beat(hex(bytes)).bpm, bpm);
  }
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
