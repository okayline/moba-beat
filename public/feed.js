// The scrolling feed on the daily page: the song scrolls right to left past a fixed line, like a rhythm game. A vertical
// line marks every beat (the first beat of a measure is the strong one), the drums are the notes (hats on top, then
// snare or clap, then kick), the enemy's wind-ups are pink dots on the top row, and the taps you should make are gold
// on the bottom row: a filled circle for the clap on beat 4, a ring for a parry. Hit the gold when it reaches the line.
// drawFeed(canvas, day, at) draws the moment `at`, in beats from the song's first beat (negative during the count-in).
const BEHIND = 2, AHEAD = 6;                    // beats shown behind and ahead of the line
const ROW = { hat: 0, open: 0, snare: 1, clap: 1, kick: 2 };   // which of the three drum rows each drum sits on

export function drawFeed(canvas, day, at) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const g = canvas.getContext("2d"), css = getComputedStyle(document.documentElement), c = (n) => css.getPropertyValue(n).trim();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const per = w / (BEHIND + AHEAD), x = (b) => (b - at + BEHIND) * per;     // pixels per beat, and where beat b is
  const drumY = (row) => h * (0.3 + row * 0.17), yours = h * 0.84, r = Math.min(per * 0.22, 11);   // the enemy row is at the top, the three drum rows below it, yours at the bottom
  // beat lines
  for (let b = Math.ceil(at - BEHIND); b <= at + AHEAD; b++) {
    if (b < 0 || b > day.measures * 4) continue;
    g.strokeStyle = b % 4 === 0 ? c("--strong") : c("--line"); g.lineWidth = b % 4 === 0 ? 2 : 1;
    g.beginPath(); g.moveTo(x(b), 0); g.lineTo(x(b), h); g.stroke();
  }
  // drums
  for (const hit of day.hits) {
    if (hit.at < at - BEHIND - 1 || hit.at > at + AHEAD + 1) continue;
    g.fillStyle = hit.drum === "kick" ? c("--ink") : hit.drum === "snare" || hit.drum === "clap" ? c("--muted") : c("--line");
    g.beginPath(); g.arc(x(hit.at), drumY(ROW[hit.drum] ?? 0), hit.at < at ? r * 0.7 : r, 0, Math.PI * 2); g.fill();
  }
  // enemy wind-ups
  g.fillStyle = c("--ghost");
  for (const cue of day.cues) {
    if (cue.at < at - BEHIND - 1 || cue.at > at + AHEAD + 1) continue;
    g.beginPath(); g.arc(x(cue.at), h * 0.1, r, 0, Math.PI * 2); g.fill();
  }
  // the taps you should make
  g.strokeStyle = c("--strong"); g.fillStyle = c("--strong"); g.lineWidth = 3;
  for (const t of day.targets) {
    if (t.at < at - BEHIND - 1 || t.at > at + AHEAD + 1) continue;
    g.beginPath(); g.arc(x(t.at), yours, r * 1.3, 0, Math.PI * 2);
    if (t.kind === "parry") g.stroke(); else g.fill();
  }
  // the line you hit on
  g.strokeStyle = c("--you"); g.lineWidth = 3;
  g.beginPath(); g.moveTo(x(at), 0); g.lineTo(x(at), h); g.stroke();
}
