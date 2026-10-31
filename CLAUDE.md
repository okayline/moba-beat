# moba-beat: working notes

## This repo

moba-beat: a rhythm micro-MOBA auto-battler, daily and async, played like Rhythm Tengoku (GBA): a daily song over a hidden beat, and you tap on the silent beat 4. Design and detailed history are in the private dungeon-notes repo: `moba-beat/design.md` and `moba-beat/changelog-v0.1.md`. The Worker is connected to this repo, so a push to `main` is a release.

- **One place for each rule**, loaded by both the Worker and the page: the day's music in `public/beat.js`, scoring in `public/score.js`, the hash and chain check in `public/chain.js`, the day's sound in `public/audio.js`, the day's ghost and the solo fight in `public/ghost.js`, what a measure of finger work means in `public/moves.js` (hold and tap, graded with `score.js`), and the duel's rules in `public/duel.js` (pure functions, loaded by the Worker; the state of a duel is always worked out from the stored presses). Change a rule there, once.
- **Timing is fixed:** perfect within 35 ms, good within 80 ms. The owner said not to change it.
- **Sound is samples only:** no browser oscillators, ever. Every sound is a recording in `public/samples/` (CC0, sources in its README), one pack per kit. The chord pad is gone for good.
- **The ledger is a hash chain** (`src/ledger.js`): a `day` entry (its hash makes the day's music) and one `run` entry per player per day, the first finished run. Records hold player ids, never names. Don't weaken `prev_hash UNIQUE`.
- **Save codes and passkeys are the shared Accounts service** (dungeon-items `ACCOUNTS.md`, bound here as `ACCOUNTS`). This game keeps only its own players, sessions and cookie (`mb`). Checkpoints go to the shared registry (`REGISTRY`).
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live `moba-beat` D1 migrated before the push that needs it. Other games keep their tables in this same database.
- **Testing:** `npm test` must pass before any commit, plus one quick check of whatever changed. Expected values come from hand-worked examples or node:crypto, not the code under test.
- **Releases:** every release bumps `VERSION` in `public/version.js` and adds a `CHANGELOG.md` entry (a test checks they match), plus the detailed dev entry in dungeon-notes `moba-beat/changelog-v0.1.md`.
