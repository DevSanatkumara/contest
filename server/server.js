require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dharma2024";
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || "postgres"}:${process.env.DB_PASSWORD || "postgres"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || "contest"}`
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Только изображения"));
    }
    cb(null, true);
  }
});

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

const uiDist = path.join(__dirname, "../ui/dist");
if (fs.existsSync(uiDist)) {
  app.use(express.static(uiDist));
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (auth === `Bearer ${ADMIN_PASSWORD}`) return next();
  res.status(401).json({ error: "Unauthorized" });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ── Слаги ─────────────────────────────────────────────────────────────────

const CYR_MAP = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",
  к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
  х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"
};

function slugify(str) {
  if (!str) return "";
  const s = String(str).toLowerCase()
    .split("").map(c => CYR_MAP[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 80).replace(/-+$/, "");
}

async function uniqueSlug(base, client, excludeId = null) {
  const root = base || "post";
  let slug = root;
  let n = 1;
  while (true) {
    const q = excludeId
      ? "SELECT 1 FROM posts WHERE slug = $1 AND id <> $2"
      : "SELECT 1 FROM posts WHERE slug = $1";
    const params = excludeId ? [slug, excludeId] : [slug];
    const r = await (client || pool).query(q, params);
    if (!r.rows.length) return slug;
    n++;
    slug = `${root}-${n}`;
  }
}

async function migrateSlugs(client) {
  const r = await client.query("SELECT id, title FROM posts WHERE slug IS NULL");
  for (const { id, title } of r.rows) {
    const slug = await uniqueSlug(slugify(title), client, id);
    await client.query("UPDATE posts SET slug = $1 WHERE id = $2", [slug, id]);
  }
  if (r.rows.length) console.log(`✓ Migrated ${r.rows.length} post slugs`);
}

// ── Healthcheck ───────────────────────────────────────────────────────────

app.get("/health", (req, res) => res.json({ ok: true }));

// ── Файлы ─────────────────────────────────────────────────────────────────

// POST /upload — загрузить изображение (только admin)
app.post("/upload", requireAdmin, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Файл не передан" });

  const { originalname, mimetype, buffer, size } = req.file;
  const result = await pool.query(
    `INSERT INTO files (filename, mimetype, size, data)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [originalname, mimetype, size, buffer]
  );
  const id = result.rows[0].id;
  res.json({ id, url: `/files/${id}` });
}));

// GET /files/:id — отдать файл из БД
app.get("/files/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT filename, mimetype, size, data FROM files WHERE id = $1",
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).end();

  const { mimetype, data } = result.rows[0];
  res.set("Content-Type", mimetype);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(data);
}));

// ── Посты ─────────────────────────────────────────────────────────────────

// GET /posts — список работ (черновики только для admin с ?include_drafts=1)
app.get("/posts", asyncHandler(async (req, res) => {
  const includeDrafts = req.query.include_drafts === "1"
    && req.headers.authorization === `Bearer ${ADMIN_PASSWORD}`;
  const where = includeDrafts ? "" : "WHERE p.is_draft = FALSE";
  const result = await pool.query(`
    SELECT
      p.id, p.slug, p.title, p.author, p.genre, p.accent_color,
      p.content, p.cover_image_id, p.is_draft, p.created_at,
      COUNT(DISTINCT l.id)::int  AS like_count,
      COUNT(DISTINCT c.id)::int  AS comment_count
    FROM posts p
    LEFT JOIN likes    l ON l.post_id = p.id
    LEFT JOIN comments c ON c.post_id = p.id
    ${where}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);
  res.json(result.rows);
}));

// GET /posts/by-slug/:slug — одна работа по слагу (для публичных ссылок)
app.get("/posts/by-slug/:slug", asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT p.*,
      COUNT(DISTINCT l.id)::int AS like_count,
      COUNT(DISTINCT c.id)::int AS comment_count
    FROM posts p
    LEFT JOIN likes    l ON l.post_id = p.id
    LEFT JOIN comments c ON c.post_id = p.id
    WHERE p.slug = $1
    GROUP BY p.id
  `, [req.params.slug]);
  if (!result.rows.length) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
}));

