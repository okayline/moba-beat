// The fight rules, as a pure function. Not wired into the page or the Worker yet.
//
// Two sides, each with one health bar shared by its 3 heroes. The turns alternate, one measure each: side 0 (you) on turns
// 0, 2, 4 ..., side 1 (the ghost) on turns 1, 3, 5 .... On its turn a side presses one of three buttons on beat 4: the
// button is the ability, and any hero can use any of them. The grade of the press (score.js: perfect, good or miss) sets
// how strong it is. The other side presses to parry; its grade is the parry. The heroes act in turn (hero 1, 2, 3, then
// hero 1 again) and each one levels up from its own presses: a perfect gives it 1 level, a good half a level, a miss none.
// A level makes that hero's ability stronger the next time it acts.
//
//   CLUTCH   hits the other side's bar
//   FEED     refills the acting side's own bar
//   TILT     weakens the other side's next CLUTCH
//
// A parry works on CLUTCH and TILT (FEED only helps the acting side, so there is nothing to parry). A perfect parry cancels
// the effect, a good parry halves it, a miss does nothing.
//
// The numbers below are first guesses, not balanced.

export const BAR = 100;                                 // each side's bar, full
export const LOOPS = 3;                                 // how many times the song plays in a fight
export const TURNS = LOOPS * 8;                         // 8 measures a song, one turn each
export const HEROES = 3;

export const CLUTCH_HIT = { perfect: 20, good: 10, miss: 0 };    // damage
export const FEED_HEAL = { perfect: 12, good: 6, miss: 0 };      // bar refilled
export const TILT_WEAKEN = { perfect: 0.5, good: 0.75, miss: 1 };  // what the other side's next CLUTCH is multiplied by
export const LEVEL_UP = { perfect: 1, good: 0.5, miss: 0 };   // levels a hero gains from its tap
export const LEVEL_BONUS = 0.1;                                // each level makes the hero's ability this much stronger
export const PARRY_LETS_THROUGH = { perfect: 0, good: 0.5, miss: 1 };   // the share of CLUTCH or TILT that gets through

// turns: [{ ability: "CLUTCH" | "FEED" | "TILT", action: grade, parry: grade }, ...] in order. action is the acting
// side's tap, parry the other side's tap on that turn (ignored for FEED). Returns { bars: [side 0, side 1], winner,
// history } where winner is 0, 1 or null (a draw) and history has one { turn, side, hero, ability, level, bars } per turn
// played (level is the hero's level after its tap). Bars are whole numbers. The fight ends early when a bar is empty.
export function fight(turns) {
  const bars = [BAR, BAR], weak = [1, 1];                // weak[side]: what that side's next CLUTCH is multiplied by
  const levels = [Array(HEROES).fill(0), Array(HEROES).fill(0)];
  const history = [];
  for (let i = 0; i < turns.length && i < TURNS; i++) {
    const side = i % 2, other = 1 - side, t = turns[i];
    const hero = Math.floor(i / 2) % HEROES, power = 1 + LEVEL_BONUS * levels[side][hero];   // its level before this tap
    const through = t.ability === "FEED" ? 1 : PARRY_LETS_THROUGH[t.parry];
    if (t.ability === "CLUTCH") {
      bars[other] = Math.max(0, bars[other] - Math.round(CLUTCH_HIT[t.action] * power * weak[side] * through));
      weak[side] = 1;                                    // a weakened CLUTCH is used up, whether or not it landed
    } else if (t.ability === "FEED") {
      bars[side] = Math.min(BAR, bars[side] + Math.round(FEED_HEAL[t.action] * power));
    } else if (t.ability === "TILT") {
      weak[other] = 1 - Math.min(0.9, (1 - TILT_WEAKEN[t.action]) * power * through);   // a parried TILT weakens less
    } else throw new Error("unknown ability " + t.ability);
    levels[side][hero] += LEVEL_UP[t.action];
    history.push({ turn: i, side, hero, ability: t.ability, level: levels[side][hero], bars: [...bars] });
    if (bars[other] === 0) break;
  }
  const winner = bars[0] === bars[1] ? null : bars[0] > bars[1] ? 0 : 1;
  return { bars, winner, history };
}
