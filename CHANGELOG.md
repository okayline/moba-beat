# moba-beat Changelog

Newest first. Times are Hawaii time (HST).

---

## v0.9 — "Same You"
**Wed Oct 21, 2026 · 12:01 PM HST**

- Account: make a save code or add a passkey, and log in with either on another browser or device to keep your player and your sealed runs. They're the same save codes and passkeys as the other 88x31 games. You can log out of a browser once you have one. Removed: the plain cookie token in the database; only its fingerprint is kept now, and your existing player carries over.

## v0.8 — "On the Record"
**Wed Oct 21, 2026 · 11:52 AM HST**

- Your run is saved. When the song ends, your taps go to the server, which scores them itself against the hidden beat. Your first run of the day is sealed on the ledger; later plays that day are practice. You're a random player number kept in a cookie, with no name.
- A ledger page: every day's beat (its kit, tempo, key and chords, worked out from the day's hash) and every sealed run, newest first, with a button that checks every hash in your browser. Removed: the "See the ledger" link going to raw data.
- The ledger now sends a checkpoint to the shared registry after every seal, like the other games, so it's timestamped hourly with the rest.

## v0.7 — "Real Kits"
**Wed Oct 21, 2026 · 11:35 AM HST**

- The drums are recorded samples now: kick, snare, hi-hat and your clap come from free CC0 drum kits (Boochi44/free-drum-samples, many from Edward Loveall's TR-808 recordings). Hip-hop uses a lo-fi vintage kit, electro a clean 808 kit, disco a mix with an open hi-hat. The bass and chords are still made in the browser. Removed: the synthesized kick, snare, hi-hat and clap.

## v0.6 — "By Ear"
**Wed Oct 21, 2026 · 11:30 AM HST**

- The beat is now a short song. The drums loop like real drum parts, A A A B | A A A C: one measure repeats so you can lock in, and measures 4 and 8 are fills. Under them, a bassline and soft chords play a real chord progression in the day's key (six progressions, such as I V vi IV), ending home on measure 8. Nothing new starts on beat 4, so it stays yours. Everything plays through a little reverb, sized to the kit. Removed: 8 unrelated measures, and the bare drums with silence between hits.
- The beat's grid is hidden until you've played: you play by ear, and the full beat appears with your results. Removed: the grid and its key showing before you play, and the help line ("Clap on 4. Parry 2 beats after a wind-up.").

## v0.5 — "Your Beat"
**Wed Oct 21, 2026 · 11:16 AM HST**

- Each day has an 8-measure drumbeat made from the day's ledger hash: kick, snare and hi-hat play beats 1, 2 and 3 of every measure and leave beat 4 silent. Beat 4 is yours: tap it and you play a clap. Every measure has its own pattern, one of 108, and the tempo is now 70 to 130 BPM. Removed: the 80 to 120 BPM range, rest, normal and strong beats, and the click on every beat.
- Play counts down on screen (-3, -2, -1), then shows beats 1, 2 and 3 of each measure and nothing on beat 4, your clap, and the measure playing is outlined on the grid. Removed: the silent one-measure wait with nothing on screen.
- Enemies wind up: in about half the measures (never the first) an enemy plays a cue on beat 1, and its attack lands 2 beats later, on beat 3. Tap right then to parry.
- Each day has its own sound: the beat plays on a hip-hop, electro or disco drum kit, picked by the day's hash and shown next to the tempo.
- Every clap and parry is scored by how close it was to the real beat: perfect within 35 ms, good within 80 ms, otherwise a miss. A good clap makes your squad flash; a good parry knocks the enemy back. At the end each clap and parry is a dot (yellow perfect, blue good, grey miss), with your totals and how early or late you were on average. Scores aren't saved yet. Removed: most of the explaining text on the page, and the line-by-line results.

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
