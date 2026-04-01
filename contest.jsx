import { useState, useEffect, useRef } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";

const API = import.meta.env.VITE_API_URL || (typeof window !== "undefined" && window.location.origin !== "http://localhost:5173" ? "" : "http://localhost:3001");
const ADMIN_PASSWORD = "dharma2024";

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API error");
  }
  return res.json();
}

function authHeaders() { return { Authorization: `Bearer ${ADMIN_PASSWORD}` }; }

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString("ru-RU", { day:"numeric", month:"long", year:"numeric" }); }
  catch { return ""; }
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

async function getFingerprint() {
  try {
    const r = await window.storage.get("contest:fp", false);
    if (r) return r.value;
    const fp = crypto.randomUUID();
    await window.storage.set("contest:fp", fp, false);
    return fp;
  } catch { return "anon-" + Math.random().toString(36).slice(2); }
}

const ACCENT_COLORS = ["#7B3F00","#1B4D3E","#1B3A6B","#4A0E4E","#8B6914","#2E4057","#6B2D2D"];

export default function App() {
  const [screen, setScreen]         = useState("gallery");
  const [posts, setPosts]           = useState([]);
  const [postInView, setPostInView] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [fingerprint, setFp]        = useState("");

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      [data-ph]:empty:before{content:attr(data-ph);color:var(--color-text-tertiary);pointer-events:none}
      .pc h1,.pc h2,.pc h3{font-family:var(--font-serif);font-weight:400}
      .pc h1{font-size:28px;margin:2rem 0 1rem}
      .pc h2{font-size:22px;margin:1.75rem 0 .75rem}
      .pc h3{font-size:18px;margin:1.5rem 0 .5rem}
      .pc p{margin:0 0 1.4rem}
      .pc hr{border:none;border-top:.5px solid var(--color-border-tertiary);margin:2.5rem 0}
      .pc blockquote{border-left:2px solid var(--color-border-secondary);padding-left:1.25rem;margin:1.5rem 0;color:var(--color-text-secondary);font-style:italic}
      .ch{transition:border-color .2s,box-shadow .2s,transform .2s}
      .ch:hover{border-color:var(--color-border-secondary)!important;box-shadow:0 6px 20px rgba(44,24,16,.10)!important;transform:translateY(-2px)}
      .tb{background:none;border:.5px solid transparent;border-radius:4px;cursor:pointer;color:var(--color-text-secondary);font-family:var(--font-sans);height:30px;padding:0 8px;font-size:13px}
      .tb:hover{background:var(--color-background-primary);border-color:var(--color-border-tertiary)}
      button{font-family:var(--font-sans);font-size:13px;cursor:pointer;border:.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-secondary);padding:7px 16px;transition:background .15s,border-color .15s,color .15s;line-height:1}
      button:hover:not(:disabled){background:var(--color-background-secondary);border-color:var(--color-accent);color:var(--color-accent)}
      button:disabled{opacity:.45;cursor:not-allowed}
      button.primary{background:var(--color-accent);border-color:var(--color-accent);color:#fffdf8}
      button.primary:hover:not(:disabled){background:var(--color-accent-hover);border-color:var(--color-accent-hover);color:#fffdf8}
      input,textarea{font-family:var(--font-sans);font-size:14px;color:var(--color-text-primary);background:var(--color-background-primary);border:.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:9px 12px;outline:none;transition:border-color .15s;line-height:1.5;width:100%}
      input:focus,textarea:focus{border-color:var(--color-accent);box-shadow:0 0 0 2px rgba(139,105,20,.12)}
      input::placeholder,textarea::placeholder{color:var(--color-text-tertiary);font-style:italic}
      textarea{resize:vertical}
      .pc>p:first-child::first-letter{font-family:var(--font-serif);font-size:4.2em;font-weight:500;float:left;line-height:.82;margin:.06em .1em -.05em 0;color:var(--color-accent)}
      .orn-divider{display:flex;align-items:center;gap:12px;margin:1.75rem 0 2.5rem;color:var(--color-text-tertiary);font-size:13px;letter-spacing:.15em;text-align:center}
      .orn-divider::before,.orn-divider::after{content:'';flex:1;height:.5px;background:var(--color-border-tertiary)}
      .ck-editor-wrap .ck.ck-editor__main>.ck-editor__editable{min-height:420px;font-family:var(--font-serif)!important;font-size:17px!important;line-height:1.9!important;color:var(--color-text-primary)!important;background:var(--color-background-primary)!important;padding:2rem 2.5rem!important}
      .ck-editor-wrap .ck.ck-toolbar{background:var(--color-background-tertiary)!important;border-color:var(--color-border-tertiary)!important;border-radius:var(--border-radius-lg) var(--border-radius-lg) 0 0!important}
      .ck-editor-wrap .ck.ck-editor__main>.ck-editor__editable{border-color:var(--color-border-tertiary)!important;border-radius:0 0 var(--border-radius-lg) var(--border-radius-lg)!important}
      .ck-editor-wrap .ck.ck-editor__main>.ck-editor__editable.ck-focused{border-color:var(--color-accent)!important;box-shadow:0 0 0 2px rgba(139,105,20,.12)!important}
      .ck-editor-wrap .ck.ck-button{font-family:var(--font-sans)!important;color:var(--color-text-secondary)!important}
      .ck-editor-wrap .ck.ck-button:hover:not(.ck-disabled),.ck-editor-wrap .ck.ck-button.ck-on{background:var(--color-background-secondary)!important;color:var(--color-accent)!important}
    `;
    document.head.appendChild(s);
    getFingerprint().then(setFp);
    return () => document.head.removeChild(s);
  }, []);

  useEffect(() => { loadPosts(); }, []);

  async function loadPosts() {
    setLoading(true); setError(null);
    try { setPosts(await apiFetch("/posts")); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function deletePost(id) {
    await apiFetch(`/posts/${id}`, { method:"DELETE", headers:authHeaders() });
    setPosts(ps => ps.filter(p => p.id !== id));
    setScreen("admin");
  }

  async function savePost(post) {
    const isNew = !post.id;
    const saved = await apiFetch(isNew ? "/posts" : `/posts/${post.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: authHeaders(),
      body: JSON.stringify(post)
    });
    setPosts(ps => isNew ? [saved, ...ps] : ps.map(p => p.id === saved.id ? { ...p, ...saved } : p));
  }

  if (loading) return <Spinner />;
  if (error) return <ErrScreen msg={error} onRetry={loadPosts} />;

  return (
    <div style={{ fontFamily:"var(--font-serif)", minHeight:"100vh", background:"var(--color-background-tertiary)" }}>
      <Nav isAdmin={isAdmin}
        onGallery={() => setScreen("gallery")}
        onAdmin={() => setScreen(isAdmin ? "admin" : "login")}
        onLogout={() => { setIsAdmin(false); setScreen("gallery"); }}
      />
      {screen === "gallery" && <Gallery posts={posts} fp={fingerprint} onRead={p => { setPostInView(p); setScreen("read"); }} onPostsChange={setPosts} />}
      {screen === "read" && postInView && <ReadView postId={postInView.id} fp={fingerprint} isAdmin={isAdmin} onBack={() => setScreen("gallery")} onEdit={p => { setEditingPost(p); setScreen("editor"); }} onDelete={id => { if (confirm("Удалить работу?")) deletePost(id); }} />}
      {screen === "login" && <LoginView onLogin={() => { setIsAdmin(true); setScreen("admin"); }} />}
      {screen === "admin" && isAdmin && <AdminPanel posts={posts} onNew={() => { setEditingPost(null); setScreen("editor"); }} onEdit={p => { setEditingPost(p); setScreen("editor"); }} onDelete={id => { if (confirm("Удалить?")) deletePost(id); }} />}
      {screen === "editor" && isAdmin && <EditorView post={editingPost} onSave={async p => { await savePost(p); setScreen("admin"); }} onCancel={() => setScreen("admin")} />}
    </div>
  );
}

