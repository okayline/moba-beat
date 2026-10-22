// Scoring a tap against the metronome. Times are milliseconds from the first scored beat. Pure, so the server can use
// the same rules later.
//
// For each target beat, the nearest tap within WINDOW counts; its error is tap minus target (negative = early).
// A tap is perfect within PERFECT ms, good within GOOD ms, and a target with no tap close enough is a miss.

export const PERFECT = 35, GOOD = 80, WINDOW = 250;
export const MAX_TAPS = 128;   // the most taps a run can send; the page stops counting taps after this many

export function grade(err) {
  if (err === null) return "miss";
  const a = Math.abs(err);
  return a <= PERFECT ? "perfect" : a <= GOOD ? "good" : "miss";
}

export function score(targets, taps) {
  return targets.map((t) => {
    let best = null;
    for (const x of taps) if (Math.abs(x - t) <= WINDOW && (best === null || Math.abs(x - t) < Math.abs(best))) best = x - t;
    return { err: best === null ? null : Math.round(best), grade: grade(best) };
  });
}
