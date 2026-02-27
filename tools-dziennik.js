// sailABC Tools — Elektroniczny dziennik pokładowy (MVP)
// - localStorage
// - raport PDF: otwiera widok raportu i uruchamia druk (zapis jako PDF)
// - PRO gate (prosto): działa tylko jeśli wpisano kod PRO (localStorage)

const KEY = "sailabc_log_v1";

/* =========================
   PRO gate (super prosty)
   ========================= */
const PRO_STORAGE_KEY = "sailabc_pro_code";
const PRO_CODE = "SAILABC-PRO-2026";

function isProActiveLocal() {
  return localStorage.getItem(PRO_STORAGE_KEY) === PRO_CODE;
}

function showProGateOverlay() {
  const wrap = document.createElement("div");
  wrap.id = "proGateOverlay";
  wrap.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    display:flex; align-items:center; justify-content:center;
    padding:16px; background:rgba(0,0,0,0.66);
  `;

  wrap.innerHTML = `
    <div style="
      width:min(720px,100%);
      background:rgba(15,26,47,0.98);
      border:1px solid rgba(255,255,255,0.14);
      border-radius:18px;
      box-shadow:0 20px 60px rgba(0,0,0,0.55);
      padding:16px;
      color:rgba(255,255,255,0.92);
    ">
      <div style="display:flex; gap:12px; align-items:flex-start; justify-content:space-between;">
        <div>
          <div style="font-weight:900; font-size:18px; letter-spacing:-0.2px;">
            Elektroniczny dziennik pokładowy jest w wersji PRO
          </div>
          <div style="margin-top:8px; color:rgba(255,255,255,0.74); line-height:1.45;">
            Wpisz kod PRO, aby odblokować narzędzie na tym urządzeniu.
          </div>
        </div>
        <button id="btnEnterProCode" type="button" style="
          display:inline-flex; align-items:center; justify-content:center;
          padding:10px 12px; border-radius:12px;
          border:1px solid rgba(25,196,198,0.55);
          background:linear-gradient(180deg, rgba(25,196,198,0.95), rgba(25,196,198,0.72));
          color:#041116;
          font-weight:900; text-decoration:none;
          white-space:nowrap;
          cursor:pointer;
        ">Wpisz kod</button>
      </div>

      <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
        <a href="/oprogramowanie.html#narzedzia" style="
          display:inline-flex; align-items:center; justify-content:center;
          padding:12px 14px; border-radius:14px;
          border:1px solid rgba(255,255,255,0.12);
          background:rgba(255,255,255,0.06);
          color:rgba(255,255,255,0.92);
          font-weight:800; text-decoration:none;
        ">Wróć do listy narzędzi</a>
      </div>

      <div style="margin-top:12px; color:rgba(255,255,255,0.7); font-size:12px;">
        (To jest blokada po stronie frontu.)
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  wrap.querySelector("#btnEnterProCode")?.addEventListener("click", () => {
    const code = prompt("Wpisz kod PRO:");
    if (!code) return;
    if (code.trim() === PRO_CODE) {
      localStorage.setItem(PRO_STORAGE_KEY, PRO_CODE);
      location.reload();
    } else {
      alert("Zły kod.");
    }
  });
}

/* Jeśli brak PRO, nie uruchamiamy logiki narzędzia */
if (!isProActiveLocal()) {
  window.addEventListener("DOMContentLoaded", () => {
    showProGateOverlay();
  });
  throw new Error("sailABC: PRO required for tools-dziennik");
}

/* =========================
   Reszta narzędzia (MVP)
   ========================= */

function nowLocalInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { meta: {}, entries: [] };
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { meta: {}, entries: [] };
    data.meta ||= {};
    data.entries ||= [];
    return data;
  } catch {
    return { meta: {}, entries: [] };
  }
}

function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmtDT(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ");
}

const state = loadState();

/* ===== DOM ===== */
const elVoyageName = document.getElementById("voyageName");
const elVesselName = document.getElementById("vesselName");
const elSkipperName = document.getElementById("skipperName");
const elCrew = document.getElementById("crew");
const elArea = document.getElementById("area");
const elSaveHint = document.getElementById("saveHint");