function Spinner() {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"var(--color-text-tertiary)", fontSize:"28px" }}>✦</div>;
}

function ErrScreen({ msg, onRetry }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:"1rem", fontFamily:"var(--font-sans)" }}>
      <div style={{ fontSize:"32px", opacity:.3 }}>✦</div>
      <div style={{ fontSize:"14px", color:"var(--color-text-secondary)" }}>Нет связи с сервером</div>
      <div style={{ fontSize:"12px", color:"var(--color-text-tertiary)", fontFamily:"var(--font-mono)", background:"var(--color-background-secondary)", padding:"6px 12px", borderRadius:"var(--border-radius-md)" }}>{msg}</div>
      <button onClick={onRetry}>Повторить</button>
    </div>
  );
}

function Nav({ isAdmin, onGallery, onAdmin, onLogout }) {
  return (
    <header style={{ borderBottom:"0.5px solid var(--color-border-tertiary)", background:"var(--color-background-primary)", padding:"0 2rem", display:"flex", alignItems:"center", justifyContent:"space-between", height:"64px", position:"sticky", top:0, zIndex:10, boxShadow:"0 1px 0 0 rgba(139,105,20,.08)" }}>
      <div onClick={onGallery} style={{ cursor:"pointer" }}>
        <div style={{ fontSize:"11px", letterSpacing:".3em", textTransform:"uppercase", color:"var(--color-accent)", fontFamily:"var(--font-sans)", marginBottom:"2px" }}>Литературный конкурс</div>
        <div style={{ fontFamily:"var(--font-serif)", fontSize:"22px", color:"var(--color-text-primary)" }}>Слово Дхармы</div>
      </div>
      <div style={{ display:"flex", gap:"1rem", alignItems:"center" }}>
        {isAdmin && <button onClick={onLogout} style={{ background:"none", border:"none", color:"var(--color-text-tertiary)" }}>Выйти</button>}
        <button onClick={onAdmin} style={{ color: isAdmin ? "var(--color-accent)" : "var(--color-text-secondary)" }}>
          {isAdmin ? "Панель" : "Войти"}
        </button>
      </div>
    </header>
  );
}

