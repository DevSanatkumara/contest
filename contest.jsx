import { useState, useEffect, useRef } from "react";

const ADMIN_PASSWORD = "dharma2024";

async function stGet(key, shared = false) {
  try {
    const r = await window.storage.get(key, shared);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function stSet(key, val, shared = false) {
  try { await window.storage.set(key, JSON.stringify(val), shared); } catch {}
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch { return ""; }
}

function stripHtml(html = "", len = 200) {
  const d = document.createElement("div");
  d.innerHTML = html;
  const t = d.textContent || d.innerText || "";
  return t.length > len ? t.slice(0, len) + "…" : t;
}

function plural(n, f) {
  const m = n % 10, h = n % 100;
  if (h >= 11 && h <= 14) return f[2];
  if (m === 1) return f[0];
  if (m >= 2 && m <= 4) return f[1];
  return f[2];
}

const ACCENT_COLORS = ["#7B3F00","#1B4D3E","#1B3A6B","#4A0E4E","#8B6914","#2E4057","#6B2D2D"];

export default function App() {
  const [screen, setScreen] = useState("gallery");
  const [posts, setPosts] = useState([]);
  const [postInView, setPostInView] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [liked, setLiked] = useState({});
  const [counts, setCounts] = useState({});
  const [allComments, setAllComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      [data-ph]:empty:before { content: attr(data-ph); color: var(--color-text-tertiary); pointer-events: none; }
      .post-content h1, .post-content h2, .post-content h3 { font-family: var(--font-serif); font-weight: 400; }
      .post-content h1 { font-size: 28px; margin: 2rem 0 1rem; }
      .post-content h2 { font-size: 22px; margin: 1.75rem 0 0.75rem; }
      .post-content h3 { font-size: 18px; margin: 1.5rem 0 0.5rem; }
      .post-content p { margin: 0 0 1.4rem; }
      .post-content hr { border: none; border-top: 0.5px solid var(--color-border-tertiary); margin: 2.5rem 0; }
      .post-content blockquote { border-left: 2px solid var(--color-border-secondary); padding-left: 1.25rem; margin: 1.5rem 0; color: var(--color-text-secondary); font-style: italic; }
      .toolbar-btn { background: none; border: 0.5px solid transparent; border-radius: 4px; cursor: pointer; color: var(--color-text-secondary); font-family: var(--font-sans); height: 30px; padding: 0 8px; font-size: 13px; }
      .toolbar-btn:hover { background: var(--color-background-primary); border-color: var(--color-border-tertiary); }
      .card-hover { transition: box-shadow 0.2s, border-color 0.2s; }
      .card-hover:hover { border-color: var(--color-border-secondary) !important; }
    `;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const ps = await stGet("contest:posts", true) || [];
    setPosts(ps);
    const likedMap = {}, countMap = {}, commMap = {};
    for (const p of ps) {
      likedMap[p.id] = await stGet(`contest:liked:${p.id}`, false) || false;
      countMap[p.id] = await stGet(`contest:lcount:${p.id}`, true) || 0;
      commMap[p.id] = await stGet(`contest:comms:${p.id}`, true) || [];
    }
    setLiked(likedMap);
    setCounts(countMap);
    setAllComments(commMap);
    setLoading(false);
  }

  async function toggleLike(pid) {
    const was = liked[pid];
    const cur = counts[pid] || 0;
    const next = was ? Math.max(0, cur - 1) : cur + 1;
    await stSet(`contest:lcount:${pid}`, next, true);
    await stSet(`contest:liked:${pid}`, !was, false);
    setLiked(p => ({ ...p, [pid]: !was }));
    setCounts(p => ({ ...p, [pid]: next }));
  }

  async function addComment(pid, author, text) {
    const cur = allComments[pid] || [];
    const c = { id: Date.now() + "", author, text, date: new Date().toISOString() };
    const next = [...cur, c];
    await stSet(`contest:comms:${pid}`, next, true);
    setAllComments(p => ({ ...p, [pid]: next }));
  }

  async function savePost(post) {
    let updated;
    if (posts.find(p => p.id === post.id)) {
      updated = posts.map(p => p.id === post.id ? post : p);
    } else {
      updated = [post, ...posts];
      await stSet(`contest:lcount:${post.id}`, 0, true);
      await stSet(`contest:comms:${post.id}`, [], true);
      setCounts(p => ({ ...p, [post.id]: 0 }));
      setAllComments(p => ({ ...p, [post.id]: [] }));
      setLiked(p => ({ ...p, [post.id]: false }));
    }
    await stSet("contest:posts", updated, true);
    setPosts(updated);
  }

  async function deletePost(pid) {
    const updated = posts.filter(p => p.id !== pid);
    await stSet("contest:posts", updated, true);
    setPosts(updated);
    setScreen("admin");
  }

  function openPost(post) { setPostInView(post); setScreen("read"); }
  function openEditor(post = null) { setEditingPost(post); setScreen("editor"); }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--color-text-tertiary)", fontSize: "24px" }}>
      ✦
    </div>
  );

  return (
    <div style={{ fontFamily: "var(--font-serif)", minHeight: "100vh", background: "var(--color-background-tertiary)" }}>
      <Nav
        isAdmin={isAdmin}
        screen={screen}
        onGallery={() => setScreen("gallery")}
        onAdmin={() => setScreen(isAdmin ? "admin" : "login")}
        onLogout={() => { setIsAdmin(false); setScreen("gallery"); }}
      />

      {screen === "gallery" && (
        <Gallery
          posts={posts}
          counts={counts}
          liked={liked}
          onRead={openPost}
          onLike={toggleLike}
        />
      )}

      {screen === "read" && postInView && (
        <ReadView
          post={posts.find(p => p.id === postInView.id) || postInView}
          liked={liked[postInView.id]}
          count={counts[postInView.id] || 0}
          comments={allComments[postInView.id] || []}
          isAdmin={isAdmin}
          onLike={() => toggleLike(postInView.id)}
          onComment={(a, t) => addComment(postInView.id, a, t)}
          onBack={() => setScreen("gallery")}
          onEdit={() => openEditor(postInView)}
          onDelete={() => { if (confirm("Удалить работу?")) deletePost(postInView.id); }}
        />
      )}

      {screen === "login" && (
        <LoginView onLogin={() => { setIsAdmin(true); setScreen("admin"); }} />
      )}

      {screen === "admin" && isAdmin && (
        <AdminPanel
          posts={posts}
          onNew={() => openEditor(null)}
          onEdit={openEditor}
          onDelete={pid => { if (confirm("Удалить?")) deletePost(pid); }}
        />
      )}

      {screen === "editor" && isAdmin && (
        <EditorView
          post={editingPost}
          onSave={async p => { await savePost(p); setScreen("admin"); }}
          onCancel={() => setScreen("admin")}
        />
      )}
    </div>
  );
}

function Nav({ isAdmin, screen, onGallery, onAdmin, onLogout }) {
  return (
    <header style={{
      borderBottom: "0.5px solid var(--color-border-tertiary)",
      background: "var(--color-background-primary)",
      padding: "0 2rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: "64px",
      position: "sticky",
      top: 0,
      zIndex: 10
    }}>
      <div onClick={onGallery} style={{ cursor: "pointer" }}>
        <div style={{ fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--color-text-tertiary)", fontFamily: "var(--font-sans)", marginBottom: "2px" }}>
          Литературный конкурс
        </div>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", color: "var(--color-text-primary)", letterSpacing: "0.01em" }}>
          Слово Дхармы
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {isAdmin && (
          <button onClick={onLogout} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-text-tertiary)", letterSpacing: "0.05em" }}>
            Выйти
          </button>
        )}
        <button onClick={onAdmin} style={{
          background: "none",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-md)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          color: isAdmin ? "var(--color-text-success)" : "var(--color-text-secondary)",
          padding: "6px 14px",
          letterSpacing: "0.05em"
        }}>
          {isAdmin ? "Панель" : "Войти"}
        </button>
      </div>
    </header>
  );
}

function Gallery({ posts, counts, liked, onRead, onLike }) {
  if (posts.length === 0) return (
    <div style={{ textAlign: "center", padding: "8rem 2rem", color: "var(--color-text-tertiary)" }}>
      <div style={{ fontSize: "40px", marginBottom: "1.5rem", opacity: 0.25 }}>✦</div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", marginBottom: "0.5rem" }}>Работы участников появятся здесь</div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", opacity: 0.7 }}>Администратор опубликует произведения для чтения</div>
    </div>
  );

  return (
    <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "3rem 2rem" }}>
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: "0.5rem" }}>
          {posts.length} {plural(posts.length, ["работа", "работы", "работ"])} на конкурсе
        </div>
        <div style={{ height: "1px", background: "var(--color-border-tertiary)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
        {posts.map(p => (
          <PostCard key={p.id} post={p} liked={liked[p.id]} count={counts[p.id] || 0} onRead={onRead} onLike={onLike} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, liked, count, onRead, onLike }) {
  return (
    <div className="card-hover" style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: "var(--border-radius-lg)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      cursor: "pointer"
    }}>
      <div style={{ height: "4px", background: post.accentColor || "#7B3F00" }} />
      <div style={{ padding: "1.5rem", flex: 1 }} onClick={() => onRead(post)}>
        {post.genre && (
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: "0.75rem" }}>
            {post.genre}
          </div>
        )}
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: "400", margin: "0 0 0.4rem", lineHeight: "1.3", color: "var(--color-text-primary)" }}>
          {post.title}
        </h2>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-text-tertiary)", marginBottom: "1rem" }}>
          {post.author} · {fmtDate(post.date)}
        </div>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: "15px", lineHeight: "1.7", color: "var(--color-text-secondary)", margin: 0 }}>
          {stripHtml(post.content, 180)}
        </p>
      </div>
      <div style={{ padding: "0.75rem 1.5rem", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={e => { e.stopPropagation(); onLike(post.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: liked ? "#c0392b" : "var(--color-text-tertiary)", padding: "2px", lineHeight: 1 }}
        >
          {liked ? "♥" : "♡"}
        </button>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-text-tertiary)" }}>
          {count}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-text-tertiary)" }}>
          Читать →
        </span>
      </div>
    </div>
  );
}

function ReadView({ post, liked, count, comments, isAdmin, onLike, onComment, onBack, onEdit, onDelete }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !text.trim()) return;
    setBusy(true);
    await onComment(name.trim(), text.trim());
    setName("");
    setText("");
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "2.5rem 2rem 6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3rem" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--color-text-tertiary)", padding: 0 }}>
          ← Все работы
        </button>
        {isAdmin && (
          <div style={{ display: "flex", gap: "1rem" }}>
            <button onClick={onEdit} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--color-text-secondary)" }}>Изменить</button>
            <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--color-text-danger)" }}>Удалить</button>
          </div>
        )}
      </div>

      {post.genre && (
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: "1rem" }}>
          {post.genre}
        </div>
      )}

      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "38px", fontWeight: "400", lineHeight: "1.2", margin: "0 0 1rem", color: "var(--color-text-primary)" }}>
        {post.title}
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "3rem", paddingBottom: "2rem", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: post.accentColor || "#7B3F00", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: "500", flexShrink: 0 }}>
          {post.author?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--color-text-primary)", fontWeight: "500" }}>{post.author}</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-text-tertiary)" }}>{fmtDate(post.date)}</div>
        </div>
      </div>

      <div
        className="post-content"
        style={{ fontFamily: "var(--font-serif)", fontSize: "19px", lineHeight: "1.9", color: "var(--color-text-primary)" }}
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      <div style={{ marginTop: "4rem", paddingTop: "2rem", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          onClick={onLike}
          style={{
            background: "none",
            border: `0.5px solid ${liked ? "#c0392b" : "var(--color-border-secondary)"}`,
            borderRadius: "100px",
            cursor: "pointer",
            padding: "8px 20px",
            color: liked ? "#c0392b" : "var(--color-text-secondary)",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s"
          }}
        >
          <span>{liked ? "♥" : "♡"}</span>
          {liked ? "Нравится" : "Отметить"}
        </button>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--color-text-tertiary)" }}>
          {count} {plural(count, ["отметка", "отметки", "отметок"])}
        </span>
      </div>

      <div style={{ marginTop: "4rem" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: "2rem" }}>
          Комментарии · {comments.length}
        </div>

        {comments.map(c => (
          <div key={c.id} style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "0.75rem" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: "500", color: "var(--color-text-secondary)", flexShrink: 0 }}>
                {c.author[0].toUpperCase()}
              </div>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: "500", color: "var(--color-text-primary)" }}>{c.author}</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-text-tertiary)" }}>{fmtDate(c.date)}</span>
            </div>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "16px", lineHeight: "1.7", margin: "0", paddingLeft: "38px", color: "var(--color-text-secondary)" }}>
              {c.text}
            </p>
          </div>
        ))}

        <div style={{ marginTop: "2rem", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "1rem", fontWeight: "500" }}>Оставить комментарий</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ваше имя"
            style={{ width: "100%", marginBottom: "0.75rem", boxSizing: "border-box" }}
          />
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Поделитесь впечатлениями..."
            rows={4}
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "var(--font-serif)", fontSize: "16px" }}
          />
          <button
            onClick={submit}
            disabled={busy || !name.trim() || !text.trim()}
            style={{ marginTop: "0.75rem" }}
          >
            {busy ? "Публикуем…" : "Опубликовать →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginView({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  function attempt() {
    if (pw === ADMIN_PASSWORD) {
      onLogin();
    } else {
      setErr(true);
      setPw("");
      setTimeout(() => setErr(false), 2500);
    }
  }

  return (
    <div style={{ maxWidth: "400px", margin: "6rem auto", padding: "2rem" }}>
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{ fontSize: "32px", color: "var(--color-text-tertiary)", marginBottom: "1rem", opacity: 0.4 }}>✦</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", fontWeight: "400", margin: "0", color: "var(--color-text-primary)" }}>
          Вход для администратора
        </h1>
      </div>
      <input
        type="password"
        value={pw}
        onChange={e => setPw(e.target.value)}
        onKeyDown={e => e.key === "Enter" && attempt()}
        placeholder="Пароль"
        style={{ width: "100%", boxSizing: "border-box", borderColor: err ? "var(--color-border-danger)" : undefined }}
        autoFocus
      />
      {err && <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--color-text-danger)", marginTop: "0.5rem" }}>Неверный пароль</div>}
      <button onClick={attempt} style={{ marginTop: "1rem", width: "100%" }}>Войти</button>
    </div>
  );
}

function AdminPanel({ posts, onNew, onEdit, onDelete }) {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "3rem 2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: "400", margin: 0, color: "var(--color-text-primary)" }}>
          Панель администратора
        </h1>
        <button onClick={onNew}>+ Новая работа</button>
      </div>

      {posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--color-text-tertiary)", fontFamily: "var(--font-sans)", fontSize: "14px" }}>
          Нажмите «+ Новая работа» чтобы опубликовать первое произведение
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {posts.map(p => (
            <div key={p.id} style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-md)",
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem"
            }}>
              <div style={{ width: "4px", height: "40px", borderRadius: "2px", background: p.accentColor || "#7B3F00", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "16px", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-text-tertiary)", marginTop: "2px" }}>{p.author} · {fmtDate(p.date)}</div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                <button onClick={() => onEdit(p)} style={{ fontFamily: "var(--font-sans)", fontSize: "12px" }}>Изменить</button>
                <button onClick={() => onDelete(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-text-danger)" }}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditorView({ post, onSave, onCancel }) {
  const [title, setTitle] = useState(post?.title || "");
  const [author, setAuthor] = useState(post?.author || "");
  const [genre, setGenre] = useState(post?.genre || "");
  const [accent, setAccent] = useState(post?.accentColor || ACCENT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && post?.content) {
      editorRef.current.innerHTML = post.content;
    }
  }, []);

  function exec(cmd, val = null) {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  }

  async function handleSave() {
    if (!title.trim() || !author.trim()) return;
    setSaving(true);
    await onSave({
      id: post?.id || Date.now().toString(),
      title: title.trim(),
      author: author.trim(),
      genre: genre.trim(),
      accentColor: accent,
      content: editorRef.current?.innerHTML || "",
      date: post?.date || new Date().toISOString()
    });
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "2.5rem 2rem 6rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: "400", margin: 0, color: "var(--color-text-primary)" }}>
          {post ? "Редактировать" : "Новая работа"}
        </h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={onCancel} style={{ background: "none" }}>Отмена</button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !author.trim()}>
            {saving ? "Сохраняем…" : "Опубликовать"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={{ fontFamily: "var(--font-sans)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-tertiary)", display: "block", marginBottom: "6px" }}>Название *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Заголовок произведения" style={{ width: "100%", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ fontFamily: "var(--font-sans)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-tertiary)", display: "block", marginBottom: "6px" }}>Автор *</label>
          <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Имя автора" style={{ width: "100%", boxSizing: "border-box" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", marginBottom: "1.5rem", alignItems: "end" }}>
        <div>
          <label style={{ fontFamily: "var(--font-sans)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-tertiary)", display: "block", marginBottom: "6px" }}>Жанр</label>
          <input value={genre} onChange={e => setGenre(e.target.value)} placeholder="Стихотворение, рассказ, эссе, поэма…" style={{ width: "100%", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ fontFamily: "var(--font-sans)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-tertiary)", display: "block", marginBottom: "6px" }}>Цвет акцента</label>
          <div style={{ display: "flex", gap: "6px" }}>
            {ACCENT_COLORS.map(c => (
              <div
                key={c}
                onClick={() => setAccent(c)}
                style={{
                  width: "22px", height: "22px", borderRadius: "50%",
                  background: c, cursor: "pointer", flexShrink: 0,
                  outline: accent === c ? `2px solid ${c}` : "2px solid transparent",
                  outlineOffset: "2px"
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
        <div style={{ background: "var(--color-background-secondary)", padding: "6px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", flexWrap: "wrap", gap: "2px", alignItems: "center" }}>
          {[["B", "bold", { fontWeight: 700 }], ["I", "italic", { fontStyle: "italic" }], ["U", "underline", { textDecoration: "underline" }]].map(([label, cmd, s]) => (
            <button key={cmd} className="toolbar-btn" onMouseDown={e => { e.preventDefault(); exec(cmd); }} style={s}>{label}</button>
          ))}
          <div style={{ width: "0.5px", height: "20px", background: "var(--color-border-secondary)", margin: "0 4px" }} />
          <button className="toolbar-btn" onMouseDown={e => { e.preventDefault(); exec("formatBlock", "h2"); }}>Заголовок</button>
          <button className="toolbar-btn" onMouseDown={e => { e.preventDefault(); exec("formatBlock", "h3"); }}>Подзаголовок</button>
          <button className="toolbar-btn" onMouseDown={e => { e.preventDefault(); exec("formatBlock", "p"); }}>Абзац</button>
          <button className="toolbar-btn" onMouseDown={e => { e.preventDefault(); exec("formatBlock", "blockquote"); }}>Цитата</button>
          <div style={{ width: "0.5px", height: "20px", background: "var(--color-border-secondary)", margin: "0 4px" }} />
          <button className="toolbar-btn" onMouseDown={e => { e.preventDefault(); exec("justifyLeft"); }}>⇐</button>
          <button className="toolbar-btn" onMouseDown={e => { e.preventDefault(); exec("justifyCenter"); }}>⇔</button>
          <button className="toolbar-btn" onMouseDown={e => { e.preventDefault(); exec("justifyRight"); }}>⇒</button>
          <button className="toolbar-btn" onMouseDown={e => { e.preventDefault(); exec("insertHorizontalRule"); }}>——</button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-ph="Начните вводить текст произведения..."
          style={{
            minHeight: "420px",
            padding: "2rem",
            fontFamily: "var(--font-serif)",
            fontSize: "18px",
            lineHeight: "1.9",
            color: "var(--color-text-primary)",
            outline: "none",
            background: "var(--color-background-primary)"
          }}
        />
      </div>

      <div style={{ marginTop: "0.75rem", fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-text-tertiary)" }}>
        Выделите текст и нажмите B, I, U для форматирования. Для стихов используйте выравнивание по центру.
      </div>
    </div>
  );
}
