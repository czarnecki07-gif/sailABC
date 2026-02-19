// sailABC Tools — Planer kursu (MVP)
// - waypointy
// - kurs i dystans (Mm) między punktami
// - ETA na podstawie prędkości i startu
// - zapis localStorage

const KEY = "sailabc_planner_v1";

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return { meta:{ tripName:"", speed:5, courseOffset:0, startTime:"" }, wps:[] };
    const d = JSON.parse(raw);
    d.meta ||= { tripName:"", speed:5, courseOffset:0, startTime:"" };
    d.wps ||= [];
    return d;
  }catch{
    return { meta:{ tripName:"", speed:5, courseOffset:0, startTime:"" }, wps:[] };
  }
}
function save(state){ localStorage.setItem(KEY, JSON.stringify(state)); }

function norm360(x){
  let a = Number(x);
  if(!Number.isFinite(a)) return null;
  a = ((a % 360) + 360) % 360;
  return a;
}

function parseCoord(v, isLat){
  // accepts: "54.35N", "54.35", "54°21.1'N" (minimal), "54 21.1 N" (minimal)
  if(v == null) return null;
  let s = String(v).trim().toUpperCase();
  if(!s) return null;

  // simple decimal with optional N/S/E/W suffix
  const m = s.match(/^([-+]?\d+(?:[.,]\d+)?)([NSEW])?$/);
  if(m){
    let num = Number(m[1].replace(",", "."));
    if(!Number.isFinite(num)) return null;
    const suf = m[2];
    if(suf){
      if(suf === "S" || suf === "W") num = -Math.abs(num);
      else num = Math.abs(num);
    }
    // basic bounds
    if(isLat && (num < -90 || num > 90)) return null;
    if(!isLat && (num < -180 || num > 180)) return null;
    return num;
  }

  // very light D M format: "54 21.1 N"
  const dm = s.match(/^(\d{1,3})\s+(\d+(?:[.,]\d+)?)\s*([NSEW])$/);
  if(dm){
    const deg = Number(dm[1]);
    const min = Number(dm[2].replace(",", "."));
    const dir = dm[3];
    if(!Number.isFinite(deg) || !Number.isFinite(min)) return null;
    let num = deg + (min/60);
    if(dir === "S" || dir === "W") num = -num;
    if(isLat && (num < -90 || num > 90)) return null;
    if(!isLat && (num < -180 || num > 180)) return null;
    return num;
  }

  return null;
}

// Haversine distance in nautical miles
function distNm(lat1, lon1, lat2, lon2){
  const R = 6371e3; // meters
  const toRad = (d)=>d*Math.PI/180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2-lat1);
  const Δλ = toRad(lon2-lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const meters = R*c;
  return meters / 1852; // NM
}

