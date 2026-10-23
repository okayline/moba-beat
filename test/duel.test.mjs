import { test } from "node:test";
import assert from "node:assert/strict";
import { start, resolve, outcome, play, TURNS } from "../public/duel.js";

// Reads as moves.js gives them: just the parts the rules use.
const hit = (move, g) => ({ move, crit: g === "perfect", grades: [{ err: 0, grade: "perfect" }, { err: 0, grade: g }], miss: null });
const atk = (g) => hit("attack", g), sup = (g) => hit("super", g);
const guard = (g) => ({ move: "guard", crit: g === "perfect", grades: [{ err: 0, grade: g }], miss: null });
const plain = (move) => ({ move, crit: false, grades: [], miss: null });
const none = plain("none"), retreat = plain("retreat"), advance = plain("advance");
const at = (hp, meter, pos) => ({ hp, meter, pos });

// start: 10 life each, no meter, at spaces 2 and 4 of 7 (2 apart, in range); an attack reaches 2 spaces.
test("an attack hits for 3 on a perfect tap and 2 on a good one, and fills the meter", () => {
  let r = resolve(start(), 0, atk("perfect"), none);
  assert.deepEqual(r.state, at([10, 7], [1, 0], [2, 4]));
  assert.equal(r.entry.damage, 3);
  r = resolve(start(), 1, atk("good"), none);                       // turn 1: player 1 acts
  assert.deepEqual(r.state, at([8, 10], [0, 1], [2, 4]));
  r = resolve(start(), 0, atk("miss"), none);                       // a tap too far off does nothing, and fills nothing
  assert.deepEqual(r.state, at([10, 10], [0, 0], [2, 4]));
});

test("guard: a perfect one blocks it all, a good one lets half through; it costs 1 meter but never below 0", () => {
  assert.deepEqual(resolve(start(), 0, atk("perfect"), guard("perfect")).state, at([10, 10], [0, 0], [2, 4]));   // no damage, so no meter gained; the guard cost nothing it could take
  const r = resolve(at([10, 10], [0, 2], [2, 4]), 0, atk("perfect"), guard("good"));   // round(3 / 2) = 2 gets through; the guard cost 1 of 2
  assert.deepEqual(r.state, at([10, 8], [1, 1], [2, 4]));
  assert.equal(r.entry.guard, "good");
  // a guard against a move that isn't an attack still costs
  assert.deepEqual(resolve(at([10, 10], [0, 3], [2, 4]), 0, advance, guard("perfect")).state, at([10, 10], [0, 2], [3, 4]));
});

test("a retreat on beat 3 takes the reactor out of range, and the wall stops it", () => {
  const r = resolve(start(), 0, atk("perfect"), retreat);           // player 1 goes 4 to 5: 3 apart, out of range
  assert.deepEqual(r.state, at([10, 10], [0, 0], [2, 5]));
  assert.equal(r.entry.whiff, true);
  const w = resolve(at([10, 10], [0, 0], [4, 6]), 0, atk("good"), retreat);   // at the wall: stays at 6, still 2 apart, so it hits
  assert.deepEqual(w.state, at([10, 8], [1, 0], [4, 6]));
});

test("a wasted turn costs 1 life: nothing, something unclear, or a guard as your own move", () => {
  assert.deepEqual(resolve(start(), 0, none, none).state, at([9, 10], [0, 0], [2, 4]));
  assert.deepEqual(resolve(start(), 1, plain("unclear"), none).state, at([10, 9], [0, 0], [2, 4]));
  assert.deepEqual(resolve(start(), 0, guard("perfect"), none).state, at([9, 10], [0, 0], [2, 4]));
});

test("super needs a full meter, empties it, and hits for 8 or 6; without the meter it is a wasted turn", () => {
  const full = at([10, 10], [3, 0], [2, 4]);
  assert.deepEqual(resolve(full, 0, sup("perfect"), none).state, at([10, 2], [0, 0], [2, 4]));   // no meter back from a super
  assert.deepEqual(resolve(full, 0, sup("good"), none).state, at([10, 4], [0, 0], [2, 4]));
  assert.deepEqual(resolve(at([10, 10], [2, 0], [2, 4]), 0, sup("perfect"), none).state, at([9, 10], [2, 0], [2, 4]));
  assert.deepEqual(resolve(full, 0, sup("perfect"), guard("perfect")).state, at([10, 10], [0, 0], [2, 4]));   // blocked, and the meter is spent anyway
});

test("advance and retreat as your own move: one space, never onto the other player, never off the track", () => {
  assert.deepEqual(resolve(start(), 0, advance, none).state.pos, [3, 4]);
  assert.deepEqual(resolve(at([10, 10], [0, 0], [3, 4]), 0, advance, none).state.pos, [3, 4], "can't stand on them");
  assert.deepEqual(resolve(start(), 1, advance, none).state.pos, [2, 3]);   // player 1 comes left
  assert.deepEqual(resolve(start(), 0, retreat, none).state.pos, [1, 4]);
  assert.deepEqual(resolve(at([10, 10], [0, 0], [0, 4]), 0, retreat, none).state.pos, [0, 4], "the wall");
});

test("the fight: eight turns of good hits is a draw, one crit makes a winner, an empty life bar ends it early", () => {
  const turns = (first) => Array.from({ length: TURNS }, (_, t) => ({ actor: t === 0 ? first : atk("good"), reactor: none }));
  // 4 hits of 2 each way: both on 2 life
  let g = play(turns(atk("good")));
  assert.deepEqual([g.state.hp, g.over, g.winner], [[2, 2], true, null]);
  // player 0's first hit is a crit (3): player 1 ends on 1, player 0 on 2
  g = play(turns(atk("perfect")));
  assert.deepEqual([g.state.hp, g.over, g.winner], [[2, 1], true, 0]);
  // a KO after one turn: player 1 on 2 life takes a good hit
  assert.deepEqual(outcome(at([10, 0], [0, 0], [2, 4]), 1), { winner: 0 });
  assert.equal(outcome(start(), 3), null, "still going");
  assert.equal(play([{ actor: atk("good"), reactor: none }]).over, false);
  // both at 0 is a draw
  assert.deepEqual(outcome(at([0, 0], [0, 0], [2, 4]), 4), { winner: null });
});