function Gallery({ posts, fp, onRead, onPostsChange }) {
  async function toggleLike(postId) {
    const { liked, count } = await apiFetch(`/posts/${postId}/like`, { method:"POST", body: JSON.stringify({ fingerprint: fp || await getFingerprint() }) });
    onPostsChange(ps => ps.map(p => p.id === postId ? { ...p, like_count: count } : p));
  }

  if (!posts.length) return (
    <div style={{ textAlign:"center", padding:"8rem 2rem", color:"var(--color-text-tertiary)" }}>
      <div style={{ fontSize:"40px", marginBottom:"1.5rem", opacity:.25 }}>✦</div>
      <div style={{ fontFamily:"var(--font-serif)", fontSize:"20px" }}>Работы участников появятся здесь</div>
    </div>
  );

  return (
    <div style={{ maxWidth:"1140px", margin:"0 auto", padding:"3.5rem 2rem" }}>
      <div style={{ marginBottom:"2.5rem" }}>
        <div style={{ fontFamily:"var(--font-sans)", fontSize:"11px", letterSpacing:".2em", textTransform:"uppercase", color:"var(--color-accent)", marginBottom:".5rem" }}>
          {posts.length} {plural(posts.length, ["работа","работы","работ"])} на конкурсе
        </div>
        <div style={{ height:"1px", background:"linear-gradient(to right, transparent, var(--color-border-secondary), transparent)" }} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"1.5rem" }}>
        {posts.map(p => <PostCard key={p.id} post={p} onRead={onRead} onLike={() => toggleLike(p.id)} />)}
      </div>
    </div>
  );
}

function PostCard({ post, onRead, onLike }) {
  const cover = post.cover_image_id ? `${API}/files/${post.cover_image_id}` : null;
  return (
    <div className="ch" style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 2px 8px rgba(44,24,16,.06)" }}>
      {cover
        ? <img src={cover} alt="" style={{ width:"100%", height:"160px", objectFit:"cover", display:"block", cursor:"pointer" }} onClick={() => onRead(post)} />
        : <div style={{ height:"5px", background: post.accent_color || "#7B3F00" }} />
      }
      <div style={{ padding:"1.5rem", flex:1, cursor:"pointer" }} onClick={() => onRead(post)}>
        {post.genre && <div style={{ fontFamily:"var(--font-sans)", fontSize:"10px", letterSpacing:".2em", textTransform:"uppercase", color:"var(--color-text-tertiary)", marginBottom:".75rem" }}>{post.genre}</div>}
        <h2 style={{ fontFamily:"var(--font-serif)", fontSize:"21px", fontWeight:"400", margin:"0 0 .4rem", lineHeight:"1.25", color:"var(--color-text-primary)" }}>{post.title}</h2>
        <div style={{ fontFamily:"var(--font-sans)", fontSize:"12px", color:"var(--color-text-tertiary)", marginBottom:"1rem" }}>{post.author} · {fmtDate(post.created_at)}</div>
        <p style={{ fontFamily:"var(--font-serif)", fontSize:"15px", lineHeight:"1.7", color:"var(--color-text-secondary)", margin:0 }}>{stripHtml(post.content, 180)}</p>
      </div>
      <div style={{ padding:".75rem 1.5rem", borderTop:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:"8px" }}>
        <button onClick={e => { e.stopPropagation(); onLike(); }} style={{ background:"none", border:"none", fontSize:"16px", color:"var(--color-text-tertiary)", padding:"2px", lineHeight:1, transition:"color .15s" }}>♡</button>
        <span style={{ fontFamily:"var(--font-sans)", fontSize:"12px", color:"var(--color-text-tertiary)" }}>{post.like_count || 0}</span>
        <span style={{ marginLeft:"auto", fontFamily:"var(--font-sans)", fontSize:"12px", color:"var(--color-accent)", letterSpacing:".05em", cursor:"pointer" }} onClick={() => onRead(post)}>Читать →</span>
      </div>
    </div>
  );
}