const elDT = document.getElementById("dt");
const elLat = document.getElementById("lat");
const elLon = document.getElementById("lon");
const elCOG = document.getElementById("cog");
const elSOG = document.getElementById("sog");
const elEtaPort = document.getElementById("etaPort");
const elWind = document.getElementById("wind");
const elSea = document.getElementById("sea");
const elWx = document.getElementById("wx");
const elEvents = document.getElementById("events");
const elNotes = document.getElementById("notes");

const elBody = document.getElementById("logBody");
const elCountInfo = document.getElementById("countInfo");

/* ===== Init meta ===== */
function fillMeta() {
  const m = state.meta || {};
  if (elVoyageName) elVoyageName.value = m.voyageName || "";
  if (elVesselName) elVesselName.value = m.vesselName || "";
  if (elSkipperName) elSkipperName.value = m.skipperName || "";
  if (elCrew) elCrew.value = m.crew || "";
  if (elArea) elArea.value = m.area || "";
}
fillMeta();

/* ===== Init form ===== */
if (elDT) elDT.value = nowLocalInputValue();

/* ===== Render table ===== */
function render() {
  if (!elBody) return;

  const entries = (state.entries || [])
    .slice()
    .sort((a, b) => String(a.dt).localeCompare(String(b.dt)));

  elBody.innerHTML = entries
    .map((e) => {
      const pos = `${esc(e.lat || "—")} / ${esc(e.lon || "—")}`;
      const crsSpd = `${esc(e.cog ?? "—")}° • ${esc(e.sog ?? "—")} kn`;
      const wx = `Wiatr: ${esc(e.wind || "—")}<br>Fala: ${esc(e.sea || "—")}<br>Pogoda: ${esc(e.wx || "—")}`;
      const evn = `<strong>Zdarzenia:</strong> ${esc(e.events || "—")}<br><strong>Notatki:</strong> ${esc(e.notes || "—")}${
        e.etaPort ? `<br><strong>Plan:</strong> ${esc(e.etaPort)}` : ""
      }`;

      return `
      <tr data-id="${esc(e.id)}">
        <td class="td-small mono">${esc(fmtDT(e.dt))}</td>
        <td class="mono">${pos}</td>
        <td class="td-small mono">${crsSpd}</td>
        <td>${wx}</td>
        <td>${evn}</td>
        <td class="td-small">
          <button class="btn btn-danger" data-del="${esc(e.id)}" type="button">Usuń</button>
        </td>
      </tr>
    `;
    })
    .join("");

  if (elCountInfo) elCountInfo.textContent = `Liczba wpisów: ${entries.length}`;
}
render();

/* ===== Actions ===== */
document.getElementById("btnSaveMeta")?.addEventListener("click", () => {
  state.meta = {
    voyageName: (elVoyageName?.value || "").trim(),
    vesselName: (elVesselName?.value || "").trim(),
    skipperName: (elSkipperName?.value || "").trim(),
    crew: (elCrew?.value || "").trim(),
    area: (elArea?.value || "").trim()
  };
  saveState(state);
  if (elSaveHint) {
    elSaveHint.textContent = "Zapisano dane rejsu.";
    setTimeout(() => {
      elSaveHint.textContent = "";
    }, 1500);
  }
});

document.getElementById("btnClearAll")?.addEventListener("click", () => {
  const ok = confirm("Na pewno wyczyścić cały dziennik i dane rejsu? (nie da się cofnąć)");
  if (!ok) return;
  localStorage.removeItem(KEY);
  location.reload();
});

function resetForm() {
  if (elDT) elDT.value = nowLocalInputValue();
  if (elLat) elLat.value = "";
  if (elLon) elLon.value = "";
  if (elCOG) elCOG.value = "";
  if (elSOG) elSOG.value = "";
  if (elEtaPort) elEtaPort.value = "";
  if (elWind) elWind.value = "";
  if (elSea) elSea.value = "";
  if (elWx) elWx.value = "";
  if (elEvents) elEvents.value = "";
  if (elNotes) elNotes.value = "";
}

document.getElementById("btnResetForm")?.addEventListener("click", resetForm);

document.getElementById("btnAddNow")?.addEventListener("click", () => {
  if (elDT) elDT.value = nowLocalInputValue();
  elLat?.focus?.();
});

