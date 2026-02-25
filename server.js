import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import bcrypt from "bcrypt";
import Database from "better-sqlite3";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== CONFIG ======
const SESSION_SECRET = process.env.SAILABC_SESSION_SECRET || "CHANGE_ME__VERY_LONG_RANDOM_SECRET";
const DB_PATH = process.env.SAILABC_DB_PATH || path.join(__dirname, "data", "sailabc.sqlite");

// ====== DB INIT ======
function ensureDir(p) {
  try {
    const fs = require("fs");
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
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
    plan TEXT NOT NULL DEFAULT 'demo',   -- demo|tester|pro
    expires_at INTEGER,                 -- null = bezterminowo (np. tester)
    note TEXT,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tester_allowlist (
    email TEXT PRIMARY KEY,
    added_at INTEGER NOT NULL,
    note TEXT
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
const stmtIsTester = db.prepare("SELECT email FROM tester_allowlist WHERE email = ?");

// ====== MIDDLEWARE ======
app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    name: "sailabc_sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false // ustaw true jeśli masz HTTPS
    }
  })
);

// Serwuj statyczne pliki portalu (index.html, style.css, weather.js, logo.png...)
app.use(express.static(__dirname, { extensions: ["html"] }));

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function nowMs() {
  return Date.now();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getUserSession(req) {
  const uid = req.session?.uid;
  const email = req.session?.email;
  if (!uid || !email) return null;
  return { id: uid, email };
}

function computePlanForUser(email, entRow) {
  // jeżeli mail jest w allowliście testerów -> co najmniej tester
  const tester = !!stmtIsTester.get(email);

  if (!entRow) {
    return tester
      ? { plan: "tester", expiresAt: null, source: "allowlist" }
      : { plan: "demo", expiresAt: null, source: "default" };
  }

  const plan = String(entRow.plan || "demo");
  const expiresAt = entRow.expires_at == null ? null : Number(entRow.expires_at);

  // jeśli PRO wygasło -> spada do tester/demo
  if (plan === "pro" && expiresAt && nowMs() > expiresAt) {
    return tester
      ? { plan: "tester", expiresAt: null, source: "expired->allowlist" }
      : { plan: "demo", expiresAt: null, source: "expired->default" };
  }

  // jeśli plan demo, a jest tester allowlist -> tester
  if (plan === "demo" && tester) {
    return { plan: "tester", expiresAt: null, source: "allowlist-override" };
  }

  return { plan, expiresAt: expiresAt || null, source: "entitlements" };
}

function requireAuth(req, res, next) {
  const u = getUserSession(req);
  if (!u) return res.status(401).json({ error: "Brak sesji. Zaloguj się." });
  next();
}

function requireAdmin(req, res, next) {
  // PROSTE: admin po env. Możesz to później podpiąć pod rolę w DB.
  const u = getUserSession(req);
  if (!u) return res.status(401).json({ error: "Brak sesji." });

  const admins = String(process.env.SAILABC_ADMINS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  if (!admins.includes(u.email)) return res.status(403).json({ error: "Brak uprawnień admina." });
  next();
}

// ====== AUTH API ======
app.post("/api/auth/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !isValidEmail(email)) return res.status(400).json({ error: "Nieprawidłowy email." });
    if (!password || password.length < 8) return res.status(400).json({ error: "Hasło min. 8 znaków." });

    const existing = stmtGetUserByEmail.get(email);
    if (existing) return res.status(409).json({ error: "Konto już istnieje." });

    const pass_hash = await bcrypt.hash(password, 12);
    const created_at = nowMs();
    const info = stmtCreateUser.run(email, pass_hash, created_at);

    // domyślne entitlements (demo) — allowlist podniesie do tester w /api/me
    stmtUpsertEnt.run({
      user_id: info.lastInsertRowid,
      plan: "demo",
      expires_at: null,
      note: "auto",
      updated_at: nowMs()
    });

    req.session.uid = info.lastInsertRowid;
    req.session.email = email;

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Błąd serwera (register)." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !isValidEmail(email)) return res.status(400).json({ error: "Nieprawidłowy email." });
    if (!password) return res.status(400).json({ error: "Brak hasła." });

    const user = stmtGetUserByEmail.get(email);
    if (!user) return res.status(401).json({ error: "Błędny email lub hasło." });

    const ok = await bcrypt.compare(password, user.pass_hash);
    if (!ok) return res.status(401).json({ error: "Błędny email lub hasło." });

    req.session.uid = user.id;
    req.session.email = user.email;

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Błąd serwera (login)." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  try {
    req.session.destroy(() => {
      res.clearCookie("sailabc_sid");
      return res.json({ ok: true });
    });
  } catch {
    return res.status(500).json({ error: "Błąd serwera (logout)." });
  }
});

