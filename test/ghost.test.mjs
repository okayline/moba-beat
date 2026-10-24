import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, ghostMove, fight, STEPS, stepAt } from "../public/ghost.js";

// bytes 29, 30 = 0x08, 0xD1 -> moves 0, 8, 13, 1: attack, attack, super, attack
// bytes 31, 11 = 0x6E, 0x00 -> grades 6, 14, 0, 0: good, miss, perfect, perfect
// bytes 14, 15 = 0xA0, 0xD9 -> reactions 10, 0, 13, 9: guard, nothing, guard, nothing
const bytes = Array(32).fill(0);
Object.assign(bytes, { 29: 0x08, 30: 0xd1, 31: 0x6e, 11: 0x00, 14: 0xa0, 15: 0xd9 });
const HASH = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
const none = { move: "none", crit: false, grades: [], miss: null };

test("the ghost's plan worked out by hand from bytes 29, 30, 31, 11, 14, 15", () => {
  assert.deepEqual(plan(HASH), {
    moves: [{ move: "attack", grade: "good" }, { move: "attack", grade: "miss" }, { move: "super", grade: "perfect" }, { move: "attack", grade: "perfect" }],
    reactions: ["guard", "none", "guard", "none"],
  });
});

test("the ghost keeps to the rules: no super without a full meter", () => {
  const p = plan(HASH);
  assert.equal(ghostMove(p, 2, { hp: [10, 10], meter: [0, 1], pos: [2, 4] }).move, "attack", "super with 1 meter");
  const s = ghostMove(p, 2, { hp: [10, 10], meter: [0, 3], pos: [2, 4] });
  assert.deepEqual([s.move, s.crit], ["super", true]);
});

test("each half of a run: charge in measure 1, the ghost in 2, charge in 3, the player in 4; 2 runs", () => {
  assert.deepEqual(STEPS.map((x) => [x.measure, x.kind]), [
    [0, "charge"], [1, "ghost"], [2, "charge"], [3, "player"], [4, "charge"], [5, "ghost"], [6, "charge"], [7, "player"],
    [8, "charge"], [9, "ghost"], [10, "charge"], [11, "player"], [12, "charge"], [13, "ghost"], [14, "charge"], [15, "player"]]);
  assert.deepEqual([stepAt(2), stepAt(3), stepAt(16)], [2, 3, -1]);
});

test("charging: a perfect tap on beat 4 fills half a pip, from 1 at the start; on the ghost's turn too, but not a guard", () => {
  const tap = (grade) => ({ move: "advance", crit: false, grades: [{ err: 0, grade }], miss: null });
  assert.deepEqual(fight(HASH, []).state.meter, [1, 1], "both start with 1");
  assert.deepEqual(fight(HASH, [tap("perfect")]).state.meter, [1.5, 1]);
  assert.deepEqual(fight(HASH, [tap("good")]).state.meter, [1, 1]);
  // step 1 is the ghost's attack (good, 2). A lone perfect tap on its beat 4 charges half a pip; the hit still lands
  const r = fight(HASH, [tap("good"), tap("perfect")]);
  assert.deepEqual([r.state.meter[0], r.state.hp[0], r.log[1].charged], [1.5, 8, 0.5]);
  // tap 3 and tap 4 (an attack) on the ghost's turn does nothing to it, but its perfect tap on 4 still charges
  const retreat = { move: "attack", crit: false, grades: [{ err: 0, grade: "good" }, { err: 0, grade: "perfect" }], miss: null };
  const rt = fight(HASH, [tap("good"), retreat]);
  assert.deepEqual([rt.state.meter[0], rt.state.hp[0], rt.state.pos], [1.5, 8, [2, 4]]);
  // step 3 is the player's move: a lone perfect tap on beat 4 is a charge, with no life lost (the ghost's hit left 8)
  const own = fight(HASH, [none, none, none, tap("perfect")]);
  assert.deepEqual([own.state.hp[0], own.state.meter[0], own.log[3].move], [8, 1.5, "charge"]);
  // a guard costs 1 and charges nothing: 1 - 1 = 0; good guard lets round(2 / 2) = 1 through
  const guard = { move: "guard", crit: false, grades: [{ err: 0, grade: "good" }], miss: null };
  const gd = fight(HASH, [tap("good"), guard]);
  assert.deepEqual([gd.state.meter[0], gd.state.hp[0], gd.log[1].charged], [0, 9, 0]);
  // never past 3
  assert.equal(fight(HASH, [tap("perfect"), retreat, tap("perfect"), tap("perfect"), tap("perfect")]).state.meter[0] <= 3, true);
});

test("a whole fight against a player who does nothing, worked out by hand", () => {
  // (both start with 1 pip; charges do nothing here; a wasted turn costs the player half a pip, never below 0, no life)
  // ghost attack good: 2 (8), ghost meter 1 -> 2 | player wastes: pip 1 -> 0.5 | ghost attack missed: 0
  // player wastes: 0.5 -> 0 | super with 2 meter -> attack perfect: 3 (5), meter 3 | wastes: stays 0
  // attack perfect: 3 (2) | wastes | 16 steps done: 2 against 10, the ghost wins
  const f = fight(HASH, Array(16).fill(none));
  assert.deepEqual([f.state.hp, f.state.meter, f.over, f.winner], [[2, 10], [0, 3], true, 1]);
  assert.deepEqual(f.log.map((e) => [e.kind, e.damage ?? 0]),
    [["charge", 0], ["ghost", 2], ["charge", 0], ["player", 0], ["charge", 0], ["ghost", 0], ["charge", 0], ["player", 0],
     ["charge", 0], ["ghost", 3], ["charge", 0], ["player", 0], ["charge", 0], ["ghost", 3], ["charge", 0], ["player", 0]]);
  assert.deepEqual(fight(HASH, Array(4).fill(none)).log[3], { kind: "player", actor: 0, move: "none", wasted: true, lost: 0.5, damage: 0, charged: 0 });
  assert.equal(fight(HASH, Array(4).fill(none)).next.move, "attack");
  assert.equal(fight(HASH, Array(8).fill(none)).over, false);
});

test("everyone fights the same ghost: the same hash gives the same plan", () => {
  assert.deepEqual(plan(HASH), plan(HASH));
  assert.notDeepEqual(plan(HASH), plan("ff".repeat(32)));
});
