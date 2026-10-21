import { test } from "node:test";
import assert from "node:assert/strict";
import { beat } from "../src/beat.js";

const hex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("").padEnd(64, "0");

test("a beat worked out by hand: byte mod 4 gives rest, normal, normal, strong; beat 1 of a measure is never a rest", () => {
  // 0 0 1 3 | 2 0 3 1 | 3 3 0 0 | 1 2 0 3, with 7 (7 mod 4 = 3) and 251 (251 mod 4 = 3) standing in for two strong beats
  const b = beat(hex([0, 0, 1, 7, 2, 0, 251, 1, 3, 3, 0, 0, 1, 2, 0, 3, 40]));
  assert.deepEqual(b.beats, [
    "normal", "rest", "normal", "strong",     // beat 1 would be a rest (0), so it is normal
    "normal", "rest", "strong", "normal",
    "strong", "strong", "rest", "rest",
    "normal", "normal", "rest", "strong",
  ]);
  assert.equal(b.bpm, 80 + 40 % 41, "byte 16 is 40: 120 BPM, the top of the range");
});

test("the tempo is always 80 to 120 and the beat is always 16 beats", () => {
  for (const t of [0, 1, 40, 41, 82, 255]) {
    const b = beat(hex([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, t]));
    assert.equal(b.bpm, 80 + t % 41);
    assert.ok(b.bpm >= 80 && b.bpm <= 120);
    assert.equal(b.beats.length, 16);
  }
});

test("the same hash gives the same beat, another hash another beat", () => {
  const a = "ab".repeat(32), c = "cd".repeat(32);
  assert.deepEqual(beat(a), beat(a));
  assert.notDeepEqual(beat(a), beat(c));
});
