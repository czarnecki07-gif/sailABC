// access.js — prosty system dostępu (DEMO/PRO) bez backendu
// Wersja startowa: "klucz" porównywany do listy hashy w kodzie.
// Później podmienimy na prawdziwą weryfikację serwerową.

const ACCESS_KEY = "sailabc_access_v1";

// Prosta lista dozwolonych kluczy (na start).
// Docelowo: generowanie per-zamówienie i weryfikacja na serwerze.
const VALID_KEYS = [
  "SAILABC-PRO-2026-TEST" // <- na start, zmienisz później
];

export function getAccess() {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data?.tier === "pro" && data?.key && VALID_KEYS.includes(data.key)) {
      return { tier: "pro" };
    }
    return { tier: "demo" };
  } catch {
    return { tier: "demo" };
  }
}

export function setProKey(key) {
  const k = String(key || "").trim().toUpperCase();
  if (!VALID_KEYS.includes(k)) return false;
  localStorage.setItem(ACCESS_KEY, JSON.stringify({ tier: "pro", key: k, ts: Date.now() }));
  return true;
}

export function clearAccess() {
  localStorage.removeItem(ACCESS_KEY);
}