// initial bearing (course) from point1 to point2
function bearingDeg(lat1, lon1, lat2, lon2){
  const toRad = (d)=>d*Math.PI/180;
  const toDeg = (r)=>r*180/Math.PI;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const λ1 = toRad(lon1), λ2 = toRad(lon2);
  const y = Math.sin(λ2-λ1) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

function fmtDeg(x){ return String(Math.round(x)).padStart(3,"0") + "°"; }
function fmtNm(x){ return (Math.round(x*10)/10).toFixed(1) + " Mm"; }

function fmtDurationHours(h){
  if(!Number.isFinite(h)) return "—";
  const totalMin = Math.round(h*60);
  const hh = Math.floor(totalMin/60);
  const mm = totalMin%60;
  return `${hh} h ${String(mm).padStart(2,"0")} min`;
}

function addMinutesToTimeHHMM(hhmm, mins){
  if(!hhmm) return null;
  const [H,M] = hhmm.split(":").map(Number);
  if(!Number.isFinite(H) || !Number.isFinite(M)) return null;
  const start = H*60 + M;
  const out = (start + mins) % (24*60);
  const h = Math.floor(out/60);
  const m = out%60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

const state = load();

/* DOM */
const tripName = document.getElementById("tripName");
const speed = document.getElementById("speed");
const courseOffset = document.getElementById("courseOffset");
const startTime = document.getElementById("startTime");

const wpBody = document.getElementById("wpBody");
const wpHint = document.getElementById("wpHint");

const segBody = document.getElementById("segBody");
const sumDist = document.getElementById("sumDist");
const sumTime = document.getElementById("sumTime");
const sumETA = document.getElementById("sumETA");
const calcExplain = document.getElementById("calcExplain");

function fillMeta(){
  tripName.value = state.meta.tripName || "";
  speed.value = String(state.meta.speed ?? 5);
  courseOffset.value = String(state.meta.courseOffset ?? 0);
  startTime.value = state.meta.startTime || "";
}
fillMeta();

function renderWps(){
  wpBody.innerHTML = (state.wps || []).map((w, i)=>`
    <tr data-i="${i}">
      <td class="mono">${i+1}</td>
      <td><input class="in in-name" value="${(w.name||"").replaceAll('"','&quot;')}" placeholder="np. WP${i+1}"></td>
      <td><input class="in in-lat mono" value="${(w.latRaw||"").replaceAll('"','&quot;')}" placeholder="np. 54.35N"></td>
      <td><input class="in in-lon mono" value="${(w.lonRaw||"").replaceAll('"','&quot;')}" placeholder="np. 18.64E"></td>
      <td><button class="btn btn-danger" data-del="${i}" type="button">Usuń</button></td>
    </tr>
  `).join("");

  wpHint.textContent = `Waypointów: ${(state.wps||[]).length}. Minimum 2, żeby policzyć odcinki.`;
}

function readWpsFromTable(){
  const rows = Array.from(wpBody.querySelectorAll("tr"));
  state.wps = rows.map(r=>{
    const name = r.querySelector(".in-name")?.value?.trim() || "";
    const latRaw = r.querySelector(".in-lat")?.value?.trim() || "";
    const lonRaw = r.querySelector(".in-lon")?.value?.trim() || "";
    return { name, latRaw, lonRaw };
  });
}

function saveMetaFromInputs(){
  state.meta.tripName = tripName.value.trim();
  state.meta.speed = Number(speed.value);
  state.meta.courseOffset = Number(courseOffset.value);
  state.meta.startTime = startTime.value;
}

function recalc(){
  readWpsFromTable();
  saveMetaFromInputs();
  save(state);

  const wps = state.wps || [];
  const V = Number(state.meta.speed);
  const off = Number(state.meta.courseOffset) || 0;
  const st = state.meta.startTime || "";

  if(!wps.length || wps.length < 2){
    segBody.innerHTML = `<tr><td colspan="5" class="muted">Dodaj co najmniej 2 waypointy.</td></tr>`;
    sumDist.textContent = "—";
    sumTime.textContent = "—";
    sumETA.textContent = "—";
    calcExplain.textContent = "";
    return;
  }

  if(!Number.isFinite(V) || V <= 0){
    alert("Ustaw prędkość > 0 kn.");
    return;
  }

  let totalNm = 0;
  let totalMin = 0;

  const rows = [];

  for(let i=0;i<wps.length-1;i++){
    const a = wps[i], b = wps[i+1];

    const lat1 = parseCoord(a.latRaw, true);
    const lon1 = parseCoord(a.lonRaw, false);
    const lat2 = parseCoord(b.latRaw, true);
    const lon2 = parseCoord(b.lonRaw, false);

    if(lat1===null || lon1===null || lat2===null || lon2===null){
      rows.push(`<tr><td colspan="5" class="muted">Błąd współrzędnych w odcinku ${i+1}. Popraw lat/lon.</td></tr>`);
      continue;
    }

    const nm = distNm(lat1, lon1, lat2, lon2);
    const brg = bearingDeg(lat1, lon1, lat2, lon2);
    const course = norm360(brg + off);

    const hours = nm / V;
    const mins = Math.round(hours*60);

    totalNm += nm;
    totalMin += mins;

    const eta = st ? addMinutesToTimeHHMM(st, totalMin) : "—";

    const nameA = a.name || `WP${i+1}`;
    const nameB = b.name || `WP${i+2}`;

    rows.push(`
      <tr>
        <td class="mono">${nameA} → ${nameB}</td>
        <td class="mono">${fmtDeg(course)}</td>
        <td class="mono">${fmtNm(nm)}</td>
        <td class="mono">${fmtDurationHours(hours)}</td>
        <td class="mono">${eta}</td>
      </tr>
    `);
  }

  segBody.innerHTML = rows.join("") || `<tr><td colspan="5" class="muted">Brak odcinków.</td></tr>`;

  sumDist.textContent = fmtNm(totalNm);
  sumTime.textContent = `${Math.floor(totalMin/60)} h ${String(totalMin%60).padStart(2,"0")} min`;
  sumETA.textContent = st ? addMinutesToTimeHHMM(st, totalMin) : "—";

  calcExplain.textContent =
    `Dystans: haversine (Mm). Kurs: bearing początkowy + poprawka kursu. ETA liczone od startu i sumy czasów (bez postojów).`;
}

/* events */
document.getElementById("btnAddWp")?.addEventListener("click", ()=>{
  state.wps ||= [];
  state.wps.push({ name:`WP${state.wps.length+1}`, latRaw:"", lonRaw:"" });
  save(state);
  renderWps();
});

wpBody?.addEventListener("click", (e)=>{
  const btn = e.target?.closest?.("[data-del]");
  if(!btn) return;
  const i = Number(btn.getAttribute("data-del"));
  state.wps.splice(i,1);
  save(state);
  renderWps();
  recalc();
});

document.getElementById("btnSaveTrip")?.addEventListener("click", ()=>{
  readWpsFromTable();
  saveMetaFromInputs();
  save(state);
  wpHint.textContent = "Zapisano trasę.";
  setTimeout(()=>renderWps(), 500);
});

document.getElementById("btnClearTrip")?.addEventListener("click", ()=>{
  const ok = confirm("Wyczyścić całą trasę i waypointy?");
  if(!ok) return;
  localStorage.removeItem(KEY);
  location.reload();
});

document.getElementById("btnRecalc")?.addEventListener("click", recalc);

// auto: przelicz po edycji inputów w tabeli (z lekkim debounce)
let t = null;
wpBody?.addEventListener("input", ()=>{
  clearTimeout(t);
  t = setTimeout(()=>recalc(), 250);
});

speed?.addEventListener("input", ()=>{ clearTimeout(t); t=setTimeout(recalc, 250); });
courseOffset?.addEventListener("input", ()=>{ clearTimeout(t); t=setTimeout(recalc, 250); });
startTime?.addEventListener("input", ()=>{ clearTimeout(t); t=setTimeout(recalc, 250); });

renderWps();
recalc();
