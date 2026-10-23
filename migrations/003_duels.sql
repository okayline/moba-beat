-- v0.10: duels. A duel is fought over one day's song: its 8 measures are 8 turns (public/duel.js). Player 0 (p0) made the
-- duel; player 1 (p1) is whoever opened its link and joined, null until then. Each turn is one row: the actor's
-- recording (act) and then the reactor's live one (react, null until they have played it). Presses are JSON
-- [{down, up}] in whole ms from the start of that turn's measure, up null if the finger never came up. The state of the
-- fight is always worked out from these rows, never stored.
CREATE TABLE IF NOT EXISTS duels (
  id          INTEGER PRIMARY KEY,
  day         TEXT NOT NULL,
  p0          INTEGER NOT NULL REFERENCES players(id),
  p1          INTEGER REFERENCES players(id),
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS duels_p0 ON duels (p0);
CREATE INDEX IF NOT EXISTS duels_p1 ON duels (p1);
CREATE TABLE IF NOT EXISTS duel_turns (
  duel_id     INTEGER NOT NULL REFERENCES duels(id),
  turn        INTEGER NOT NULL,
  act         TEXT NOT NULL,
  react       TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (duel_id, turn)
);