function ReadView({ postId, fp, isAdmin, onBack, onEdit, onDelete }) {
  const [post, setPost]         = useState(null);
  const [comments, setComments] = useState([]);
  const [liked, setLiked]       = useState(false);
  const [count, setCount]       = useState(0);
  const [name, setName]         = useState("");
  const [text, setText]         = useState("");
  const [busy, setBusy]         = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const fingerprint = fp || await getFingerprint();
      const [p, comms, likeData] = await Promise.all([
        apiFetch(`/posts/${postId}`),
        apiFetch(`/posts/${postId}/comments`),
        apiFetch(`/posts/${postId}/likes?fingerprint=${fingerprint}`)
      ]);
      setPost(p); setComments(comms); setLiked(likeData.liked); setCount(likeData.count);
      setLoading(false);
    })();
  }, [postId]);

  async function toggleLike() {
    const fingerprint = fp || await getFingerprint();
    const data = await apiFetch(`/posts/${postId}/like`, { method:"POST", body: JSON.stringify({ fingerprint }) });
    setLiked(data.liked); setCount(data.count);
  }

  async function submitComment() {
    if (!name.trim() || !text.trim()) return;
    setBusy(true);
    const c = await apiFetch(`/posts/${postId}/comments`, { method:"POST", body: JSON.stringify({ author: name.trim(), content: text.trim() }) });
    setComments(cs => [...cs, c]);
    setName(""); setText(""); setBusy(false);
  }

  if (loading || !post) return <Spinner />;

  const cover = post.cover_image_id ? `${API}/files/${post.cover_image_id}` : null;

  return (
    <div style={{ maxWidth:"680px", margin:"0 auto", padding:"2.5rem 2rem 6rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"2.5rem" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"var(--font-sans)", fontSize:"13px", color:"var(--color-text-tertiary)", padding:0 }}>← Все работы</button>
        {isAdmin && (
          <div style={{ display:"flex", gap:"1rem" }}>
            <button onClick={() => onEdit(post)} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"var(--font-sans)", fontSize:"13px", color:"var(--color-text-secondary)" }}>Изменить</button>
            <button onClick={() => onDelete(post.id)} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"var(--font-sans)", fontSize:"13px", color:"var(--color-text-danger)" }}>Удалить</button>
          </div>
        )}
      </div>

      {cover && <img src={cover} alt="" style={{ width:"100%", maxHeight:"360px", objectFit:"cover", borderRadius:"var(--border-radius-lg)", marginBottom:"3rem", display:"block", boxShadow:"0 4px 20px rgba(44,24,16,.12)" }} />}
      {post.genre && <div style={{ fontFamily:"var(--font-sans)", fontSize:"10px", letterSpacing:".25em", textTransform:"uppercase", color:"var(--color-accent)", fontWeight:"500", marginBottom:".75rem" }}>{post.genre}</div>}
      <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"42px", fontWeight:"400", lineHeight:"1.2", margin:"0 0 .75rem", color:"var(--color-text-primary)" }}>{post.title}</h1>

      <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"0" }}>
        <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:"var(--color-accent)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fffdf8", fontFamily:"var(--font-sans)", fontSize:"13px", fontWeight:"500", flexShrink:0 }}>
          {post.author?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontFamily:"var(--font-sans)", fontSize:"14px", color:"var(--color-text-primary)", fontWeight:"500" }}>{post.author}</div>
          <div style={{ fontFamily:"var(--font-sans)", fontSize:"12px", color:"var(--color-text-tertiary)" }}>{fmtDate(post.created_at)}</div>
        </div>
      </div>

      <div className="orn-divider">✦</div>

      <div className="pc" style={{ fontFamily:"var(--font-serif)", fontSize:"18px", lineHeight:"1.9", color:"var(--color-text-primary)" }} dangerouslySetInnerHTML={{ __html: post.content }} />

      <div style={{ marginTop:"3.5rem", paddingTop:"2rem", borderTop:"1px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:"1rem" }}>
        <button onClick={toggleLike} style={{ background:"none", border:`0.5px solid ${liked ? "var(--color-border-danger)" : "var(--color-border-secondary)"}`, borderRadius:"100px", padding:"8px 20px", color: liked ? "var(--color-text-danger)" : "var(--color-text-secondary)", fontFamily:"var(--font-sans)", fontSize:"14px", display:"flex", alignItems:"center", gap:"8px" }}>
          <span>{liked ? "♥" : "♡"}</span>{liked ? "Нравится" : "Отметить"}
        </button>
        <span style={{ fontFamily:"var(--font-sans)", fontSize:"13px", color:"var(--color-text-tertiary)" }}>{count} {plural(count, ["отметка","отметки","отметок"])}</span>
      </div>

      <div style={{ marginTop:"4rem" }}>
        <div style={{ fontFamily:"var(--font-sans)", fontSize:"11px", letterSpacing:".2em", textTransform:"uppercase", color:"var(--color-text-tertiary)", marginBottom:"2rem" }}>Комментарии · {comments.length}</div>
        {comments.map(c => (
          <div key={c.id} style={{ marginBottom:"2rem", paddingBottom:"2rem", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:".75rem" }}>
              <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"var(--color-background-secondary)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-sans)", fontSize:"12px", fontWeight:"500", color:"var(--color-text-secondary)", flexShrink:0 }}>{c.author[0].toUpperCase()}</div>
              <span style={{ fontFamily:"var(--font-sans)", fontSize:"13px", fontWeight:"500", color:"var(--color-text-primary)" }}>{c.author}</span>
              <span style={{ fontFamily:"var(--font-sans)", fontSize:"12px", color:"var(--color-text-tertiary)" }}>{fmtDate(c.created_at)}</span>
            </div>
            <p style={{ fontFamily:"var(--font-serif)", fontSize:"16px", lineHeight:"1.7", margin:0, paddingLeft:"38px", color:"var(--color-text-secondary)" }}>{c.content}</p>
          </div>
        ))}
        <div style={{ marginTop:"2rem", background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"1.5rem", boxShadow:"0 2px 8px rgba(44,24,16,.05)" }}>
          <div style={{ fontFamily:"var(--font-sans)", fontSize:"13px", color:"var(--color-text-secondary)", marginBottom:"1rem", fontWeight:"500" }}>Оставить комментарий</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" style={{ width:"100%", marginBottom:".75rem", boxSizing:"border-box" }} />
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Поделитесь впечатлениями..." rows={4} style={{ width:"100%", boxSizing:"border-box", resize:"vertical", fontFamily:"var(--font-serif)", fontSize:"16px" }} />
          <button onClick={submitComment} className="primary" disabled={busy || !name.trim() || !text.trim()} style={{ marginTop:".75rem" }}>{busy ? "Публикуем…" : "Опубликовать →"}</button>
        </div>
      </div>
    </div>
  );
}

