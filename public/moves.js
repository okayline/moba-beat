// What a measure of finger work means in the one-button duel. Pure, like score.js: not wired into the page's daily game.
//
// The player has one button. A press is { down, up }: when the finger went down and when it came up, in beats (beat 1 of
// a measure is 0, beat 2 is 1, beat 3 is 2, beat 4 is 3). `up` is null if the finger never came up.
//
//   attack    down on beat 2 (at least good), still down at beat 3, then a separate tap near beat 4
//   super     down on beat 1 (at least good), still down at beat 3, then a separate tap near beat 4
//   guard     down on beat 3 (at least good) and still down at beat 4 (hold 3 to 4)
//   retreat   a tap on beat 3 (at least good), then a tap near beat 4
//   advance   a single tap on beat 4 (at least good)
//   none      no finger at all in the measure
//   unclear   a finger, but not one of the moves above (a hold on beat 2 with no tap on 4, an attack let go before beat 3,
//             or a move whose first press was a miss)
//
// Which move it was is mostly loose: a press belongs to the beat it is nearest to. How well it was timed is tight: every
// press the move is made of is graded against its beat with score.js (perfect within 35 ms, good within 80, otherwise a
// miss). A miss on the press that starts a move (beat 1 for a super, beat 2 for an attack, beat 3 for a guard or a retreat,
// beat 4 for an advance) means the move is missed too: unclear. `miss` then says how many ms off that press was (positive
// is late, negative is early), so the page can say "Late!".
//
// crit: the move's key press was perfect: an attack's or a super's tap on beat 4, a guard's press on beat 3. A retreat
// and an advance have no crit.
import { MEASURE, MEASURES } from "./beat.js";
import { grade } from "./score.js";

export const MAX_PRESSES = 8;         // the most presses one measure can send (the most any move uses is 2): the page stops counting after this many
export const HOLD_TO = 2;            // an attack's or a super's first press must still be down at beat 3
export const GUARD_UNTIL = 2.75;      // a guard must still be down at this beat position (a quarter beat before beat 4): a first guess
const TARGETS = { attack: [1, 3], super: [0, 3], guard: [2], retreat: [2, 3], advance: [3] };   // the beat each press of a move should land on, in order
const KEY = { attack: 1, super: 1, guard: 0 };                      // which of a move's presses makes it a crit when perfect

const errOf = (press, beat, msPerBeat) => Math.round((press.down - beat) * msPerBeat);   // ms, early is negative, like score.js

// the move, and (when a missed first press is why it isn't one) how far off that press was
function which(presses, msPerBeat) {
  if (!presses.length) return { move: "none", miss: null };
  const beats = presses.map((p) => Math.round(p.down)).join("");
  const held = (presses[0].up ?? Infinity) >= HOLD_TO;
  const shape = beats === "13" && held ? "attack" : beats === "03" && held ? "super" : beats === "23" ? "retreat" : beats === "3" ? "advance"
    : beats === "2" && (presses[0].up ?? Infinity) >= GUARD_UNTIL ? "guard" : null;
  if (!shape) return { move: "unclear", miss: null };
  const err = errOf(presses[0], TARGETS[shape][0], msPerBeat);
  return grade(err) === "miss" ? { move: "unclear", miss: err } : { move: shape, miss: null };
}

// One measure: its presses in order, with times in beats from the start of that measure, and the tempo as milliseconds
// per beat. Returns { move, grades, crit, miss }: grades has one { err, grade } per press the move is made of (err in ms,
// early is negative), empty for none and unclear.
export function read(presses, msPerBeat) {
  const { move, miss } = which(presses, msPerBeat);
  const grades = (TARGETS[move] ?? []).map((beat, i) => {
    const err = errOf(presses[i], beat, msPerBeat);
    return { err, grade: grade(err) };
  });
  return { move, grades, crit: grades[KEY[move]]?.grade === "perfect", miss };
}

// A whole song's presses, in beats from the song's first beat: the read of each of the 8 measures. A press goes to the
// measure whose beats it is nearest to, so a tap a little late on beat 4 still counts for its own measure.
export function readSong(presses, msPerBeat) {
  const measures = Array.from({ length: MEASURES }, () => []);
  for (const p of [...presses].sort((a, b) => a.down - b.down)) {
    const m = Math.floor((p.down + 0.5) / MEASURE);
    if (m >= 0 && m < MEASURES) measures[m].push({ down: p.down - m * MEASURE, up: p.up == null ? null : p.up - m * MEASURE });
  }
  return measures.map((m) => read(m, msPerBeat));
}
