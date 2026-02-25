/* access.js — DEMO/PRO + TESTER codes (30 dni)
   PANCERNA wersja:
   - event delegation (łapie klik nawet gdy DOM się zmienia)
   - zawsze pokaże modal albo alert (nie będzie "nic się nie dzieje")
   + DOPIĘTE:
   - bramka na poziomie strony: <body data-require="pro">
   - aktywacja kodu z linku: ?kod=SABC-BETA-0001

   NOWE (bez upraszczania):
   - integracja z backend: GET /api/me
   - offline grace period: ostatnie potwierdzenie PRO/TESTER trzymane lokalnie
*/

(() => {
  const ACCESS = {
    testerCodes: new Set([
      "SABC-BETA-0001","SABC-BETA-0002","SABC-BETA-0003","SABC-BETA-0004","SABC-BETA-0005",
      "SABC-BETA-0006","SABC-BETA-0007","SABC-BETA-0008","SABC-BETA-0009","SABC-BETA-0010",
      "SABC-BETA-0011","SABC-BETA-0012","SABC-BETA-0013","SABC-BETA-0014","SABC-BETA-0015",
      "SABC-BETA-0016","SABC-BETA-0017","SABC-BETA-0018","SABC-BETA-0019","SABC-BETA-0020",
      "SABC-BETA-0021","SABC-BETA-0022","SABC-BETA-0023","SABC-BETA-0024","SABC-BETA-0025",
      "SABC-BETA-0026","SABC-BETA-0027","SABC-BETA-0028","SABC-BETA-0029","SABC-BETA-0030"
    ]),
    testerDays: 30,

    // legacy: kody testerów w localStorage
    storageKey: "sailabc_tester_access", // JSON: { code, startedAt, expiresAt }

    // nowe: cache planu z /api/me do działania offline
    entitlementCacheKey: "sailabc_entitlement_cache", // JSON: { plan, expiresAt, cachedAt }
    offlineGraceDays: 14
  };

  const nowMs = () => Date.now();
  const daysToMs = (d) => d * 24 * 60 * 60 * 1000;
  const normalizeCode = (code) => String(code || "").trim().toUpperCase();

  function readState() {
    try {
      const raw = localStorage.getItem(ACCESS.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeState(st) {
    localStorage.setItem(ACCESS.storageKey, JSON.stringify(st));
  }

  function clearState() {
    localStorage.removeItem(ACCESS.storageKey);
  }

  function readEntitlementCache() {
    try {
      const raw = localStorage.getItem(ACCESS.entitlementCacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeEntitlementCache(st) {
    try {
      localStorage.setItem(ACCESS.entitlementCacheKey, JSON.stringify(st));
    } catch {}
  }

  function clearEntitlementCache() {
    try {
      localStorage.removeItem(ACCESS.entitlementCacheKey);
    } catch {}
  }

  function isLegacyProActive() {
    const st = readState();
    if (!st || !st.expiresAt) return false;
    if (nowMs() > Number(st.expiresAt)) {
      clearState();
      return false;
    }
    return true;
  }

  function remainingLegacyDays() {
    const st = readState();
    if (!st || !st.expiresAt) return null;
    const ms = Number(st.expiresAt) - nowMs();
    if (ms <= 0) return 0;
    return Math.ceil(ms / daysToMs(1));
  }

  // --- backend entitlement ---
  let meState = {
    loaded: false,
    authenticated: false,
    email: null,
    plan: "demo",
    expiresAt: null,
    source: "init"
  };

  function isPlanActive(plan, expiresAt) {
    if (plan === "pro") {
      if (expiresAt == null) return true;
      return nowMs() <= Number(expiresAt);
    }
    if (plan === "tester") return true;
    return false;
  }

  function getEffectiveAccess() {
    // 1) backend state (jeśli mamy)
    if (meState.loaded) {
      const ok = isPlanActive(meState.plan, meState.expiresAt);
      return { ok, plan: meState.plan, expiresAt: meState.expiresAt, source: meState.source };
    }

    // 2) cache offline z backendu (grace)
    const cached = readEntitlementCache();
    if (cached && cached.plan) {
      const age = nowMs() - Number(cached.cachedAt || 0);
      const withinGrace = age >= 0 && age <= daysToMs(ACCESS.offlineGraceDays);
      const ok = withinGrace && isPlanActive(cached.plan, cached.expiresAt);
      if (ok) return { ok: true, plan: cached.plan, expiresAt: cached.expiresAt, source: "offline-cache" };
    }

    // 3) legacy kody testerów (żeby nic nie padło)
    if (isLegacyProActive()) {
      return { ok: true, plan: "tester", expiresAt: readState()?.expiresAt || null, source: "legacy-code" };
    }

    return { ok: false, plan: "demo", expiresAt: null, source: "demo" };
  }

  async function loadMe() {
    try {
      const r = await fetch("/api/me", { credentials: "include" });
      if (!r.ok) throw new Error("me not ok");
      const data = await r.json();

      meState = {
        loaded: true,
        authenticated: !!data.authenticated,
        email: data.email || null,
        plan: data.plan || "demo",
        expiresAt: data.expiresAt ?? null,
        source: "api/me"
      };

      // zapis do offline cache
      writeEntitlementCache({
        plan: meState.plan,
        expiresAt: meState.expiresAt,
        cachedAt: nowMs()
      });

      updateBadge();
      return true;
    } catch {
      // fallback: offline cache / legacy
      meState.loaded = false;
      updateBadge();
      return false;
    }
  }

  function updateBadge() {
    const badge = document.querySelector("[data-pro-badge]");
    if (!badge) return;

    const eff = getEffectiveAccess();
    if (eff.ok) {
      if (eff.plan === "pro") {
        badge.textContent = "PRO";
      } else {
        // tester
        const d = remainingLegacyDays();
        if (eff.source === "legacy-code" && d != null) {
          badge.textContent = `TESTER PRO (${d} dni)`;
        } else {
          badge.textContent = "TESTER";
        }
      }
    } else {
      badge.textContent = "DEMO";
    }
  }

  // --- modal (no-CSS dependency) ---
  function ensureModal() {
    let modal = document.getElementById("accessModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "accessModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
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
            <div style="font-weight:900; font-size:18px; letter-spacing:-0.2px;">
              To narzędzie jest w wersji PRO
            </div>
            <div style="margin-top:8px; color:rgba(255,255,255,0.72); line-height:1.45;">
              Zaloguj się, aby odblokować PRO (tester lub płatny). Jeśli masz <strong>kod testera</strong>, możesz go też użyć.
            </div>
          </div>
          <button type="button" id="accessModalClose" style="
            border:1px solid rgba(255,255,255,0.16);
            background:rgba(255,255,255,0.06);
            color:rgba(255,255,255,0.92);
            border-radius:12px; padding:10px 12px; cursor:pointer;
            white-space:nowrap;
          ">Zamknij</button>
        </div>

        <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
          <a href="/login.html" id="accessModalLogin" style="
            display:inline-flex; align-items:center; justify-content:center;
            padding:12px 14px; border-radius:14px;
            border:1px solid rgba(255,255,255,0.12);
            background:rgba(255,255,255,0.06);
            color:rgba(255,255,255,0.92);
            font-weight:800; text-decoration:none;
          ">Zaloguj / załóż konto</a>

          <a href="#tester" id="accessModalTester" style="
            display:inline-flex; align-items:center; justify-content:center;
            padding:12px 14px; border-radius:14px;
            border:1px solid rgba(255,255,255,0.12);
            background:rgba(255,255,255,0.06);
            color:rgba(255,255,255,0.92);
            font-weight:800; text-decoration:none;
          ">Mam kod testera</a>

          <a href="/oprogramowanie.html#pakiety" id="accessModalPlans" style="
            display:inline-flex; align-items:center; justify-content:center;
            padding:12px 14px; border-radius:14px;
            border:1px solid rgba(25,196,198,0.55);
            background:linear-gradient(180deg, rgba(25,196,198,0.95), rgba(25,196,198,0.72));
            color:#041116;
            font-weight:900; text-decoration:none;
          ">Zobacz pakiety</a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector("#accessModalClose");
    closeBtn?.addEventListener("click", () => (modal.style.display = "none"));

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });

    return modal;
  }

  function openModalOrAlert() {
    try {
      const modal = ensureModal();
      modal.style.display = "flex";
    } catch {
      alert("To narzędzie jest w wersji PRO. Zaloguj się, przejdź do pakietów lub użyj kodu testera.");
    }
  }

  // --- legacy: aktywacja kodu z linku ?kod=... ---
  function activateFromQuery() {
    const params = new URLSearchParams(location.search);
    const code = normalizeCode(params.get("kod"));
    if (!code) return false;

    if (!ACCESS.testerCodes.has(code)) {
      alert("Niepoprawny kod testera.");
      return false;
    }

    // jeśli już mamy dostęp z /api/me — nie nadpisuj
    const eff = getEffectiveAccess();
    if (eff.ok && eff.source === "api/me") return true;

    // już aktywny? zostaw
    if (isLegacyProActive()) return true;

    const startedAt = nowMs();
    const expiresAt = startedAt + daysToMs(ACCESS.testerDays);
    writeState({ code, startedAt, expiresAt });

    alert("Aktywowano TESTER PRO na 30 dni.");
    // czyścimy parametr z URL, żeby nie aktywować w kółko
    history.replaceState({}, "", location.pathname + location.hash);
    return true;
  }

  // --- tester controls (legacy UI) ---
  function bindTesterControls() {
    const input = document.getElementById("testerCode");
    const btnOn = document.getElementById("btnActivateTester");
    const btnOff = document.getElementById("btnDeactivateTester");
    const info = document.getElementById("testerInfo");

    function refresh() {
      if (!info) return;

      // jeśli mamy /api/me i jesteśmy pro/tester — pokaż to
      if (meState.loaded) {
        const effOk = isPlanActive(meState.plan, meState.expiresAt);
        if (effOk) {
          info.textContent = `Aktywny dostęp: ${meState.plan.toUpperCase()}${meState.authenticated && meState.email ? " • " + meState.email : ""}`;
          if (btnOn) btnOn.disabled = true;
          if (btnOff) btnOff.disabled = true;
          updateBadge();
          return;
        }
      }

      if (isLegacyProActive()) {
        const st = readState();
        info.textContent = `Aktywny TESTER PRO: ${st?.code || ""} • pozostało: ${remainingLegacyDays()} dni`;
        if (btnOn) btnOn.disabled = true;
        if (btnOff) btnOff.disabled = false;
        if (input && st?.code) input.value = st.code;
      } else {
        info.textContent = "Wpisz kod testera, aby odblokować PRO na 30 dni.";
        if (btnOn) btnOn.disabled = false;
        if (btnOff) btnOff.disabled = true;
      }
      updateBadge();
    }

    btnOn?.addEventListener("click", () => {
      const code = normalizeCode(input?.value);
      if (!code) return alert("Wpisz kod testera.");
      if (!ACCESS.testerCodes.has(code)) return alert("Niepoprawny kod testera.");

      const startedAt = nowMs();
      const expiresAt = startedAt + daysToMs(ACCESS.testerDays);
      writeState({ code, startedAt, expiresAt });

      refresh();
      alert("Aktywowano TESTER PRO na 30 dni.");
    });

    btnOff?.addEventListener("click", () => {
      clearState();
      refresh();
      alert("Wyłączono PRO. Wracasz do DEMO.");
    });

    refresh();
  }

  // --- gating: event delegation ---
  function bindGating() {
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target?.closest?.('a[data-access="pro"]');
        if (!a) return;

        const eff = getEffectiveAccess();
        if (eff.ok) return;

        e.preventDefault();
        openModalOrAlert();
      },
      true
    );
  }

  // --- bramka na poziomie strony ---
  function gatePageIfRequired() {
    const req = document.body?.dataset?.require;
    if (req !== "pro") return;

    const eff = getEffectiveAccess();
    if (eff.ok) return;

    openModalOrAlert();

    setTimeout(() => {
      const eff2 = getEffectiveAccess();
      if (!eff2.ok) location.href = "/oprogramowanie.html#pakiety";
    }, 900);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    activateFromQuery();
    updateBadge();
    bindGating();
    bindTesterControls();

    await loadMe(); // spróbuj pobrać plan użytkownika (online)
    gatePageIfRequired();
  });

  window.__sailabc_access_loaded = true;
})();
