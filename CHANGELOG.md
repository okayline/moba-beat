# moba-beat Changelog

Newest first. Times are Hawaii time (HST).

---

## v0.12.1
**Thu Oct 29, 2026 · 2:44 PM HST**

- The footer ("© ~*~88x31~*~ cLuB, year · ≡ version") sits on the right instead of in the middle. Removed: the centered footer.

## v0.12.0
**Thu Oct 29, 2026**

- **The shared footer** from dungeon-items ("© ~*~88x31~*~ cLuB, year · ≡ v0.12.0"), the same line every 88x31 game shows. Its ≡ opens the carry window: save codes, passkeys, logging in and out, and your copies with Pin. Removed: the version line at the bottom.
- **No account page.** Removed: the Account button and the account panel with its Carry list. Everything about logging in is in the ≡ window now.

## v0.11.0 — "Carry"
**Mon Oct 26, 2026 · 12:27 AM HST**

- Under the BPM: the copy you carry, which is your account's pinned copy from any 88x31 game or your newest copy. It shows in gold if the Moon blessed it, and only until today's run is sealed. Removed: nothing on the page said what you hold elsewhere.
- Account has a Carry panel: every copy your account holds, newest first, each with Pin. Removed: no way to choose the copy you carry.
- Today's sealed run with no misses marks the carried copy "kept_beat" in the shared registry. Removed: runs leaving no trace on the copies players hold.
- Needs dungeon-items with the pinned copy (its migration 007) live first.

---

## v0.10.13 — "Bold"
**Sat Oct 24, 2026 · 1:40 AM HST**

- While calibrating, the big button says "Tap to Calibrate!". Removed: "Press / hold" on it during calibration (it comes back when calibration ends).
- All normal-weight text is bold, and the "Beat Fighter II:" name at the top left is bigger and stays on one line; on a phone the date, Ledger and Account move to the line below it. Removed: the normal-weight text.

## v0.10.12 — "Calibrate"
**Sat Oct 24, 2026 · 1:40 AM HST**

- A Calibrate button: a hi-hat plays on every beat for 3 measures and you tap along; the first 4 taps are skipped, and the average of the rest sets your timing (shown as "Your timing: +40 ms", kept in your browser). Taps too uneven (more than 100 ms apart) say "Too uneven, try again". Removed: the tap timing slider (a value you set with it carries over).

## v0.10.11 — "Late!"
**Sat Oct 24, 2026 · 1:27 AM HST**

- Doing nothing (or something unclear) on your move costs half a pip, never below 0. Removed: the 1 life it cost.
- A fight now always ends after its last measure, even when that measure was a wasted turn. Removed: the bug where such a fight was called a draw.
- The lane shows what happened: a "Late!" under any press later than perfect (early shows nothing), and once a measure is done, a label over its last dot: Perfect! or Missed! for a charge; Crit!, Hit! or Missed! for your move; Blocked!, Half! or Hit! for the ghost's attack. The lane now shows 4 beats behind the line so the labels stay in view. Removed: half the room ahead of the line.
- The move list sits right under the fight panel, with no "Moves" heading. Tap timing sits next to the kit and tempo. The ledger link is in the top right by Account, and the version number is in the bottom right corner. Removed: the "Moves" heading, the "See the ledger" link at the bottom, and the version number next to the name.

## v0.10.10 — "Beat Fighter II"
**Sat Oct 24, 2026 · 1:18 AM HST**

- Shorter headlines: "Press Start!", "Charge!", "Ghost winds up..." and "Ghost charging a SUPER". Removed: "Measure 1 is your first charge.", "Tap beat 4", "The ghost winds up an attack!" and "The ghost winds up a SUPER!".
- The game is called Beat Fighter II: The New Challengers (a parody of the old Street Fighter II title): the page titles, the name at the top of the daily and ledger pages, and the save code file. Removed: the name moba-beat from those. The repo, the Worker and the database keep the name moba-beat.

## v0.10.9 — "Lane and timing"
**Sat Oct 24, 2026 · 1:16 AM HST**

- A scrolling lane above the button: the coming beats slide toward a line, each measure tinted by what happens in it (gold charge, pink ghost, blue your move) with dots where to press. Removed: nothing (the old scrolling beat lines went in v0.10.8).
- A tap timing slider (−150 to +150 ms) moves every press later or earlier, for devices where taps land early or late. It is kept in your browser. Removed: nothing.
- "What happened" shows the newest line first. Removed: oldest-first order.

## v0.10.8 — "Fight the ghost"
**Sat Oct 24, 2026 · 1:12 AM HST**