app.get("/api/me", (req, res) => {
  try {
    const u = getUserSession(req);
    if (!u) {
      return res.json({
        authenticated: false,
        email: null,
        plan: "demo",
        expiresAt: null
      });
    }

    const ent = stmtGetEnt.get(u.id);
    const computed = computePlanForUser(u.email, ent);

    return res.json({
      authenticated: true,
      email: u.email,
      plan: computed.plan,
      expiresAt: computed.expiresAt
    });
  } catch (e) {
    return res.status(500).json({ error: "Błąd serwera (me)." });
  }
});

// Admin: ustaw plan użytkownika (np. po płatności / ręcznie)
app.post("/api/admin/set-plan", requireAuth, requireAdmin, (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const plan = String(req.body?.plan || "").trim();
    const expiresAt = req.body?.expiresAt == null ? null : Number(req.body.expiresAt);
    const note = String(req.body?.note || "").trim();

    if (!email || !isValidEmail(email)) return res.status(400).json({ error: "Nieprawidłowy email." });
    if (!["demo", "tester", "pro"].includes(plan)) return res.status(400).json({ error: "Nieprawidłowy plan." });
    if (expiresAt != null && !Number.isFinite(expiresAt)) return res.status(400).json({ error: "Nieprawidłowe expiresAt." });

    const user = stmtGetUserByEmail.get(email);
    if (!user) return res.status(404).json({ error: "Nie znaleziono użytkownika." });

    stmtUpsertEnt.run({
      user_id: user.id,
      plan,
      expires_at: expiresAt,
      note: note || "admin",
      updated_at: nowMs()
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Błąd serwera (set-plan)." });
  }
});

// Admin: dodaj testera do allowlisty
app.post("/api/admin/add-tester", requireAuth, requireAdmin, (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const note = String(req.body?.note || "").trim();
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: "Nieprawidłowy email." });

    db.prepare(
      "INSERT INTO tester_allowlist(email, added_at, note) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET note=excluded.note"
    ).run(email, nowMs(), note || null);

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Błąd serwera (add-tester)." });
  }
});

// ====== WEATHER HELPERS (bez zmian) ======
function msToBeaufort(ms) {
  // Progi (m/s) Beaufort 0–12
  const limits = [0.5, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  let b = 0;
  while (b < limits.length && ms >= limits[b]) b++;
  return b; // 0..12
}

function degToCompass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const i = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[i];
}

/**
 * Geocode (Nominatim / OpenStreetMap) — przez backend:
 * - omija CORS
 * - trzymasz jeden origin (Twoja domena)
 */
app.get("/api/geocode", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Brak parametru q." });

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    const r = await fetch(url.toString(), {
      headers: {
        "User-Agent": "sailABC-weather/1.0 (contact: kontakt@sailabc.com)"
      }
    });

    if (!r.ok) return res.status(502).json({ error: "Błąd geokodowania (upstream)." });

    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      return res.status(404).json({ error: "Nie znaleziono miejsca. Spróbuj doprecyzować." });
    }

    const item = arr[0];
    const lat = Number(item.lat);
    const lon = Number(item.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(502).json({ error: "Geokodowanie zwróciło nieprawidłowe współrzędne." });
    }

    return res.json({
      display_name: item.display_name,
      lat,
      lon,
      suggested_zoom: 12
    });
  } catch (e) {
    return res.status(500).json({ error: "Błąd serwera (geocode)." });
  }
});

app.get("/api/weather", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: "Nieprawidłowe lat/lon." });
    }

    // Open-Meteo (bez klucza) — aktualne warunki
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current", "temperature_2m,wind_speed_10m,wind_direction_10m,weather_code");
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("timezone", "Europe/Warsaw");

    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "Błąd po stronie API pogody." });

    const data = await r.json();
    const cur = data.current;

    const windMs = cur.wind_speed_10m;
    const windDir = cur.wind_direction_10m;

    return res.json({
      location: { lat, lon },
      current: {
        temperature_c: cur.temperature_2m,
        wind_ms: windMs,
        wind_beaufort: msToBeaufort(windMs),
        wind_dir_deg: windDir,
        wind_dir_compass: degToCompass(windDir),
        weather_code: cur.weather_code,
        time_local: cur.time
      }
    });
  } catch (e) {
    return res.status(500).json({ error: "Błąd serwera (weather)." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`sailABC działa na http://localhost:${PORT}`));