function addEntry() {
  const dt = (elDT?.value || "").trim();
  if (!dt) {
    alert("Wybierz czas wpisu.");
    return;
  }

  const id =
    (crypto?.randomUUID && crypto.randomUUID()) ||
    String(Date.now()) + "_" + Math.random().toString(16).slice(2);

  const entry = {
    id,
    dt,
    lat: (elLat?.value || "").trim(),
    lon: (elLon?.value || "").trim(),
    cog: (elCOG?.value || "").trim(),
    sog: (elSOG?.value || "").trim(),
    etaPort: (elEtaPort?.value || "").trim(),
    wind: (elWind?.value || "").trim(),
    sea: (elSea?.value || "").trim(),
    wx: (elWx?.value || "").trim(),
    events: (elEvents?.value || "").trim(),
    notes: (elNotes?.value || "").trim()
  };

  state.entries ||= [];
  state.entries.push(entry);
  saveState(state);
  render();
  resetForm();
}

document.getElementById("btnAddEntry")?.addEventListener("click", addEntry);

/* delete */
elBody?.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("[data-del]");
  if (!btn) return;
  const id = btn.getAttribute("data-del");
  const ok = confirm("Usunąć ten wpis?");
  if (!ok) return;

  state.entries = (state.entries || []).filter((x) => x.id !== id);
  saveState(state);
  render();
});

/* ===== Raport PDF (druk) ===== */
function openPrintReport() {
  const meta = state.meta || {};
  const entries = (state.entries || []).slice().sort((a, b) => String(a.dt).localeCompare(String(b.dt)));

  const title = meta.voyageName ? `Raport rejsu: ${meta.voyageName}` : "Raport rejsu";
  const head = `
    <h1 style="margin:0 0 6px;font-size:22px;">${esc(title)}</h1>
    <div style="color:#333;font-size:13px;margin-bottom:14px;">
      <div><strong>Jacht:</strong> ${esc(meta.vesselName || "—")} &nbsp; | &nbsp; <strong>Skipper:</strong> ${esc(meta.skipperName || "—")}</div>
      <div><strong>Akwen:</strong> ${esc(meta.area || "—")} &nbsp; | &nbsp; <strong>Załoga:</strong> ${esc(meta.crew || "—")}</div>
      <div><strong>Wygenerowano:</strong> ${esc(new Date().toLocaleString("pl-PL"))}</div>
    </div>
  `;

  const rows = entries
    .map(
      (e) => `
    <tr>
      <td style="white-space:nowrap;">${esc(fmtDT(e.dt))}</td>
      <td style="white-space:nowrap;">${esc(e.lat || "—")} / ${esc(e.lon || "—")}</td>
      <td style="white-space:nowrap;">${esc(e.cog || "—")}° • ${esc(e.sog || "—")} kn</td>
      <td>
        <div><strong>Wiatr:</strong> ${esc(e.wind || "—")}</div>
        <div><strong>Fala:</strong> ${esc(e.sea || "—")}</div>
        <div><strong>Pogoda:</strong> ${esc(e.wx || "—")}</div>
      </td>
      <td>
        <div><strong>Zdarzenia:</strong> ${esc(e.events || "—")}</div>
        <div><strong>Notatki:</strong> ${esc(e.notes || "—")}</div>
        ${e.etaPort ? `<div><strong>Plan:</strong> ${esc(e.etaPort)}</div>` : ""}
      </td>
    </tr>
  `
    )
    .join("");

  const html = `
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body{ font-family: Arial, sans-serif; margin: 26px; color:#111; }
    table{ width:100%; border-collapse:collapse; font-size:12px; }
    th, td{ border-bottom:1px solid #ddd; padding:10px 8px; vertical-align:top; text-align:left; }
    th{ background:#f5f5f5; }
    @media print{ body{ margin: 14mm; } }
  </style>
</head>
<body>
  ${head}
  <table>
    <thead>
      <tr>
        <th>Czas</th>
        <th>Pozycja</th>
        <th>Kurs / prędkość</th>
        <th>Pogoda</th>
        <th>Zdarzenia / notatki</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="5">Brak wpisów.</td></tr>`}
    </tbody>
  </table>

  <script>
    setTimeout(() => window.print(), 200);
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Przeglądarka zablokowała nowe okno. Zezwól na popupy dla tej strony.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

document.getElementById("btnPrintPdf")?.addEventListener("click", openPrintReport);
