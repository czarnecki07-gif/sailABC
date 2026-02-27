// access.js — najprościej: DEMO vs PRO
// - PRO wymaga zalogowania i planu "pro" z API
// - działa na GitHub Pages (API na Render)
// - offline: jeśli ostatnio było PRO, wpuszcza przez 14 dni (grace)

(() => {
  const API = "https://sailabc.onrender.com";
  const CACHE_KEY = "sailabc_plan_cache_v1"; // { plan, cachedAt }
  const GRACE_DAYS = 14;

  const nowMs = () => Date.now();
  const daysToMs = (d) => d * 24 * 60 * 60 * 1000;

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeCache(plan) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ plan, cachedAt: nowMs() }));
    } catch {}
  }

  function cacheAllowsPro() {
    const c = readCache();
    if (!c || c.plan !== "pro" || !c.cachedAt) return false;
    const age = nowMs() - Number(c.cachedAt);
    return age >= 0 && age <= daysToMs(GRACE_DAYS);
  }

  let state = {
    loaded: false,
    authenticated: false,
    plan: "demo"
  };

  function isPro() {
    if (state.loaded) return state.plan === "pro";
    return cacheAllowsPro();
  }

  function setBadge() {
    const badge = document.querySelector("[data-pro-badge]");
    if (!badge) return;
    badge.textContent = isPro() ? "PRO" : "DEMO";
  }

  function ensureModal() {
    let modal = document.getElementById("accessModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "accessModal";
    modal.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      display:none; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.6); padding:16px;
    `;

    modal.innerHTML = `
      <div style="
        width:min(560px, 100%);
        background:rgba(15,26,47,0.98);
        border:1px solid rgba(255,255,255,0.14);
        border-radius:18px;
        box-shadow:0 20px 60px rgba(0,0,0,0.55);
        padding:16px;
        color:rgba(255,255,255,0.92);
      ">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
          <div>
            <div style="font-weight:900; font-size:18px;">To narzędzie jest w wersji PRO</div>
            <div style="margin-top:8px; color:rgba(255,255,255,0.72); line-height:1.45;">
              Zaloguj się, aby korzystać z wersji PRO.
            </div>
          </div>
          <button type="button" id="accessModalClose" style="
            border:1px solid rgba(255,255,255,0.16);
            background:rgba(255,255,255,0.06);
            color:rgba(255,255,255,0.92);
            border-radius:12px; padding:10px 12px; cursor:pointer;
          ">Zamknij</button>
        </div>

        <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
          <a href="/login.html" style="
            display:inline-flex; align-items:center; justify-content:center;
            padding:12px 14px; border-radius:14px;
            border:1px solid rgba(255,255,255,0.12);
            background:rgba(255,255,255,0.06);
            color:rgba(255,255,255,0.92);
            font-weight:800; text-decoration:none;
          ">Zaloguj / załóż konto</a>

          <a href="/moje-konto.html" style="
            display:inline-flex; align-items:center; justify-content:center;
            padding:12px 14px; border-radius:14px;
            border:1px solid rgba(25,196,198,0.55);
            background:linear-gradient(180deg, rgba(25,196,198,0.95), rgba(25,196,198,0.72));
            color:#041116;
            font-weight:900; text-decoration:none;
          ">Moje konto</a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector("#accessModalClose")?.addEventListener("click", () => (modal.style.display = "none"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });

    return modal;
  }

  function openModal() {
    ensureModal().style.display = "flex";
  }

  async function loadMe() {
    try {
      const r = await fetch(`${API}/api/me`, { credentials: "include" });
      if (!r.ok) throw new Error("me not ok");
      const me = await r.json();

      state.loaded = true;
      state.authenticated = !!me.authenticated;
      state.plan = me.plan || "demo";

      writeCache(state.plan);
      setBadge();
      return true;
    } catch {
      state.loaded = false;
      setBadge();
      return false;
    }
  }

  function gateClicks() {
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target?.closest?.('a[data-access="pro"]');
        if (!a) return;

        if (isPro()) return;

        e.preventDefault();
        openModal();
      },
      true
    );
  }

  function gatePageIfRequired() {
    // jeśli kiedyś użyjesz: <body data-require="pro">
    const req = document.body?.dataset?.require;
    if (req !== "pro") return;
    if (isPro()) return;

    openModal();
    setTimeout(() => {
      if (!isPro()) location.href = "/login.html";
    }, 700);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    setBadge();
    gateClicks();
    await loadMe();
    gatePageIfRequired();
  });
})();
