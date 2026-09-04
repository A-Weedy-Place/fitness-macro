CREATE TABLE IF NOT EXISTS test_telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS test_telemetry_by_device_time
  ON test_telemetry_events (device_id, received_at DESC);

CREATE INDEX IF NOT EXISTS test_telemetry_by_type_time
  ON test_telemetry_events (event_type, received_at DESC);
