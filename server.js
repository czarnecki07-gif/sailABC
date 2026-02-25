import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import fs from "fs";
import cors from "cors";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== ADMIN (NA STAŁE) ======
const ADMIN_EMAILS = ["wgc@world24.pl"];

// ====== DB ======
const DB_PATH = path.join(__dirname, "data", "sailabc.sqlite");

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(DB_PATH);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entitlements (
    user_id INTEGER PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'demo',
    expires_at INTEGER,
    note TEXT,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const stmtGetUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const stmtCreateUser = db.prepare("INSERT INTO users(email, pass_hash, created_at) VALUES(?,?,?)");
const stmtGetEnt = db.prepare("SELECT * FROM entitlements WHERE user_id = ?");
const stmtUpsertEnt = db.prepare(`
  INSERT INTO entitlements(user_id, plan, expires_at, note, updated_at)
  VALUES(@user_id, @plan, @expires_at, @note, @updated_at)
  ON CONFLICT(user_id) DO UPDATE SET
    plan=excluded.plan,
    expires_at=excluded.expires_at,
    note=excluded.note,
    updated_at=excluded.updated_at
`);

app.set("trust proxy", 1);

// GitHub Pages -> API (cross-origin)
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json());

app.use(
  session({
    name: "sailabc_sid",
    secret: "SUPER_SECRET_CHANGE_THIS",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // ważne dla GitHub Pages -> onrender (cross-site cookies)
      sameSite: "none",
      secure: true
    }
  })
);

// statyki (jeśli chcesz też serwować stronę z tego samego serwera)
app.use(express.static(__dirname, { extensions: ["html"] }));

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function nowMs() {
  return Date.now();
}

function requireAuth(req, res, next) {
  if (!req.session?.uid) return res.status(401).json({ error: "Brak sesji." });
  next();
}

function requireAdmin(req, res, next) {
  const email = normalizeEmail(req.session?.email);
  if (!ADMIN_EMAILS.includes(email)) return res.status(403).json({ error: "Brak uprawnień admina." });
  next();
}

// ===== AUTH =====

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email) return res.status(400).json({ error: "Brak email." });
    if (!password || password.length < 8) return res.status(400).json({ error: "Hasło min. 8 znaków." });

    if (stmtGetUserByEmail.get(email)) return res.status(409).json({ error: "Konto istnieje." });

    const pass_hash = await bcrypt.hash(password, 12);
    const created_at = nowMs();
    const info = stmtCreateUser.run(email, pass_hash, created_at);

    stmtUpsertEnt.run({
      user_id: info.lastInsertRowid,
      plan: "demo",
      expires_at: null,
      note: "auto",
      updated_at: nowMs()
    });

    req.session.uid = info.lastInsertRowid;
    req.session.email = email;

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Błąd rejestracji." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    const user = stmtGetUserByEmail.get(email);
    if (!user) return res.status(401).json({ error: "Błędne dane." });

    const ok = await bcrypt.compare(password, user.pass_hash);
    if (!ok) return res.status(401).json({ error: "Błędne dane." });

    req.session.uid = user.id;
    req.session.email = user.email;

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Błąd logowania." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sailabc_sid");
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session?.uid) return res.json({ authenticated: false, plan: "demo" });

  const ent = stmtGetEnt.get(req.session.uid);
  let plan = ent?.plan || "demo";
  const expiresAt = ent?.expires_at || null;

  if (plan === "pro" && expiresAt && nowMs() > expiresAt) plan = "demo";

  res.json({
    authenticated: true,
    email: req.session.email,
    plan,
    expiresAt
  });
});

// ===== ADMIN =====

app.post("/api/admin/set-plan", requireAuth, requireAdmin, (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const plan = String(req.body?.plan || "demo");
    const expiresAt = req.body?.expiresAt ?? null;

    const user = stmtGetUserByEmail.get(email);
    if (!user) return res.status(404).json({ error: "Nie znaleziono użytkownika." });

    stmtUpsertEnt.run({
      user_id: user.id,
      plan,
      expires_at: expiresAt,
      note: "admin",
      updated_at: nowMs()
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Błąd admin." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`sailABC API działa na porcie ${PORT}`));