- The daily page is now a fight against the day's ghost, the same opponent for everyone, made from the day's hash. One button. Each half of the song goes: charge (a perfect tap on beat 4 fills half a pip), the ghost attacks (guard by holding beat 3 into 4), charge, your move (attack: tap 3 and 4; super: hold 1 to 3 and tap 4, with 3 pips). The song plays twice. Life bars, meters, a move list that lights up what you can do, and a log of the fight. Nothing is saved yet. Removed: the clap-and-parry game, its scoring and sealing from the page, the three-unit squads, the beat grid, the scrolling beat lines (`feed.js`) and their styles.
- Attack is now a tap on beat 3 and a tap on beat 4. Removed: the old attack (hold beat 2 to 3, then tap 4), and retreat and advance from the fight.

## v0.10.7 — "Fuller drums"
**Sat Oct 24, 2026 · 12:16 AM HST**

- More beat patterns: each kit's rule now picks extra hits from more places, using the whole byte (0 to 255) for patterns A, B and C, so each kit has 256 patterns (hip-hop 247, since a pattern with fewer than 2 extra kicks gets the classic two). House adds quick hi-hats and an extra kick; hip-hop and bounce add kick places; tech house adds hi-hat places. Removed: the shared 108-pattern list (`pattern()`), which no kit used any more, and house's patterns made of that list's hats.
- Real fills: measures 4 and 8 add a lead-in across beats 2 and 3 (8 kinds each, from bytes 1 and 2), and measures 2, 3, 6 and 7 add a small change (from bytes 12, 13, 16, 17). Measures 5 to 8 add two hi-hats. House plays hi-hats on every off-beat. Nothing ever plays on beat 4. Removed: fills that were only one extra hit, and A measures that repeated exactly.
- Every day uses the new rules, past days too: an old day replayed (the ledger page) now sounds different from how it first played. Scores and the ledger don't change.

## v0.10.6 — "No duel page"
**Fri Oct 23, 2026 · 12:45 PM HST**

- The duel page and its link are gone. The duel's backend stays: the Worker routes, the two tables, and `duel.js` and `moves.js`. Removed: `public/duel.html`, `public/duel-page.js`, the "Duels" link in the daily page's footer, and the duel page's section of `style.css`.

## v0.10.5 — "Beat numbers"
**Fri Oct 23, 2026 · 12:35 PM HST**

- In the feed, beats 2 and 3 now have a small number near the bottom of their lines, like beat 1. Beat 4 (gold) has none. Removed: nothing.

## v0.10.4 — "Beat 4 gold"
**Fri Oct 23, 2026 · 12:28 PM HST**

- In the feed, the gold line is now beat 4, the beat you play, and beat 1 has a small "1" near the bottom of its line. Removed: the gold on beat 1.

## v0.10.3 — "Light up"
**Fri Oct 23, 2026 · 12:20 PM HST**

- On the daily page the blue line in the feed lights up when you tap: bright white and wide for a perfect, a softer blue glow for a good. A tap that is late and a miss (past good, within a quarter second) shows "Late!" next to the line. Nothing shows for an early miss. Removed: nothing.

## v0.10.2 — "Beat bars only"
**Fri Oct 23, 2026 · 12:12 PM HST**

- The scrolling feed now shows only the beat lines and the blue line. Removed: the drum dots, the pink wind-up dots and the gold tap targets, so the daily beat is played by ear again.

## v0.10.1 — "Feed"
**Fri Oct 23, 2026 · 12:05 PM HST**

- The daily page now has a scrolling feed. The song scrolls right to left past a blue line; a vertical line marks each beat (gold for the first beat of a measure); the drums are dots (hats on top, then snare or clap, then kick); the enemy's wind-ups are pink dots on the top row; the taps you should make are gold on the bottom row, a filled circle for the clap on beat 4 and a ring for a parry. You hit them as they reach the blue line. The code is `public/feed.js`. The feed shows the notes while you play, so the daily beat is no longer played by ear. Removed: nothing yet; the grid that appears after you finish is still there. (Notes taken out again in v0.10.2.)

## v0.10 — "Duel"
**Fri Oct 23, 2026 · 11:39 AM HST**