function LoginView({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  function attempt() {
    if (pw === ADMIN_PASSWORD) { onLogin(); }
    else { setErr(true); setPw(""); setTimeout(() => setErr(false), 2500); }
  }
  return (
    <div style={{ maxWidth:"400px", margin:"8rem auto", padding:"2.5rem", textAlign:"center", background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", boxShadow:"0 4px 24px rgba(44,24,16,.08)" }}>
      <div style={{ fontSize:"32px", color:"var(--color-text-tertiary)", marginBottom:"1.5rem", opacity:.4 }}>✦</div>
      <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"28px", fontWeight:"400", margin:"0 0 2rem", color:"var(--color-text-primary)" }}>Вход для администратора</h1>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && attempt()} placeholder="Пароль" style={{ width:"100%", boxSizing:"border-box", borderColor: err ? "var(--color-border-danger)" : undefined }} autoFocus />
      {err && <div style={{ fontFamily:"var(--font-sans)", fontSize:"13px", color:"var(--color-text-danger)", marginTop:".5rem" }}>Неверный пароль</div>}
      <button onClick={attempt} className="primary" style={{ marginTop:"1rem", width:"100%" }}>Войти</button>
    </div>
  );
}

function AdminPanel({ posts, onNew, onEdit, onDelete }) {
  return (
    <div style={{ maxWidth:"800px", margin:"0 auto", padding:"3rem 2rem" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"2.5rem" }}>
        <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"28px", fontWeight:"400", margin:0, color:"var(--color-text-primary)" }}>Панель администратора</h1>
        <button onClick={onNew} className="primary">+ Новая работа</button>
      </div>
      {!posts.length
        ? <div style={{ textAlign:"center", padding:"4rem 0", color:"var(--color-text-tertiary)", fontFamily:"var(--font-sans)", fontSize:"14px" }}>Нажмите «+ Новая работа» чтобы опубликовать первое произведение</div>
        : <div style={{ display:"flex", flexDirection:"column", gap:".5rem" }}>
            {posts.map(p => (
              <div key={p.id} style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-md)", padding:"1rem 1.25rem", display:"flex", alignItems:"center", gap:"1rem" }}>
                {p.cover_image_id
                  ? <img src={`${API}/files/${p.cover_image_id}`} alt="" style={{ width:"44px", height:"44px", objectFit:"cover", borderRadius:"4px", flexShrink:0 }} />
                  : <div style={{ width:"4px", height:"44px", borderRadius:"2px", background: p.accent_color || "#7B3F00", flexShrink:0 }} />
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"var(--font-serif)", fontSize:"16px", color:"var(--color-text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                  <div style={{ fontFamily:"var(--font-sans)", fontSize:"12px", color:"var(--color-text-tertiary)", marginTop:"2px" }}>{p.author} · ♥ {p.like_count || 0} · 💬 {p.comment_count || 0}</div>
                </div>
                <div style={{ display:"flex", gap:".5rem", flexShrink:0 }}>
                  <button onClick={() => onEdit(p)} style={{ fontFamily:"var(--font-sans)", fontSize:"12px" }}>Изменить</button>
                  <button onClick={() => onDelete(p.id)} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"var(--font-sans)", fontSize:"12px", color:"var(--color-text-danger)" }}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

function EditorView({ post, onSave, onCancel }) {
  const [title, setTitle]   = useState(post?.title || "");
  const [author, setAuthor] = useState(post?.author || "");
  const [genre, setGenre]   = useState(post?.genre || "");
  const [accent, setAccent] = useState(post?.accent_color || ACCENT_COLORS[0]);
  const [coverId, setCoverId]     = useState(post?.cover_image_id || null);
  const [coverPreview, setPreview] = useState(post?.cover_image_id ? `${API}/files/${post.cover_image_id}` : null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [content, setContent]     = useState(post?.content || "");
  const fileRef   = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/upload`, { method:"POST", headers: authHeaders(), body: form });
      if (!res.ok) throw new Error((await res.json()).error || "Ошибка");
      const { id } = await res.json();
      setCoverId(id);
    } catch (err) {
      alert("Не удалось загрузить: " + err.message);
      setPreview(null); setCoverId(null);
    } finally { setUploading(false); }
  }

  function removeCover() { setCoverId(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }

  async function handleSave() {
    if (!title.trim() || !author.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: post?.id, title: title.trim(), author: author.trim(), genre: genre.trim(), accent_color: accent, cover_image_id: coverId || null, content });
    } finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth:"820px", margin:"0 auto", padding:"2.5rem 2rem 6rem" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"2rem" }}>
        <h1 style={{ fontFamily:"var(--font-serif)", fontSize:"24px", fontWeight:"400", margin:0, color:"var(--color-text-primary)" }}>{post ? "Редактировать работу" : "Новая работа"}</h1>
        <div style={{ display:"flex", gap:".75rem" }}>
          <button onClick={onCancel} style={{ background:"none" }}>Отмена</button>
          <button onClick={handleSave} className="primary" disabled={saving || uploading || !title.trim() || !author.trim()}>{saving ? "Сохраняем…" : "Опубликовать"}</button>
        </div>
      </div>

      {/* Обложка */}
      <div style={{ marginBottom:"1.5rem" }}>
        <label style={{ fontFamily:"var(--font-sans)", fontSize:"11px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--color-text-tertiary)", display:"block", marginBottom:"8px" }}>Обложка</label>
        {coverPreview ? (
          <div style={{ position:"relative", display:"inline-block" }}>
            <img src={coverPreview} alt="" style={{ maxHeight:"200px", maxWidth:"100%", borderRadius:"var(--border-radius-md)", display:"block", objectFit:"cover" }} />
            {uploading
              ? <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.4)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"var(--border-radius-md)", color:"#fff", fontFamily:"var(--font-sans)", fontSize:"13px" }}>Загружаем…</div>
              : <button onClick={removeCover} style={{ position:"absolute", top:"8px", right:"8px", background:"rgba(0,0,0,.5)", border:"none", color:"#fff", borderRadius:"50%", width:"24px", height:"24px", cursor:"pointer", fontSize:"16px", lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            }
          </div>
        ) : (
          <label style={{ display:"inline-flex", alignItems:"center", gap:"8px", cursor:"pointer", border:"0.5px dashed var(--color-border-secondary)", borderRadius:"var(--border-radius-md)", padding:"12px 20px", fontFamily:"var(--font-sans)", fontSize:"13px", color:"var(--color-text-secondary)", background:"var(--color-background-primary)" }}>
            + Загрузить обложку
            <span style={{ fontSize:"11px", color:"var(--color-text-tertiary)" }}>(JPEG · PNG · WebP · макс. 8 МБ)</span>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />
          </label>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1rem" }}>
        <div>
          <label style={{ fontFamily:"var(--font-sans)", fontSize:"11px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--color-text-tertiary)", display:"block", marginBottom:"6px" }}>Название *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Заголовок произведения" style={{ width:"100%", boxSizing:"border-box" }} />
        </div>
        <div>
          <label style={{ fontFamily:"var(--font-sans)", fontSize:"11px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--color-text-tertiary)", display:"block", marginBottom:"6px" }}>Автор *</label>
          <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Имя автора" style={{ width:"100%", boxSizing:"border-box" }} />
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"1rem", marginBottom:"1.5rem", alignItems:"end" }}>
        <div>
          <label style={{ fontFamily:"var(--font-sans)", fontSize:"11px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--color-text-tertiary)", display:"block", marginBottom:"6px" }}>Жанр</label>
          <input value={genre} onChange={e => setGenre(e.target.value)} placeholder="Стихотворение, рассказ, эссе…" style={{ width:"100%", boxSizing:"border-box" }} />
        </div>
        <div>
          <label style={{ fontFamily:"var(--font-sans)", fontSize:"11px", letterSpacing:".1em", textTransform:"uppercase", color:"var(--color-text-tertiary)", display:"block", marginBottom:"6px" }}>Акцент</label>
          <div style={{ display:"flex", gap:"6px" }}>
            {ACCENT_COLORS.map(c => <div key={c} onClick={() => setAccent(c)} style={{ width:"22px", height:"22px", borderRadius:"50%", background:c, cursor:"pointer", flexShrink:0, outline: accent === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset:"2px" }} />)}
          </div>
        </div>
      </div>

      <div className="ck-editor-wrap">
        <CKEditor
          editor={ClassicEditor}
          data={content}
          config={{
            toolbar: [
              "heading", "|",
              "bold", "italic", "underline", "|",
              "blockQuote", "horizontalLine", "|",
              "alignment", "|",
              "bulletedList", "numberedList", "|",
              "undo", "redo"
            ],
            heading: {
              options: [
                { model: "paragraph", title: "Абзац", class: "ck-heading_paragraph" },
                { model: "heading2", view: "h2", title: "Заголовок", class: "ck-heading_heading2" },
                { model: "heading3", view: "h3", title: "Подзаголовок", class: "ck-heading_heading3" },
              ]
            },
            placeholder: "Начните вводить текст произведения…",
          }}
          onChange={(_, editor) => setContent(editor.getData())}
        />
      </div>
    </div>
  );
}