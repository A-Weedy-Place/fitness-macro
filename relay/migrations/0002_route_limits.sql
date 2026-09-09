-- One atomic counter per route category; no device IDs or access tokens.
CREATE TABLE IF NOT EXISTS relay_rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL
);
