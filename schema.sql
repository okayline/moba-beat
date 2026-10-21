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

-- v0.8: players and runs (migrations/001_runs.sql). A player is a random token in a cookie; only its SHA-256 is kept
-- (v0.9, migrations/002_accounts.sql). One sealed run per player per UTC day.
CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
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

-- v0.9: save codes and passkeys through the shared Accounts (migrations/002_accounts.sql). Devices loaded later each
-- have their own hashed cookie token here.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  seen_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_player ON sessions (player_id);
CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT NOT NULL,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
