// The day's ghost: the one opponent everyone fights that day, made from the day's ledger hash. Pure, like beat.js: the
// same hash and the same player moves always give the same fight, here and on the server.
//
// The fight is duel.js with the player as player 0 and the ghost as player 1, spread over the song. Each half of a run
// of the song's 8 measures goes: charge (the player taps beat 4; a perfect tap fills half a pip of the meter), the
// ghost acts (the player may guard; a perfect tap on its beat 4 charges too), charge again, the player acts (a fill
// measure, so a run ends on the player's hit). A whole action is one measure (moves.js): wind-up on beats 1 to 3, the
// hit on beat 4. The song plays LOOPS times. On the player's turns the ghost may guard. Both start with START_METER pips.
//
// The moves are attack, super, guard and charge. There is no moving: both stay in reach, so every attack connects.
// On the player's move a lone tap on beat 4 is a charge, not a wasted turn; anything else that isn't an attack or a
// super (nothing, or something unclear) wastes the turn and costs WASTED_PIPS of a pip, no life. On the ghost's turn the only answer is a guard.
//
// The hash picks, a 4-bit number (0 to 15) each, from bytes 29, 30, 31 and 11, 14, 15 (bytes nothing else uses):
//
//   bytes 29, 30   the ghost's moves (the first LOOPS of 4) (high then low half of each byte): 0-11 attack, 12-15 super
//   bytes 31, 11   how well it plays each of them: 0-5 perfect, 6-13 good, 14-15 miss
//   bytes 14, 15   its reaction on each of the player's turns (the first LOOPS): 0-9 nothing, 10-15 a good guard
//
// The ghost isn't random about the rules: a super with less than a full meter becomes an attack (a super it can't
// make would only waste its turn).
import { METER, TURNS, resolve, outcome, start } from "./duel.js";

export const LOOPS = 2;
// one half of a run (0-based measures): charge, ghost, charge, player; the second half is the same 4 measures later
export const CHARGE = 0.5, START_METER = 1, WASTED_PIPS = 0.5;   // a perfect charge tap fills half a pip; both sides start with 1
const HALF = [[0, "charge"], [1, "ghost"], [2, "charge"], [3, "player"]];
export const STEPS = Array.from({ length: LOOPS * 2 }, (_, h) => HALF.map(([m, kind]) => ({ measure: h * 4 + m, kind }))).flat();
export const stepAt = (measure) => STEPS.findIndex((x) => x.measure === measure);   // -1 for a rest measure

const nibbles = (bytes, a, b) => [bytes[a] >> 4, bytes[a] & 15, bytes[b] >> 4, bytes[b] & 15];
const pickMove = (n) => (n <= 11 ? "attack" : "super");
const pickGrade = (n) => (n <= 5 ? "perfect" : n <= 13 ? "good" : "miss");
const pickReaction = (n) => (n <= 9 ? "none" : "guard");
const hitRead = (move, grade) => ({ move, crit: grade === "perfect", grades: [{ err: 0, grade: "good" }, { err: 0, grade }], miss: null });
const plainRead = (move) => ({ move, crit: false, grades: [], miss: null });

// The ghost's plan: what the hash says, before the fight changes it. { moves: 4 x { move, grade }, reactions: 4 }
export function plan(hash) {
  const bytes = hash.match(/../g).map((h) => parseInt(h, 16));
  const moves = nibbles(bytes, 29, 30).map(pickMove), grades = nibbles(bytes, 31, 11).map(pickGrade);
  return { moves: moves.map((move, i) => ({ move, grade: grades[i] })), reactions: nibbles(bytes, 14, 15).map(pickReaction) };
}

// The ghost's read (as moves.js would give it): its own move number i, given the fight's state at the start of it.
export function ghostMove(p, i, state) {
  let { move, grade } = p.moves[i];
  if (move === "super" && state.meter[1] < METER) move = "attack";
  return hitRead(move, grade);
}
// its reaction on the player's turn number i
export function ghostReaction(p, i) {
  const r = p.reactions[i];
  return r === "guard" ? { move: "guard", crit: false, grades: [{ err: 0, grade: "good" }], miss: null } : plainRead(r);
}

// The grade of a read's tap on beat 4, or null if it has none (moves.js: an advance is one tap on 4; a retreat, an attack
// and a super end with one).
const beat4 = (read) => (read.move === "advance" ? read.grades[0]?.grade : ["retreat", "attack", "super"].includes(read.move) ? read.grades[1]?.grade : null) ?? null;

// The fight so far: playerReads are moves.js reads of the player's measure for each step (STEPS), in order, as many as
// have been played. In a charge step and in a ghost step, a perfect tap on beat 4 fills CHARGE of a pip (a guard is held
// through beat 4, so it never charges). Returns { state, log, over, winner, next }: duel.js's state, one log entry per
// step (with `charged`, the meter it filled), and what the ghost does in the next ghost step (null when it's over).
export function fight(hash, playerReads) {
  const p = plan(hash);
  let state = { ...start(), meter: [START_METER, START_METER] }, g = 0, y = 0;
  const log = [];
  const charge = (read) => {
    const before = state.meter[0];
    if (beat4(read) === "perfect") state = { ...state, meter: [Math.min(METER, before + CHARGE), state.meter[1]] };
    return state.meter[0] - before;
  };
  for (let k = 0; k < playerReads.length && k < STEPS.length; k++) {
    const read = playerReads[k], kind = STEPS[k].kind;
    if (kind === "charge") { log.push({ kind, actor: 0, grade: beat4(read) ?? "miss", charged: charge(read) }); continue; }
    if (kind === "player" && read.move === "advance") {   // a lone tap on beat 4: a charge, not a wasted turn
      y++; log.push({ kind, actor: 0, move: "charge", grade: beat4(read), charged: charge(read), damage: 0 }); continue;
    }
    if (kind === "player" && !["attack", "super"].includes(read.move)) {   // a wasted turn: half a pip, no life
      y++;
      const before = state.meter[0];
      state = { ...state, meter: [Math.max(0, before - WASTED_PIPS), state.meter[1]] };
      log.push({ kind, actor: 0, move: read.move, wasted: true, lost: before - state.meter[0], damage: 0, charged: 0 }); continue;
    }
    // no moving: a retreat or an advance as an answer to the ghost does nothing (its tap on 4 may still charge), and a
    // retreat as the player's own move is a wasted turn
    const move = ["retreat", "advance"].includes(read.move) ? { ...read, move: kind === "ghost" ? "none" : "unclear" } : read;
    const r = kind === "ghost" ? resolve(state, 1, ghostMove(p, g++, state), move) : resolve(state, 0, move, ghostReaction(p, y++));
    state = r.state;
    log.push({ kind, ...r.entry, charged: kind === "ghost" ? charge(read) : 0 });
    const o = outcome(state, k + 1 === STEPS.length ? TURNS : 0);
    if (o) return { state, log, over: true, winner: o.winner, next: null };
  }
  const k = log.length;
  if (k === STEPS.length) return { state, log, over: true, winner: outcome(state, TURNS).winner, next: null };   // the last step may skip the check above
  return { state, log, over: false, winner: null, next: k < STEPS.length && g < p.moves.length ? ghostMove(p, g, state) : null };
}
