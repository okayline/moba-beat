# moba-beat Changelog

Newest first. Times are Hawaii time (HST).

---

## v0.4 — "Lights Off"
**Wed Oct 21, 2026 · 10:41 AM HST**

- A page: the lane with your squad and the ghost squad (Clutch, Feed and Tilt are working names; the fight isn't built yet), and today's beat as 16 bars in 4 measures. Play clicks along at the day's tempo and the squads pulse on each beat. Dark, with the version number next to the name. Removed: nothing; before this the Worker answered only JSON.

## v0.3 — "The Beat"
**Wed Oct 21, 2026 · 10:34 AM HST**

- Each day has a beat: 16 beats (4 measures of 4) and a tempo of 80 to 120 BPM, worked out from the day's ledger hash. Every beat is a rest, a normal beat or a strong beat, and the first beat of each measure is never a rest. `/api/today` now returns it with the day. Removed: nothing; before this the day had a hash and no beat.

## v0.2 — "Day One"
**Wed Oct 21, 2026 · 10:29 AM HST**

- `/api/today` seals each UTC day on the ledger. The day's entry holds the date and the shared registry's chain head at 00:00 UTC, so the day's hash changes every day and depends on what all the games did the day before. Removed: nothing.

## v0.1 — "The Ledger"
**Wed Oct 21, 2026 · 10:26 AM HST**

- A hash-chained ledger of its own (SHA-256 of the previous hash and the record), one entry per UTC day, with a check that finds a changed entry. `/api/ledger` lists it, newest first. Removed: the Cloudflare "Hello world" starter Worker.
