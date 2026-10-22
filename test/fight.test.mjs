import { test } from "node:test";
import assert from "node:assert/strict";
import { fight, BAR, TURNS } from "../public/fight.js";

const t = (ability, action, parry = "miss") => ({ ability, action, parry });

test("a fight worked out by hand: hit, a perfect parry, a half parry, a weakened hit, a heal", () => {
  // turn 0 (you, TILT perfect, ghost misses its parry): ghost 100 - 20 = 80
  // turn 1 (ghost, FEED good = x0.75, you parry perfectly): cancelled, nothing changes
  // turn 2 (you, TILT perfect, ghost parries good = half): 20 / 2 = 10, ghost 70
  // turn 3 (ghost, TILT perfect, you miss the parry): you 100 - 20 = 80
  // turn 4 (you, FEED perfect = x0.5, ghost misses its parry): the ghost's next TILT is halved
  // turn 5 (ghost, TILT perfect, you miss the parry): 20 x 0.5 = 10, you 70
  // turn 6 (you, CLUTCH perfect, hero 1 again, who got a perfect on turn 0 so is level 1: x1.1): 12 x 1.1 = 13.2, rounded 13, you 83
  const r = fight([
    t("TILT", "perfect", "miss"), t("FEED", "good", "perfect"), t("TILT", "perfect", "good"), t("TILT", "perfect", "miss"),
    t("FEED", "perfect", "miss"), t("TILT", "perfect", "miss"), t("CLUTCH", "perfect"),
  ]);
  assert.deepEqual(r.history.map((h) => h.bars), [[100, 80], [100, 80], [100, 70], [80, 70], [80, 70], [70, 70], [83, 70]]);
  assert.deepEqual(r.bars, [83, 70]);
  assert.equal(r.winner, 0);
  // the heroes act in order 1, 2, 3, then 1 again, a measure each (turn / 2, mod 3), whichever side acts
  assert.deepEqual(r.history.map((h) => h.hero), [0, 0, 1, 1, 2, 2, 0]);
  assert.deepEqual(r.history.map((h) => h.side), [0, 1, 0, 1, 0, 1, 0]);
});

test("a FEED that is half parried weakens by half as much, and a missed TILT uses the weakening up", () => {
  // you FEED perfect, ghost parries good: 1 - (1 - 0.5) x 0.5 = 0.75; ghost TILT perfect, no parry: 20 x 0.75 = 15, you 85
  // you CLUTCH good: 85 + 6 = 91; ghost TILT perfect, no parry: the weakening is used up, so the full 20, you 71
  const r = fight([t("FEED", "perfect", "good"), t("TILT", "perfect", "miss"), t("CLUTCH", "good"), t("TILT", "perfect", "miss")]);
  assert.deepEqual(r.history.map((h) => h.bars), [[100, 100], [85, 100], [91, 100], [71, 100]]);
});

test("a bar never goes above full or below empty, and the fight ends the turn a bar is empty", () => {
  assert.deepEqual(fight([t("CLUTCH", "perfect")]).bars, [BAR, BAR]);
  // 5 perfect unparried hits of 20 empty the ghost's bar on your 5th turn (turn 8); the ghost's turns are heals for itself
  const turns = Array.from({ length: 20 }, (_, i) => (i % 2 ? t("CLUTCH", "miss") : t("TILT", "perfect", "miss")));
  const r = fight(turns);
  assert.equal(r.history.length, 9);
  assert.deepEqual(r.bars, [100, 0]);
  assert.equal(r.winner, 0);
});

test("when the turns run out the fuller bar wins; equal bars are a draw; extra turns past the song's loops are ignored", () => {
  assert.equal(fight([t("TILT", "perfect", "miss"), t("TILT", "perfect", "miss")]).winner, null);
  assert.equal(fight([t("TILT", "good", "miss"), t("TILT", "perfect", "miss")]).winner, 1);
  const many = Array.from({ length: TURNS + 4 }, () => t("CLUTCH", "miss"));
  assert.equal(fight(many).history.length, TURNS);
});

test("a hero levels up from its own taps (perfect 1, good 0.5, miss 0) and hits harder next time", () => {
  // you TILT every turn, the ghost heals with misses. Heroes act 1 2 3 1 2 3 ..., so you act on turns 0, 2, 4, ... with hero 0, 1, 2, 0, 1, 2, 0
  const mine = ["perfect", "miss", "miss", "good", "miss", "miss", "perfect"];
  const turns = mine.flatMap((g) => [t("TILT", g, "miss"), t("CLUTCH", "miss")]);
  const r = fight(turns).history.filter((h) => h.side === 0);
  // turn 0: hero 0 level 0, perfect: 20 damage, ghost 80, hero 0 level 1
  // turn 6: hero 0 level 1, good: 10 x 1.1 = 11, ghost 69, hero 0 level 1.5
  // turn 12: hero 0 level 1.5, perfect: 20 x 1.15 = 23, ghost 46
  assert.deepEqual([0, 3, 6].map((k) => r[k].bars[1]), [80, 69, 46]);
  assert.deepEqual([0, 3, 6].map((k) => r[k].level), [1, 1.5, 2.5]);
  assert.deepEqual(r.map((h) => h.hero), [0, 1, 2, 0, 1, 2, 0]);
  assert.equal(r[1].level, 0, "a miss gains nothing");
});