// GET /posts/:id — одна работа
app.get("/posts/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      p.*,
      COUNT(DISTINCT l.id)::int AS like_count,
      COUNT(DISTINCT c.id)::int AS comment_count
    FROM posts p
    LEFT JOIN likes    l ON l.post_id = p.id
    LEFT JOIN comments c ON c.post_id = p.id
    WHERE p.id = $1
    GROUP BY p.id
  `, [req.params.id]);

  if (!result.rows.length) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
}));

// POST /posts — создать работу (admin)
app.post("/posts", requireAdmin, asyncHandler(async (req, res) => {
  const { title, author, genre, accent_color, content, cover_image_id, is_draft } = req.body;
  if (!title?.trim() || !author?.trim()) {
    return res.status(400).json({ error: "title, author обязательны" });
  }
  if (!is_draft && !content?.trim()) {
    return res.status(400).json({ error: "Для публикации нужен текст произведения" });
  }

  const slug = await uniqueSlug(slugify(title));
  const result = await pool.query(`
    INSERT INTO posts (title, author, genre, accent_color, content, cover_image_id, is_draft, slug)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
  `, [title.trim(), author.trim(), genre?.trim() || null, accent_color || "#7B3F00", content || "", cover_image_id || null, !!is_draft, slug]);

  res.status(201).json(result.rows[0]);
}));

// PUT /posts/:id — обновить работу (admin)
app.put("/posts/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { title, author, genre, accent_color, content, cover_image_id, is_draft } = req.body;
  if (!title?.trim() || !author?.trim()) {
    return res.status(400).json({ error: "title, author обязательны" });
  }
  if (!is_draft && !content?.trim()) {
    return res.status(400).json({ error: "Для публикации нужен текст произведения" });
  }
  const existing = await pool.query("SELECT slug FROM posts WHERE id = $1", [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: "Not found" });
  const slug = existing.rows[0].slug || await uniqueSlug(slugify(title), null, req.params.id);

  const result = await pool.query(`
    UPDATE posts
    SET title=$1, author=$2, genre=$3, accent_color=$4,
        content=$5, cover_image_id=$6, is_draft=$7, slug=$8
    WHERE id=$9 RETURNING *
  `, [title.trim(), author.trim(), genre?.trim() || null, accent_color, content || "", cover_image_id || null, !!is_draft, slug, req.params.id]);

  if (!result.rows.length) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
}));

// DELETE /posts/:id — удалить работу (admin)
app.delete("/posts/:id", requireAdmin, asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

// ── Лайки ─────────────────────────────────────────────────────────────────

// GET /posts/:id/likes?fingerprint=xxx
app.get("/posts/:id/likes", asyncHandler(async (req, res) => {
  const { fingerprint } = req.query;
  const { rows: [{ count }] } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1",
    [req.params.id]
  );

  let liked = false;
  if (fingerprint) {
    const r = await pool.query(
      "SELECT 1 FROM likes WHERE post_id = $1 AND fingerprint = $2",
      [req.params.id, fingerprint]
    );
    liked = r.rows.length > 0;
  }

  res.json({ count, liked });
}));

// POST /posts/:id/like — поставить / убрать лайк (toggle)
app.post("/posts/:id/like", asyncHandler(async (req, res) => {
  const { fingerprint } = req.body;
  if (!fingerprint) return res.status(400).json({ error: "fingerprint required" });

  let liked;
  try {
    await pool.query(
      "INSERT INTO likes (post_id, fingerprint) VALUES ($1, $2)",
      [req.params.id, fingerprint]
    );
    liked = true;
  } catch (e) {
    if (e.code === "23505") {
      // unique violation → уже лайкнул → убираем
      await pool.query(
        "DELETE FROM likes WHERE post_id = $1 AND fingerprint = $2",
        [req.params.id, fingerprint]
      );
      liked = false;
    } else throw e;
  }

  const { rows: [{ count }] } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1",
    [req.params.id]
  );
  res.json({ liked, count });
}));

// ── Комментарии ───────────────────────────────────────────────────────────

// GET /posts/:id/comments
app.get("/posts/:id/comments", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC",
    [req.params.id]
  );
  res.json(result.rows);
}));

// POST /posts/:id/comments
app.post("/posts/:id/comments", asyncHandler(async (req, res) => {
  const { author, content } = req.body;
  if (!author?.trim() || !content?.trim()) {
    return res.status(400).json({ error: "author и content обязательны" });
  }
  const result = await pool.query(
    "INSERT INTO comments (post_id, author, content) VALUES ($1, $2, $3) RETURNING *",
    [req.params.id, author.trim(), content.trim()]
  );
  res.status(201).json(result.rows[0]);
}));

// ── SPA fallback ──────────────────────────────────────────────────────────

if (fs.existsSync(uiDist)) {
  app.get("*", (req, res) => res.sendFile(path.join(uiDist, "index.html")));
}

// ── Error handler ─────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: `Файл слишком большой (макс ${MAX_FILE_SIZE / 1024 / 1024} МБ)` });
  }
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// ── Start ─────────────────────────────────────────────────────────────────

async function initDb(client) {
  const schemaPath = path.join(__dirname, "../schema.sql");
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, "utf8");
    await client.query(sql);
    console.log("✓ Schema initialized");
  }
  await migrateSlugs(client);
}

pool.connect()
  .then(async (client) => {
    console.log("✓ PostgreSQL connected");
    await initDb(client);
    client.release();
    app.listen(PORT, () => console.log(`✓ Contest server → http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("✗ DB connection failed:", err.message);
    process.exit(1);
  });
