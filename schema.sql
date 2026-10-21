-- One SHA-256 hash chain (src/ledger.js): a 'day' entry per UTC day (the day's music) and a 'run' entry per sealed run.
CREATE TABLE IF NOT EXISTS ledger (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,          -- day | run
  day         TEXT NOT NULL,
  record      TEXT NOT NULL,          -- the sealed JSON record
  prev_hash   TEXT NOT NULL UNIQUE,   -- one entry per chain head: the chain can't fork
  hash        TEXT NOT NULL UNIQUE,   -- SHA-256(prev_hash + "|" + record)
  created_at  INTEGER NOT NULL        -- unix seconds
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_day ON ledger (day) WHERE kind = 'day';

-- v0.8: players and runs (migrations/001_runs.sql). A player is a random token in a cookie. One sealed run per player
-- per UTC day.
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
