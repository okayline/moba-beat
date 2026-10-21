-- v0.8: players and runs. A player is a random token in a cookie (no name, no save code yet). One sealed run per
-- player per UTC day: the first finished one. Later plays that day are practice and aren't saved.
CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY,
  token       TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES players(id),
  day         TEXT NOT NULL,
  perfect     INTEGER NOT NULL,
  good        INTEGER NOT NULL,
  miss        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (player_id, day)
);
