/* access.js — DEMO/PRO + TESTER codes (30 dni)
   - PRO (płatne) zostawiamy jako przyszłość
   - TESTER: kod aktywuje PRO na 30 dni (localStorage)
*/

const ACCESS = {
  // 30 kodów startowych — możesz zmienić, dodać, usunąć
  testerCodes: new Set([
    "SABC-BETA-0001","SABC-BETA-0002","SABC-BETA-0003","SABC-BETA-0004","SABC-BETA-0005",
    "SABC-BETA-0006","SABC-BETA-0007","SABC-BETA-0008","SABC-BETA-0009","SABC-BETA-0010",
    "SABC-BETA-0011","SABC-BETA-0012","SABC-BETA-0013","SABC-BETA-0014","SABC-BETA-0015",
    "SABC-BETA-0016","SABC-BETA-0017","SABC-BETA-0018","SABC-BETA-0019","SABC-BETA-0020",
    "SABC-BETA-0021","SABC-BETA-0022","SABC-BETA-0023","SABC-BETA-0024","SABC-BETA-0025",
    "SABC-BETA-0026","SABC-BETA-0027","SABC-BETA-0028","SABC-BETA-0029","SABC-BETA-0030"
  ]),

  // ile dni ważny kod testera
  testerDays: 30,

  // storage keys
  key: {
    tester: "sailabc_tester_access" // JSON: { code, startedAt, expiresAt }
  }
};

// ---------- helpers ----------
function nowMs(){ return Date.now(); }
function daysToMs(d){ return d * 24 * 60 * 60 * 1000; }

function readTesterState() {
  try {
    const raw = localStorage.getItem(ACCESS.key.tester);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeTesterState(state) {
  localStorage.setItem(ACCESS.key.tester, JSON.stringify(state));
}

function clearTesterState() {
  localStorage.removeItem(ACCESS.key.tester);
}

function isTesterProActive() {
  const st = readTesterState();
  if (!st || !st.expiresAt) return false;
  if (nowMs() > Number(st.expiresAt)) {
    clearTesterState();
    return false;
  }
  return true;
}

function remainingDays() {
  const st = readTesterState();
  if (!st || !st.expiresAt) return null;
  const ms = Number(st.expiresAt) - nowMs();
  if (ms <= 0) return 0;
  return Math.ceil(ms / daysToMs(1));
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

// ---------- UI badge ----------
function updateBadge() {
  const badge = document.querySelector("[data-pro-badge]");
  if (!badge) return;

  if (isTesterProActive()) {
    const days = remainingDays();
    badge.textContent = `TESTER PRO (${days} dni)`;
  } else {
    badge.textContent = "DEMO";
  }
}

// ---------- modal ----------
function ensureModal() {
  if (document.getElementById("accessModal")) return;

  const modal = document.createElement("div");
  modal.id = "accessModal";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(0,0,0,0.55)";
  modal.style.display = "none";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "9999";
  modal.style.padding = "16px";

  modal.innerHTML = `
    <div style="
      width: min(560px, 100%);
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(15,26,47,0.96);
      border-radius: 18px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      padding: 16px 16px 14px;
      color: rgba(255,255,255,0.92);
    ">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
        <div>
          <div style="font-weight:900; font-size:18px; letter-spacing:-0.2px;">Dostęp PRO</div>
          <div style="color: rgba(255,255,255,0.72); margin-top:6px;">
            To narzędzie jest w wersji PRO. Możesz:
            <ul style="margin:8px 0 0 18px; color: rgba(255,255,255,0.72);">
              <li>aktywować PRO kodem testera (jeśli go masz),</li>
              <li>albo przejść do sekcji pakietów.</li>
            </ul>
          </div>
        </div>
        <button id="accessModalClose" class="btn btn-ghost" type="button" style="white-space:nowrap;">Zamknij</button>
      </div>

      <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
        <a class="btn btn-primary" href="#pakiety">Zobacz pakiety</a>
        <a class="btn" href="#tester">Mam kod testera</a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#accessModalClose");
  closeBtn?.addEventListener("click", () => (modal.style.display = "none"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}

function openModal() {
  ensureModal();
  const modal = document.getElementById("accessModal");
  if (modal) modal.style.display = "flex";
}

// ---------- gating ----------
function applyGating() {
  const proActive = isTesterProActive(); // na razie PRO = tester PRO

  // zablokuj linki z data-access="pro" jeśli nie ma PRO
  const proLinks = document.querySelectorAll('[data-access="pro"]');
  proLinks.forEach((a) => {
    if (!(a instanceof HTMLAnchorElement)) return;

    a.setAttribute("aria-disabled", proActive ? "false" : "true");

    // delikatna wizualna wskazówka bez zmian w CSS
    a.style.opacity = proActive ? "" : "0.92";
    a.style.cursor = proActive ? "" : "pointer";

    a.addEventListener("click", (e) => {
      if (proActive) return;
      e.preventDefault();
      openModal();
    });
  });

  updateBadge();
}

// ---------- tester activation ----------
function bindTesterControls() {
  const input = document.getElementById("testerCode");
  const btnActivate = document.getElementById("btnActivateTester");
  const btnDeactivate = document.getElementById("btnDeactivateTester");
  const info = document.getElementById("testerInfo");

  function refreshTesterInfo() {
    if (!info) return;

    if (isTesterProActive()) {
      const st = readTesterState();
      const days = remainingDays();
      info.textContent = `Aktywny TESTER PRO: ${st?.code || ""} • pozostało: ${days} dni`;
      if (btnActivate) btnActivate.disabled = true;
      if (btnDeactivate) btnDeactivate.disabled = false;
      if (input) input.value = st?.code || "";
    } else {
      info.textContent = "Wpisz kod testera, aby odblokować PRO na 30 dni.";
      if (btnActivate) btnActivate.disabled = false;
      if (btnDeactivate) btnDeactivate.disabled = true;
    }
    updateBadge();
  }

  btnActivate?.addEventListener("click", () => {
    const code = normalizeCode(input?.value);
    if (!code) {
      alert("Wpisz kod testera.");
      return;
    }
    if (!ACCESS.testerCodes.has(code)) {
      alert("Niepoprawny kod testera.");
      return;
    }

    const startedAt = nowMs();
    const expiresAt = startedAt + daysToMs(ACCESS.testerDays);

    writeTesterState({ code, startedAt, expiresAt });
    applyGating();
    refreshTesterInfo();
    alert("Aktywowano TESTER PRO na 30 dni.");
  });

  btnDeactivate?.addEventListener("click", () => {
    clearTesterState();
    applyGating();
    refreshTesterInfo();
    alert("Wyłączono TESTER PRO. Wracasz do DEMO.");
  });

  refreshTesterInfo();
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  applyGating();
  bindTesterControls();
});