- Duels: a new page, `duel.html`. Start a duel and send its link; whoever opens it and joins is the second player. The day's song is the duel: its 8 measures are 8 turns, one measure each, the two players taking turns. On your turn you play your move blind and it is saved; on theirs you watch their recording and play the same measure live, and can answer on beat 3 with a guard or a retreat. The page shows life, meter, the 7-space track, a log, and a short list of the moves. A duel doesn't need both players online at once. Removed: nothing from the daily game, which plays as before.
- The rules are in `public/duel.js`: 10 life each, a meter of 3 that a damaging attack fills by 1, a guard that costs 1 meter (never below 0), a super that needs the full meter, attacks that reach 2 spaces, advance and retreat, and a wasted turn that costs 1 life. All numbers are first guesses, not balanced. Removed: `public/fight.js` and its test, the three-hero fight that the page and the Worker never used.
- Two more moves in `public/moves.js`: super (press on beat 1, hold through beat 3, tap on beat 4) and advance (a single tap on beat 4, my pick). Removed: nothing.
- The Worker keeps duels in two new tables (`migrations/003_duels.sql`, `schema.sql`): who is in the duel and each turn's recording. The state of a duel is worked out from the recordings each time, never stored. New routes: `POST /api/duel/new`, `POST /api/duel/join`, `GET /api/duel`, `POST /api/duel/play`, `GET /api/duels`. New duels are limited to 10 an hour per address. The live D1 must be migrated before this is pushed. Duels are not sealed on the ledger. Removed: nothing.
- The drum, reverb and tap-delay code moved from `public/app.js` to `public/audio.js`, shared with the duel page. Removed: the copy in `app.js`; the daily page sounds and times taps the same.
- The daily page's footer has a "Duels" link. Removed: nothing.

## v0.9.10 — "Late!"
**Fri Oct 23, 2026 · 11:26 AM HST**

- A retreat's tap on beat 3 now has to be at least good too: a miss there makes the measure "unclear", not a retreat, like an attack's beat 2 and a guard's beat 3. Removed: a retreat with a missed first tap still counting as a retreat.
- `read()` and `readSong()` now say how far off the press that started the move was when that miss is why it isn't one (`miss`, in ms: positive is late, negative is early), so the page can show "Late!". Removed: nothing; before, a missed move came back with no hint of how it missed. Still not on the page or the Worker, so no "Late!" shows yet.

## v0.9.9 — "Miss Is a Miss"
**Fri Oct 23, 2026 · 11:25 AM HST**

- A guard's press on beat 3 now has to be at least good (within 80 ms of the beat): a miss there makes the measure "unclear", not a guard, the same as an attack's beat 2. Removed: a guard with a missed press on beat 3 still being called a guard (a "missed" one, with a grade). Still not on the page or the Worker.

## v0.9.8 — "Crit"
**Fri Oct 23, 2026 · 11:24 AM HST**

- An attack's press on beat 2 now has to be at least good (within 80 ms of the beat): a miss there makes the measure "unclear", not an attack. Removed: any press nearest beat 2 starting an attack, however badly timed.
- `read()` and `readSong()` also say whether the move was a crit: an attack whose tap on beat 4 was perfect, or a guard whose press on beat 3 was perfect. A retreat has no crit. Removed: nothing; the grades were already there, and a crit is only the perfect one read for you. Still not on the page or the Worker.

## v0.9.7 — "Tight Guard"
**Fri Oct 23, 2026 · 11:22 AM HST**

- An attack now has to be held through beat 3: a finger let go before beat 3 is "unclear", not an attack. Removed: an attack counting with only a quick tap on beat 2.
- Every press a move is made of is graded against its own beat with the fixed timing (perfect within 35 ms, good within 80, otherwise a miss): a guard on beat 3, an attack's presses on beats 2 and 4, a retreat's taps on beats 3 and 4. The nearest beat still decides which move it was, so a guard 200 ms off is a guard, but a missed one. Removed: "near beat 3" being all a guard needed, and `move()` and `moves()`, which only named the move; `read()` and `readSong()` replace them and also return the grades. Still not on the page or the Worker.

## v0.9.6 — "Hold and Tap"
**Fri Oct 23, 2026 · 11:18 AM HST**

- The first rule of the one-button duel is written as code, not on the page yet: `public/moves.js` reads one measure of finger-down and finger-up times and says which move it was. Attack is a finger down near beat 2 and a separate tap near beat 4, guard is a finger down near beat 3 and still down at beat 4, retreat is a tap near beat 3 and a tap near beat 4. No finger is "none", and any other finger is "unclear". Removed: nothing. The page and the Worker don't use it yet, so the daily game plays exactly as before.

## v0.9.5 — "Steady Hands"
**Wed Oct 21, 2026 · 7:35 PM HST**

