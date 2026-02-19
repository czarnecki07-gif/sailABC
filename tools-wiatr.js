// sailABC Tools — Kalkulator wiatru pozornego (TWS/TWA + STW -> AWS/AWA)
//
// Założenia:
// - TWA liczone względem osi jachtu: 0° z dziobu, 180° z rufy
// - znak TWA: + prawa burta, - lewa burta
// - obliczenia wektorowe w układzie jachtu (x do przodu, y na prawą burtę)

const elTws = document.getElementById("tws");
const elTwa = document.getElementById("twa");
const elStw = document.getElementById("stw");

const elAws = document.getElementById("aws");
const elAwa = document.getElementById("awa");
const elSide = document.getElementById("side");
const elExplain = document.getElementById("explain");

function deg2rad(d){ return d * Math.PI / 180; }
function rad2deg(r){ return r * 180 / Math.PI; }

function fmtKn(x){
  if(!Number.isFinite(x)) return "—";
  return `${(Math.round(x*10)/10).toFixed(1)} kn`;
}

function fmtDegSigned(d){
  if(!Number.isFinite(d)) return "—";
  const s = d >= 0 ? "+" : "−";
  return `${s}${String(Math.round(Math.abs(d))).padStart(2,"0")}°`;
}

function calc(){
  const TWS = Number(elTws.value);
  const TWA = Number(elTwa.value); // signed
  const STW = Number(elStw.value);

  if(!Number.isFinite(TWS) || TWS < 0) return alert("TWS musi być liczbą ≥ 0.");
  if(!Number.isFinite(TWA) || TWA < -180 || TWA > 180) return alert("TWA musi być w zakresie -180…180.");
  if(!Number.isFinite(STW) || STW < 0) return alert("STW musi być liczbą ≥ 0.");

  // True wind vector relative to boat:
  // Wind comes "from" direction TWA, so air flows opposite.
  // We'll model wind velocity vector (air relative to earth) as pointing TO the boat:
  // If wind is FROM +45°, airflow direction is FROM that angle towards boat => vector points from front-right to center.
  // In boat coords: x forward, y starboard.
  // "From" angle alpha => wind vector components:
  // wx = -TWS * cos(alpha)
  // wy = -TWS * sin(alpha)
  const a = deg2rad(TWA);
  const wx = -TWS * Math.cos(a);
  const wy = -TWS * Math.sin(a);

  // Boat velocity through water in boat coords: forward +STW
  const bx = STW;
  const by = 0;

  // Apparent wind = wind - boat_velocity (in same frame)
  const ax = wx - bx;
  const ay = wy - by;

  const AWS = Math.hypot(ax, ay);

  // Apparent wind angle (FROM) relative to bow:
  // We need angle of vector pointing to boat (airflow), then convert to "from" angle.
  // Our apparent vector (ax,ay) is airflow TO the boat.
  // "From" direction is opposite: (-ax, -ay)
  const fromX = -ax;
  const fromY = -ay;

  // atan2(y,x) gives angle of "from" direction in boat coords
  let ang = rad2deg(Math.atan2(fromY, fromX)); // -180..180, where + is starboard
  // Normalize to [-180,180]
  if(ang > 180) ang -= 360;
  if(ang < -180) ang += 360;

  const side = ang === 0 ? "dziób" : (ang > 0 ? "prawa (S)" : "lewa (P)");

  elAws.textContent = fmtKn(AWS);
  elAwa.textContent = fmtDegSigned(ang);
  elSide.textContent = side;

  const absAwa = Math.abs(ang);
  const note =
    absAwa < 30 ? "Wiatr bardzo „z przodu” — zwykle ostro na wiatr."
    : absAwa < 90 ? "Wiatr z baksztagu/bajdewindu — typowy trym na kursy ostre/pełne."
    : "Wiatr z rufy/ćwiartki rufowej — kursy pełne, grozi giczą (uważaj na zwroty przez rufę).";

  elExplain.textContent =
    `Dla TWS=${TWS.toFixed(1)} kn, TWA=${fmtDegSigned(TWA)}, STW=${STW.toFixed(1)} kn: ` +
    `wiatr pozorny ma AWS=${(Math.round(AWS*10)/10).toFixed(1)} kn i AWA=${fmtDegSigned(ang)} (${side}). ` +
    note;
}

document.getElementById("btnCalc")?.addEventListener("click", calc);

document.getElementById("btnReset")?.addEventListener("click", ()=>{
  elTws.value = "12";
  elTwa.value = "45";
  elStw.value = "6";
  elAws.textContent = "—";
  elAwa.textContent = "—";
  elSide.textContent = "—";
  elExplain.textContent = "";
});

// przelicz automatycznie po zmianie (lekki debounce)
let t = null;
[elTws, elTwa, elStw].forEach(el=>{
  el?.addEventListener("input", ()=>{
    clearTimeout(t);
    t = setTimeout(()=>calc(), 180);
  });
});

// start
calc();
