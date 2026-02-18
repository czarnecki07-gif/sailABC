// Frontend-only login (GitHub Pages).
// Uwaga: to nie jest zabezpieczenie „jak w banku” bez backendu.
// Działa: hasło -> sesja w localStorage.

const AUTH_KEY = "sailabc_admin_auth_v1";
const STORE_KEY = "sailabc_admin_store_v1";

// ZMIENIASZ TE DANE:
const ADMIN_USER = "admin";

// Hasło ustaw tutaj (prosto, bez kombinacji).
// Jeśli chcesz „lepiej”: powiedz, to zrobię wersję z hash (SHA-256) w przeglądarce.
const ADMIN_PASS = "ZMIEN_TO_HASLO";

const loginCard = document.getElementById("loginCard");
const appCard = document.getElementById("appCard");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const logoutBtn = document.getElementById("logoutBtn");

const contentKey = document.getElementById("contentKey");
const contentValue = document.getElementById("contentValue");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const exportBtn = document.getElementById("exportBtn");
const saveMsg = document.getElementById("saveMsg");

function isAuthed() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

function setAuthed(v) {
  localStorage.setItem(AUTH_KEY, v ? "1" : "0");
}

function showApp() {
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
}

function showLogin() {
  appCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
}

function getStore() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function setStore(obj) {
  localStorage.setItem(STORE_KEY, JSON.stringify(obj, null, 2));
}

if (isAuthed()) showApp();

loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  loginMsg.textContent = "";

  const u = document.getElementById("user").value.trim();
  const p = document.getElementById("pass").value;

  if (u === ADMIN_USER && p === ADMIN_PASS) {
    setAuthed(true);
    showApp();
  } else {
    setAuthed(false);
    loginMsg.textContent = "Błędny login lub hasło.";
  }
});

logoutBtn?.addEventListener("click", () => {
  setAuthed(false);
  showLogin();
});

saveBtn?.addEventListener("click", () => {
  saveMsg.textContent = "";
  const key = (contentKey.value || "").trim();
  if (!key) { saveMsg.textContent = "Brak klucza."; return; }

  const store = getStore();
  store[key] = contentValue.value;
  setStore(store);

  saveMsg.textContent = "Zapisano lokalnie.";
});

loadBtn?.addEventListener("click", () => {
  saveMsg.textContent = "";
  const key = (contentKey.value || "").trim();
  if (!key) { saveMsg.textContent = "Brak klucza."; return; }

  const store = getStore();
  contentValue.value = store[key] ?? "";
  saveMsg.textContent = "Wczytano.";
});

exportBtn?.addEventListener("click", () => {
  const store = getStore();
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sailabc-admin-export.json";
  a.click();
  URL.revokeObjectURL(url);
});
