// The duel's rules, as a pure function: the Worker and the page both load it (one place for each rule). It replaces the
// old three-hero fight.
//
// Two players on a track of TRACK spaces. The song's 8 measures are 8 turns, one measure each: player 0 acts on turns 0,
// 2, 4 and 6, player 1 on turns 1, 3, 5 and 7. On its turn the ACTOR records a move blind (moves.js reads it from the
// finger). The other player, the REACTOR, watches that recording and plays the same measure live, and can answer on
// beat 3 with a guard or a retreat. Anything else the reactor plays does nothing.
//
//   attack    hits the other player if they are within RANGE spaces, for ATTACK_DAMAGE by the grade of the tap on beat 4
//             (perfect is a crit). A hit that does damage fills the actor's meter by 1.
//   super     needs a full meter (METER) and empties it. The same, for SUPER_DAMAGE. With less meter it is a wasted turn.
//   advance   one space toward the other player (never onto them).
//   retreat   one space away (the wall stops you).
//   guard     (as a reaction) costs GUARD_COST meter, never below 0, so a guard is always allowed. A perfect guard blocks the
//             whole hit, a good one lets half through (GUARD_LETS_THROUGH).
//   retreat   (as a reaction) happens on beat 3, before the strike on beat 4: if the other player is then out of RANGE the
//             attack misses.
//   a wasted turn (the actor played nothing, something unclear, or a guard, which has nothing to guard) costs WASTED_COST life.
//
// The fight ends when someone has no life left (the other wins), or after the 8 turns: more life wins, equal is a draw.
//
// The numbers are first guesses, not balanced.
import { MEASURES } from "./beat.js";

export const TURNS = MEASURES;                       // one turn per measure of the song
export const HP = 10, METER = 3, TRACK = 7, START = [2, 4], RANGE = 2;
export const ATTACK_DAMAGE = { perfect: 3, good: 2, miss: 0 };
export const SUPER_DAMAGE = { perfect: 8, good: 6, miss: 0 };
export const GUARD_LETS_THROUGH = { perfect: 0, good: 0.5 };   // the share of a hit that gets through a guard
export const GUARD_COST = 1, WASTED_COST = 1;
export const WINDUP_SHOWS_AFTER = 0.25;              // beats: the page shows an attack's wind-up this long after the finger goes down

export const start = () => ({ hp: [HP, HP], meter: [0, 0], pos: [...START] });

const clamp = (x) => Math.max(0, Math.min(TRACK - 1, x));
const side = (s, x) => (s.pos[x] > s.pos[1 - x] ? 1 : -1);   // +1 if player x is on the right of the other player
const retreat = (s, x) => { s.pos[x] = clamp(s.pos[x] + side(s, x)); };
const advance = (s, x) => { const to = s.pos[x] - side(s, x); if (to !== s.pos[1 - x]) s.pos[x] = to; };

// One turn: t is the measure (0 to 7), actorRead and reactorRead are moves.js reads of the actor's and the reactor's
// measure. Returns { state, entry }: the new state, and what happened.
export function resolve(state, t, actorRead, reactorRead) {
  const a = t % 2, r = 1 - a;
  const s = { hp: [...state.hp], meter: [...state.meter], pos: [...state.pos] };
  const entry = { turn: t, actor: a, move: actorRead.move, crit: actorRead.crit, reaction: reactorRead.move, guard: null, damage: 0, whiff: false, wasted: false, gained: 0 };

  // the reaction, on beat 3, before the strike on beat 4
  if (reactorRead.move === "guard") { s.meter[r] = Math.max(0, s.meter[r] - GUARD_COST); entry.guard = reactorRead.grades[0].grade; }
  else if (reactorRead.move === "retreat") retreat(s, r);

  const m = actorRead.move;
  if ((m === "attack" || m === "super") && !(m === "super" && s.meter[a] < METER)) {
    let dmg = (m === "super" ? SUPER_DAMAGE : ATTACK_DAMAGE)[actorRead.grades[1].grade];
    if (m === "super") s.meter[a] = 0;
    if (Math.abs(s.pos[a] - s.pos[r]) > RANGE) { entry.whiff = true; dmg = 0; }
    else if (entry.guard) dmg = Math.round(dmg * GUARD_LETS_THROUGH[entry.guard]);
    entry.damage = dmg;
    s.hp[r] = Math.max(0, s.hp[r] - dmg);
    if (dmg > 0 && m === "attack") { const before = s.meter[a]; s.meter[a] = Math.min(METER, before + 1); entry.gained = s.meter[a] - before; }
  } else if (m === "advance") advance(s, a);
  else if (m === "retreat") retreat(s, a);
  else { entry.wasted = true; s.hp[a] = Math.max(0, s.hp[a] - WASTED_COST); }

  return { state: s, entry };
}

// null while the fight goes on, else { winner: 0, 1 or null for a draw }. `played` is how many turns are done.
export function outcome(state, played) {
  const [h0, h1] = state.hp;
  if (h0 <= 0 && h1 <= 0) return { winner: null };
  if (h0 <= 0) return { winner: 1 };
  if (h1 <= 0) return { winner: 0 };
  if (played >= TURNS) return { winner: h0 === h1 ? null : h0 > h1 ? 0 : 1 };
  return null;
}

// A whole fight from its finished turns: reads is [{ actor, reactor }, ...] in turn order (moves.js reads). Returns
// { state, log, over, winner }; turns after the fight is over are ignored.
export function play(reads) {
  let state = start();
  const log = [];
  for (let t = 0; t < reads.length && t < TURNS; t++) {
    const r = resolve(state, t, reads[t].actor, reads[t].reactor);
    state = r.state; log.push(r.entry);
    const o = outcome(state, t + 1);
    if (o) return { state, log, over: true, winner: o.winner };
  }
  return { state, log, over: false, winner: null };
}
