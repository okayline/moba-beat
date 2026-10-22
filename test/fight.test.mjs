import { test } from "node:test";
import assert from "node:assert/strict";
import { fight, BAR, TURNS } from "../public/fight.js";

const t = (ability, action, parry = "miss") => ({ ability, action, parry });

test("a fight worked out by hand: hit, a perfect parry, a half parry, a weakened hit, a heal", () => {
  // turn 0 (you, CLUTCH perfect, ghost misses its parry): ghost 100 - 20 = 80
  // turn 1 (ghost, TILT good = x0.75, you parry perfectly): cancelled, nothing changes
  // turn 2 (you, CLUTCH perfect, ghost parries good = half): 20 / 2 = 10, ghost 70
  // turn 3 (ghost, CLUTCH perfect, you miss the parry): you 100 - 20 = 80
  // turn 4 (you, TILT perfect = x0.5, ghost misses its parry): the ghost's next CLUTCH is halved
  // turn 5 (ghost, CLUTCH perfect, you miss the parry): 20 x 0.5 = 10, you 70
  // turn 6 (you, FEED perfect): you 70 + 12 = 82
  const r = fight([
    t("CLUTCH", "perfect", "miss"), t("TILT", "good", "perfect"), t("CLUTCH", "perfect", "good"), t("CLUTCH", "perfect", "miss"),
    t("TILT", "perfect", "miss"), t("CLUTCH", "perfect", "miss"), t("FEED", "perfect"),
  ]);
  assert.deepEqual(r.history.map((h) => h.bars), [[100, 80], [100, 80], [100, 70], [80, 70], [80, 70], [70, 70], [82, 70]]);
  assert.deepEqual(r.bars, [82, 70]);
  assert.equal(r.winner, 0);
  // the heroes act in order 1, 2, 3, then 1 again, a measure each (turn / 2, mod 3), whichever side acts
  assert.deepEqual(r.history.map((h) => h.hero), [0, 0, 1, 1, 2, 2, 0]);
  assert.deepEqual(r.history.map((h) => h.side), [0, 1, 0, 1, 0, 1, 0]);
});

test("a TILT that is half parried weakens by half as much, and a missed CLUTCH uses the weakening up", () => {
  // you TILT perfect, ghost parries good: 1 - (1 - 0.5) x 0.5 = 0.75; ghost CLUTCH perfect, no parry: 20 x 0.75 = 15, you 85
  // you FEED good: 85 + 6 = 91; ghost CLUTCH perfect, no parry: the weakening is used up, so the full 20, you 71
  const r = fight([t("TILT", "perfect", "good"), t("CLUTCH", "perfect", "miss"), t("FEED", "good"), t("CLUTCH", "perfect", "miss")]);
  assert.deepEqual(r.history.map((h) => h.bars), [[100, 100], [85, 100], [91, 100], [71, 100]]);
});

test("a bar never goes above full or below empty, and the fight ends the turn a bar is empty", () => {
  assert.deepEqual(fight([t("FEED", "perfect")]).bars, [BAR, BAR]);
  // 5 perfect unparried hits of 20 empty the ghost's bar on your 5th turn (turn 8); the ghost's turns are heals for itself
  const turns = Array.from({ length: 20 }, (_, i) => (i % 2 ? t("FEED", "miss") : t("CLUTCH", "perfect", "miss")));
  const r = fight(turns);
  assert.equal(r.history.length, 9);
  assert.deepEqual(r.bars, [100, 0]);
  assert.equal(r.winner, 0);
});

test("when the turns run out the fuller bar wins; equal bars are a draw; extra turns past the song's loops are ignored", () => {
  assert.equal(fight([t("CLUTCH", "perfect", "miss"), t("CLUTCH", "perfect", "miss")]).winner, null);
  assert.equal(fight([t("CLUTCH", "good", "miss"), t("CLUTCH", "perfect", "miss")]).winner, 1);
  const many = Array.from({ length: TURNS + 4 }, () => t("FEED", "miss"));
  assert.equal(fight(many).history.length, TURNS);
});
