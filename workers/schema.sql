CREATE TABLE IF NOT EXISTS evaluations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,          -- Unix ms
  mood        TEXT    NOT NULL,
  source      TEXT    NOT NULL,          -- generated / music / soundscape / both
  track       TEXT,                      -- current track slug if playing
  soundscape  TEXT,                      -- current soundscape if active

  -- Acoustic features
  lufs        REAL,
  centroid    REAL,
  flatness    REAL,
  flux        REAL,
  am_depth    REAL,
  am_rate     REAL,

  -- Comparison
  score       REAL,                      -- 0-10 vs reference

  -- AI result
  ai_desc     TEXT,
  ai_priority TEXT,
  ai_provider TEXT,                      -- groq / cf-ai / gemini
  triggered   TEXT DEFAULT 'manual',     -- manual / auto-tune

  -- Params snapshot
  params_before TEXT,                    -- JSON
  params_after  TEXT                     -- JSON (null if not applied)
);

CREATE INDEX IF NOT EXISTS idx_ts   ON evaluations(ts);
CREATE INDEX IF NOT EXISTS idx_mood ON evaluations(mood);
CREATE INDEX IF NOT EXISTS idx_score ON evaluations(score);