- Your taps are timed by when you hear the beat: the delay your speakers or headphones add (where the browser reports it) is taken off. Removed: timing taps by when the sound left the page, which made every tap late by that delay.
- Holding Space is one tap. Removed: a tap for every key repeat while Space was held down.
- The page stops counting after 128 taps, the most a run can send. Removed: runs with more than 128 taps being turned away whole, sealed run and all.
- Two runs finished at the same moment are both sealed, and two first visits of a new day seal it once. Removed: the "Something broke" error (and the lost run) when that happened.
- A run's taps are rounded to whole milliseconds before they are scored, so the taps on the ledger always give the score on the ledger. Removed: scoring the unrounded taps and sealing the rounded ones, which could disagree by one grade.
- One address can make 3 new players an hour. Removed: making any number of new players, each with a sealed run.
- The game's checkpoint in the shared registry reads only the two newest ledger entries. Removed: reading and checking the whole ledger after every sealed run (the "Check the chain" button on the ledger page still checks it all).
- If the registry can't be read at midnight, the page says today's beat isn't ready yet and the next visit tries again. Removed: the "Something broke" error, and waiting with no time limit.

## v0.9.4 — "More Sounds"
**Wed Oct 21, 2026 · 6:00 PM HST**

- Each day now picks which recording of each drum its kit plays: 3 kicks and 3 snares in hip-hop, 3 snares in house, 3 kicks in bounce and tech house. Removed: the single fixed kick, snare, clap and hat per kit (those 13 sample files are replaced by the new ones).
- Every kit's drums come from its own pack: hip-hop from the soulful vintage pack, bounce from the bounce pack, tech house and the house snares from the hard-trap pack. Removed: house, bounce and tech house sharing the bounce pack's hi-hat; they still share one hi-hat recording, so each kit plays it at its own pitch (house higher, bounce lower, tech house slightly higher).
- No sound is made in the browser any more; every sound is a recording. The house kick is now a low 808 kick (the pack's 808-bass-sub, cut to 0.3 s) and the enemy's wind-up cue is a cowbell hit (cut to 0.35 s), the same in every kit. Removed: the synthesized house thump and the two square-wave cue beeps (all browser oscillator code).
- The chord pad is out of the game: no chord is played, in any kit, from the first measure on. Removed: the synth pad (its code, and the pad notes the day made); the key and chords stay as the day's record on the ledger page.

## v0.9.3 — "Kick Alone"
**Wed Oct 21, 2026 · 5:52 PM HST**

- The bass is out of every kit, for now: nothing plays it. Removed: the bass synth and the bass lines (the pad chords stay).
- House: the kick is a thump, a low sine that drops from 150 Hz to 45 Hz, the same every time. Removed: the short sampled house kick (sample deleted), and the day pattern's off-beat kicks in house (they sat right next to the beat kicks and doubled them).

## v0.9.2 — "House, Tech House, Boom Bap and Bounce"
**Wed Oct 21, 2026 · 5:48 PM HST**

- Electro is now called house: 128 BPM, a kick on beats 1, 2 and 3, a snare on beat 2, and the day's off-beat hi-hats and kicks.
- Hip-hop is boom bap: a snare on beat 2, hi-hats on every eighth note, a kick on beat 1, and the day's other kicks picked from the places boom bap puts them (the "a" of 1, the "and" of 2, beat 3, the "and" of 3, the "a" of 3). Removed: hip-hop's random hi-hats and random kicks and snares on beats 2 and 3.
- Bounce, West Coast style, 90 to 100 BPM, is a new kit: a clap on beat 2, a kick on beat 1 and the "and" of 3, hi-hats on every eighth note, and the day picks extra kicks and one open hat. Its drums are the pack's bounce kit, with its own low bass. Removed: the trap kit from v0.9.1, with its samples and its 70 to 85 BPM.
- Tech house, 128 BPM: a kick on beats 1, 2 and 3, a clap on beat 2, hi-hats only on the off-beats, and the day picks syncopated hats and an open hat. Its bass plays on the off-beats, between the kicks. Its drums are the pack's hard-trap kick, clap and hats. The day now picks one of four kits.
- Your tap on beat 4 plays the kit's sound for it: a snare in hip-hop, a kick in house and tech house (a kick on all four beats), a clap in bounce. Beat 4 stays silent until you tap. Removed: the clap for your tap in hip-hop and house, and those two kits' clap samples.

## v0.9.1 — "Trap"
**Wed Oct 21, 2026 · 5:25 PM HST**

- The day's beat is hip-hop, electro or trap. Trap uses the hard-trap drums (heavy kick, crisp snare, hat, clap) with a slow, low, sparse bass line, at 70 to 85 BPM (hip-hop is now 80 to 100 and electro always 128). Removed: the disco kit, its octave-bounce bass line, its reverb and bass sound, and its samples. The kit still comes from the day's hash, so on some days the kit has changed, and the ledger page shows the new one.

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
