-- Литературный конкурс — схема БД
-- Применить: psql -U postgres -d contest -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Файлы (обложки)
CREATE TABLE IF NOT EXISTS files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT NOT NULL,
  mimetype    TEXT NOT NULL,
  size        INTEGER NOT NULL,
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Работы участников
CREATE TABLE IF NOT EXISTS posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  author          TEXT NOT NULL,
  genre           TEXT,
  accent_color    TEXT DEFAULT '#7B3F00',
  content         TEXT NOT NULL,
  cover_image_id  UUID REFERENCES files(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Лайки (один пользователь = один лайк по fingerprint)
CREATE TABLE IF NOT EXISTS likes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  fingerprint  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, fingerprint)
);

-- Комментарии
CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author      TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_likes_post     ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post  ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_posts_created  ON posts(created_at DESC);
