// The scrolling feed on the daily page: the beat lines scroll right to left past a fixed blue line, like a rhythm game. A
// vertical line marks every beat; the first beat of a measure is gold. No notes are drawn, so you still play by ear.
// drawFeed(canvas, day, at) draws the moment `at`, in beats from the song's first beat (negative during the count-in).
const BEHIND = 2, AHEAD = 6;                    // beats shown behind and ahead of the line

export function drawFeed(canvas, day, at) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const g = canvas.getContext("2d"), css = getComputedStyle(document.documentElement), c = (n) => css.getPropertyValue(n).trim();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const per = w / (BEHIND + AHEAD), x = (b) => (b - at + BEHIND) * per;     // pixels per beat, and where beat b is
  for (let b = Math.ceil(at - BEHIND); b <= at + AHEAD; b++) {
    if (b < 0 || b > day.measures * 4) continue;
    g.strokeStyle = b % 4 === 0 ? c("--strong") : c("--line"); g.lineWidth = b % 4 === 0 ? 2 : 1;
    g.beginPath(); g.moveTo(x(b), 0); g.lineTo(x(b), h); g.stroke();
  }
  g.strokeStyle = c("--you"); g.lineWidth = 3;                                // the line you hit on
  g.beginPath(); g.moveTo(x(at), 0); g.lineTo(x(at), h); g.stroke();
}
