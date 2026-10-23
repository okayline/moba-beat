import { test } from "node:test";
import assert from "node:assert/strict";
import { read, readSong } from "../public/moves.js";

// Times are beats from the start of the measure: beat 2 is 1, beat 3 is 2, beat 4 is 3. At 500 ms a beat (120 BPM),
// 0.01 of a beat is 5 ms.
const MS = 500;
const move = (presses) => read(presses, MS).move;

test("each move, worked out by hand", () => {
  // attack: down on beat 2, still down at beat 3, up before a separate tap on beat 4
  assert.equal(move([{ down: 1.02, up: 2.1 }, { down: 2.97, up: 3.1 }]), "attack");
  assert.equal(move([{ down: 1.0, up: 2.0 }, { down: 3.0, up: 3.1 }]), "attack");   // let go exactly on beat 3 still counts
  // guard: down on beat 3, still down at beat 4 (or never let go)
  assert.equal(move([{ down: 2.03, up: 3.4 }]), "guard");
  assert.equal(move([{ down: 1.98, up: null }]), "guard");
  // retreat: a tap on beat 3, a tap on beat 4
  assert.equal(move([{ down: 1.98, up: 2.2 }, { down: 3.01, up: 3.2 }]), "retreat");
  // no finger
  assert.equal(move([]), "none");
});

test("a finger that is not one of the moves is unclear", () => {
  assert.equal(move([{ down: 1.0, up: 2.0 }]), "unclear");                                   // a hold on beat 2 and nothing on beat 4
  assert.equal(move([{ down: 1.0, up: 1.9 }, { down: 3.0, up: 3.1 }]), "unclear");           // an attack let go before beat 3
  assert.equal(move([{ down: 2.0, up: 2.4 }]), "unclear");                                   // a guard let go before beat 4
  assert.equal(move([{ down: 2.0, up: 2.1 }]), "unclear");                                   // one tap on beat 3
  assert.equal(move([{ down: 0.0, up: 0.2 }]), "unclear");                                   // a tap on beat 1
  assert.deepEqual(read([{ down: 2.0, up: 2.4 }], MS).grades, []);                           // nothing to grade
  // an attack's beat 2 must be at least good: 1.12 is 60 ms late (good), 1.2 is 100 ms late (a miss)
  assert.equal(move([{ down: 1.12, up: 2.1 }, { down: 3.0, up: 3.1 }]), "attack");
  assert.equal(move([{ down: 1.2, up: 2.1 }, { down: 3.0, up: 3.1 }]), "unclear");
});

test("a crit is the key press being perfect: an attack's tap on beat 4, a guard's press on beat 3", () => {
  const attack = (tap) => read([{ down: 1.0, up: 2.2 }, { down: tap, up: tap + 0.1 }], MS);
  assert.equal(attack(3.0).crit, true);       // dead on beat 4
  assert.equal(attack(3.06).crit, true);      // 30 ms late: still perfect
  assert.equal(attack(3.1).crit, false);      // 50 ms late: a good tap, so an attack but no crit
  assert.equal(attack(3.1).move, "attack");
  assert.equal(read([{ down: 2.0, up: 3.5 }], MS).crit, true);    // guard dead on beat 3
  assert.equal(read([{ down: 2.1, up: 3.5 }], MS).crit, false);   // guard 50 ms late: good
  assert.equal(read([{ down: 2.0, up: 2.1 }, { down: 3.0, up: 3.1 }], MS).crit, false);   // a retreat never crits
});

test("timing is tight: perfect within 35 ms, good within 80, otherwise a miss", () => {
  // guard down at 2.03 beats = 15 ms late: perfect. 2.12 = 60 ms late: good. 1.9 = 50 ms early: good. 2.2 = 100 ms late: miss
  const guard = (down) => read([{ down, up: 3.5 }], MS);
  assert.deepEqual(guard(2.03), { move: "guard", grades: [{ err: 15, grade: "perfect" }], crit: true, miss: null });
  assert.deepEqual(guard(2.12).grades, [{ err: 60, grade: "good" }]);
  assert.deepEqual(guard(1.9).grades, [{ err: -50, grade: "good" }]);
  assert.deepEqual(guard(2.2), { move: "unclear", grades: [], crit: false, miss: 100 });   // a miss on beat 3 misses the guard too, 100 ms late
  // the same gate for a retreat's first tap on beat 3, early (negative) or late, and an attack's beat 2
  assert.deepEqual(read([{ down: 1.8, up: 2.0 }, { down: 3.0, up: 3.1 }], MS), { move: "unclear", grades: [], crit: false, miss: -100 });
  assert.equal(read([{ down: 2.2, up: 2.3 }, { down: 3.0, up: 3.1 }], MS).miss, 100);
  assert.equal(read([{ down: 1.2, up: 2.1 }, { down: 3.0, up: 3.1 }], MS).miss, 100);
  // every press of a move is graded against its own beat: attack 20 ms late then dead on, retreat 10 ms early then 100 ms late
  assert.deepEqual(read([{ down: 1.04, up: 2.2 }, { down: 3.0, up: 3.1 }], MS).grades,
    [{ err: 20, grade: "perfect" }, { err: 0, grade: "perfect" }]);
  assert.deepEqual(read([{ down: 1.98, up: 2.2 }, { down: 3.2, up: 3.3 }], MS).grades,
    [{ err: -10, grade: "perfect" }, { err: 100, grade: "miss" }]);
});

test("super is hold beats 1 to 3 and tap 4; advance is a single tap on 4", () => {
  assert.equal(move([{ down: 0.0, up: 2.1 }, { down: 3.0, up: 3.1 }]), "super");
  assert.equal(read([{ down: 0.0, up: 2.1 }, { down: 3.0, up: 3.1 }], MS).crit, true);          // a perfect tap on 4 crits
  assert.equal(read([{ down: 0.0, up: 2.1 }, { down: 3.1, up: 3.2 }], MS).crit, false);         // 50 ms late: good, no crit
  assert.equal(move([{ down: 0.0, up: 1.9 }, { down: 3.0, up: 3.1 }]), "unclear");               // let go before beat 3
  assert.deepEqual(read([{ down: 0.2, up: 2.1 }, { down: 3.0, up: 3.1 }], MS), { move: "unclear", grades: [], crit: false, miss: 100 });   // beat 1 100 ms late
  assert.equal(move([{ down: 3.02, up: 3.1 }]), "advance");
  assert.deepEqual(read([{ down: 3.02, up: 3.1 }], MS), { move: "advance", grades: [{ err: 10, grade: "perfect" }], crit: false, miss: null });
  assert.deepEqual(read([{ down: 3.2, up: 3.3 }], MS), { move: "unclear", grades: [], crit: false, miss: 100 });   // an advance 100 ms late is missed
});

test("a whole song: each press goes to its own measure", () => {
  const song = readSong([
    { down: 1.0, up: 2.0 }, { down: 3.0, up: 3.1 },      // measure 1: attack
    { down: 4 + 2.0, up: 4 + 3.5 },                      // measure 2: guard
    // measure 3: nothing
    { down: 12 + 2.0, up: 12 + 2.1 }, { down: 12 + 3.2, up: 12 + 3.3 },   // measure 4: retreat, the tap on 4 a bit late
  ], MS);
  assert.deepEqual(song.map((r) => r.move), ["attack", "guard", "none", "retreat", "none", "none", "none", "none"]);
  assert.deepEqual(song[3].grades, [{ err: 0, grade: "perfect" }, { err: 100, grade: "miss" }]);
});
