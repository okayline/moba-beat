-- v0.9: save codes and passkeys through the shared Accounts (dungeon-items). Players keep only a hash of their cookie
-- token now: the column is renamed, and a player from v0.8 (whose plain token is still in it) is upgraded to the hash
-- the next time they're seen (src/worker.js player()).
ALTER TABLE players RENAME COLUMN token TO token_hash;

-- Devices loaded later with a save code or passkey: each has its own cookie token here (hashed). The first device's
-- token is players.token_hash.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  seen_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_player ON sessions (player_id);

-- New players made while logging in, counted per hashed IP and hour.
CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT NOT NULL,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
