// sailABC Tools — Tradycyjna nawigacja (MVP)
// Zasada: E = +, W = -

function norm360(x){
  let a = Number(x);
  if (!Number.isFinite(a)) return null;
  a = ((a % 360) + 360) % 360;
  return a;
}

function signedVal(val, dir){
  const v = Number(val);
  if (!Number.isFinite(v)) return 0;
  return (dir === "W") ? -Math.abs(v) : Math.abs(v);
}

function fmtDeg(x){
  const a = norm360(x);
  if (a === null) return "—";
  return String(Math.round(a)).padStart(3,"0") + "°";
}

function fmtKn(x){
  if (!Number.isFinite(x)) return "—";
  return (Math.round(x*10)/10).toFixed(1) + " kn";
}

/* ===== Tabs ===== */
const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = Array.from(document.querySelectorAll(".tab-panel"));

tabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const id = btn.dataset.tab;
    tabs.forEach(b=>b.classList.toggle("is-active", b===btn));
    tabs.forEach(b=>b.setAttribute("aria-selected", String(b===btn)));
    panels.forEach(p=>p.classList.toggle("is-active", p.id===id));
  });
});

/* ===== Kursy i poprawki ===== */
const mode = document.getElementById("mode");
const inCourse = document.getElementById("inCourse");
const declVal = document.getElementById("declVal");
const declDir = document.getElementById("declDir");
const devVal = document.getElementById("devVal");
const devDir = document.getElementById("devDir");

const outKR = document.getElementById("outKR");
const outKM = document.getElementById("outKM");
const outKK = document.getElementById("outKK");
const courseExplain = document.getElementById("courseExplain");

document.getElementById("btnCalcCourses")?.addEventListener("click", ()=>{
  const input = norm360(inCourse.value);
  if (input === null){
    alert("Wpisz kurs 0–359.");
    return;
  }
  const D = signedVal(declVal.value, declDir.value); // Δ
  const d = signedVal(devVal.value, devDir.value);   // dewiacja

  let KR, KM, KK;

  if (mode.value === "trueToCompass"){
    KR = input;
    KM = norm360(KR - D);
    KK = norm360(KM - d);
    courseExplain.textContent = `Tryb KR→KM→KK: KM = KR − Δ, KK = KM − d (E=+, W=−).`;
  } else {
    KK = input;
    KM = norm360(KK + d);
    KR = norm360(KM + D);
    courseExplain.textContent = `Tryb KK→KM→KR: KM = KK + d, KR = KM + Δ (E=+, W=−).`;
  }

  outKR.textContent = fmtDeg(KR);
  outKM.textContent = fmtDeg(KM);
  outKK.textContent = fmtDeg(KK);
});

document.getElementById("btnResetCourses")?.addEventListener("click", ()=>{
  inCourse.value = "";
  declVal.value = "";
  devVal.value = "";
  outKR.textContent = "—";
  outKM.textContent = "—";
  outKK.textContent = "—";
  courseExplain.textContent = "";
});

/* ===== Znos / prąd (wektory) =====
   Kursy mierzone od północy zgodnie z ruchem wskazówek zegara.
   Konwersja na wektor:
   x (E) = v * sin(theta)
   y (N) = v * cos(theta)
*/
const crs = document.getElementById("crs");
const stw = document.getElementById("stw");
const set = document.getElementById("set");
const drift = document.getElementById("drift");

const outCOG = document.getElementById("outCOG");
const outSOG = document.getElementById("outSOG");
const outLeeway = document.getElementById("outLeeway");
const setExplain = document.getElementById("setExplain");

function vecFromCourseSpeed(courseDeg, speed){
  const th = (courseDeg * Math.PI) / 180;
  return {
    x: speed * Math.sin(th), // E
    y: speed * Math.cos(th)  // N
  };
}
function courseFromVec(x,y){
  const th = Math.atan2(x,y); // atan2(E,N)
  let deg = th * 180 / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}
function mag(x,y){ return Math.sqrt(x*x + y*y); }

document.getElementById("btnCalcSetDrift")?.addEventListener("click", ()=>{
  const C = norm360(crs.value);
  const STW = Number(stw.value);
  const SET = norm360(set.value);
  const DRIFT = Number(drift.value);

  if (C === null || !Number.isFinite(STW) || STW < 0 || SET === null || !Number.isFinite(DRIFT) || DRIFT < 0){
    alert("Sprawdź wartości: KR 0–359, STW ≥ 0, SET 0–359, DRIFT ≥ 0.");
    return;
  }

  const v1 = vecFromCourseSpeed(C, STW);
  const v2 = vecFromCourseSpeed(SET, DRIFT);

  const vx = v1.x + v2.x;
  const vy = v1.y + v2.y;

  const COG = courseFromVec(vx, vy);
  const SOG = mag(vx, vy);

  // znos = różnica między KR a COG (najmniejszy kąt)
  let diff = ((COG - C + 540) % 360) - 180;

  outCOG.textContent = fmtDeg(COG);
  outSOG.textContent = fmtKn(SOG);
  outLeeway.textContent = `${diff.toFixed(0)}°`;
  setExplain.textContent = `Wektorowo: (STW na KR) + (DRIFT na SET) → COG/SOG. Znos = COG − KR.`;
});

document.getElementById("btnResetSetDrift")?.addEventListener("click", ()=>{
  crs.value = "";
  stw.value = "";
  set.value = "";
  drift.value = "";
  outCOG.textContent = "—";
  outSOG.textContent = "—";
  outLeeway.textContent = "—";
  setExplain.textContent = "";
});

/* ===== ETA ===== */
const dist = document.getElementById("dist");
const spd = document.getElementById("spd");
const startTime = document.getElementById("startTime");
const outTime = document.getElementById("outTime");
const outETA = document.getElementById("outETA");
const etaExplain = document.getElementById("etaExplain");

document.getElementById("btnCalcETA")?.addEventListener("click", ()=>{
  const D = Number(dist.value);
  const V = Number(spd.value);
  if (!Number.isFinite(D) || D < 0 || !Number.isFinite(V) || V <= 0){
    alert("Dystans ≥ 0, prędkość > 0.");
    return;
  }

  const hours = D / V;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  const totalMin = h*60 + m;
  outTime.textContent = `${h} h ${String(m).padStart(2,"0")} min`;

  const st = startTime.value; // "HH:MM"
  if (st){
    const [HH, MM] = st.split(":").map(Number);
    const startMin = HH*60 + MM;
    const etaMin = (startMin + totalMin) % (24*60);
    const eH = Math.floor(etaMin/60);
    const eM = etaMin%60;
    outETA.textContent = `${String(eH).padStart(2,"0")}:${String(eM).padStart(2,"0")}`;
    etaExplain.textContent = `ETA = start + czas. Uwaga: bez stref czasowych i postojów (MVP).`;
  } else {
    outETA.textContent = "—";
    etaExplain.textContent = `Wpisz godzinę startu, żeby policzyć ETA.`;
  }
});

document.getElementById("btnResetETA")?.addEventListener("click", ()=>{
  dist.value = "";
  spd.value = "";
  startTime.value = "";
  outTime.textContent = "—";
  outETA.textContent = "—";
  etaExplain.textContent = "";
});
