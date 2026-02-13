// weather.js — REALNA pogoda (Open-Meteo) + mapa Leaflet
// Działa po kliknięciu mapy lub wpisaniu miejsca.
// Usunięte: okno z kodem JSON.

let map;
let marker = null;
let picked = null;

// Sekcja pogody
const elPlace = document.getElementById("place");
const elBtnSearchPlace = document.getElementById("btnSearchPlace");
const elBtnCheckWeather = document.getElementById("btnCheckWeather");
const elPickedInfo = document.getElementById("pickedInfo");

const elWWind = document.getElementById("wWind");
const elWWindSub = document.getElementById("wWindSub");
const elWTemp = document.getElementById("wTemp");
const elWTime = document.getElementById("wTime");

// Panel górny (hero)
const elHeroPlace = document.getElementById("heroPlace");
const elHeroSearch = document.getElementById("heroSearch");
const elHeroCheck = document.getElementById("heroCheck");

const elHeroWind = document.getElementById("heroWind");
const elHeroWindSub = document.getElementById("heroWindSub");
const elHeroTemp = document.getElementById("heroTemp");
const elHeroTime = document.getElementById("heroTime");
const elHeroWave = document.getElementById("heroWave");
const elHeroWaveSub = document.getElementById("heroWaveSub");

function beaufortFromMs(ms) {
  const limits = [0.5,1.6,3.4,5.5,8.0,10.8,13.9,17.2,20.8,24.5,28.5,32.7];
  let b = 0;
  while (b < limits.length && ms >= limits[b]) b++;
  return b;
}

function degToCompass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const i = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[i];
}

function msToKn(ms){ return ms * 1.943844; }

function setPicked(lat, lon, label){
  picked = { lat, lon, label };

  if (elBtnCheckWeather) elBtnCheckWeather.disabled = false;
  if (elHeroCheck) elHeroCheck.disabled = false;

  if (elPickedInfo){
    elPickedInfo.textContent =
      `Wybrane: ${label} (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  }

  if (map){
    if (!marker) marker = L.marker([lat, lon]).addTo(map);
    marker.setLatLng([lat, lon]);
    map.setView([lat, lon], Math.max(map.getZoom(), 10));
  }
}

async function geocodePlace(q){
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "pl");
  url.searchParams.set("format", "json");

  const r = await fetch(url.toString());
  const data = await r.json();

  if (!data.results || !data.results.length){
    throw new Error("Nie znaleziono miejsca.");
  }

  const b = data.results[0];
  const label = [b.name, b.admin1, b.country].filter(Boolean).join(", ");

  return { lat: b.latitude, lon: b.longitude, label };
}

async function fetchWeather(lat, lon){
  const forecast = new URL("https://api.open-meteo.com/v1/forecast");
  forecast.searchParams.set("latitude", lat);
  forecast.searchParams.set("longitude", lon);
  forecast.searchParams.set("timezone", "auto");
  forecast.searchParams.set(
    "current",
    "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
  );

  const marine = new URL("https://marine-api.open-meteo.com/v1/marine");
  marine.searchParams.set("latitude", lat);
  marine.searchParams.set("longitude", lon);
  marine.searchParams.set("timezone", "auto");
  marine.searchParams.set("current", "wave_height,wave_direction,wave_period");

  const [rf, rm] = await Promise.all([
    fetch(forecast.toString()),
    fetch(marine.toString())
  ]);

  const f = await rf.json();
  const m = await rm.json();

  const c = f.current;
  const mc = m.current || {};

  const windMs = c.wind_speed_10m / 3.6;
  const gustMs = c.wind_gusts_10m / 3.6;

  return {
    time: c.time,
    temp: c.temperature_2m,
    windBf: beaufortFromMs(windMs),
    windKn: msToKn(windMs).toFixed(1),
    gustKn: msToKn(gustMs).toFixed(1),
    windDir: degToCompass(c.wind_direction_10m),
    windDeg: Math.round(c.wind_direction_10m),

    waveH: typeof mc.wave_height === "number" ? mc.wave_height : null,
    waveDir: typeof mc.wave_direction === "number"
      ? degToCompass(mc.wave_direction)
      : null,
    waveP: typeof mc.wave_period === "number"
      ? mc.wave_period
      : null
  };
}

function renderWeather(w){

  if (elWWind) elWWind.textContent = `${w.windBf}°B`;
  if (elWWindSub)
    elWWindSub.textContent =
      `${w.windDir} (${w.windDeg}°) • ${w.windKn} kn • porywy ${w.gustKn} kn`;

  if (elWTemp) elWTemp.textContent = `${Math.round(w.temp)}°C`;
  if (elWTime) elWTime.textContent = `czas: ${w.time}`;

  // HERO
  if (elHeroWind) elHeroWind.textContent = `${w.windBf}°B`;
  if (elHeroWindSub)
    elHeroWindSub.textContent =
      `${w.windDir} • ${w.windKn} kn (porywy ${w.gustKn} kn)`;

  if (elHeroTemp) elHeroTemp.textContent = `${Math.round(w.temp)}°C`;
  if (elHeroTime) elHeroTime.textContent = w.time;

  if (elHeroWave){
    elHeroWave.textContent =
      w.waveH == null ? "—" : `${w.waveH.toFixed(1)} m`;
  }

  if (elHeroWaveSub){
    elHeroWaveSub.textContent =
      w.waveH == null
        ? "fala: brak danych (punkt na lądzie)"
        : `${w.waveDir} • okres ${Math.round(w.waveP)} s`;
  }
}

async function checkWeather(){
  if (!picked){
    const q = (elPlace?.value || elHeroPlace?.value || "").trim();
    if (!q) return;

    const g = await geocodePlace(q);
    setPicked(g.lat, g.lon, g.label);
  }

  const w = await fetchWeather(picked.lat, picked.lon);
  renderWeather(w);
}

function initMap(){
  const mapEl = document.getElementById("weatherMap");
  if (!mapEl) return;

  map = L.map("weatherMap").setView([53.5,16.2], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  map.on("click", (e)=>{
    setPicked(e.latlng.lat, e.latlng.lng, "Punkt na mapie");
  });
}

function bind(){

  elPlace?.addEventListener("input", ()=>{
    if (elBtnCheckWeather) elBtnCheckWeather.disabled = false;
  });

  elBtnSearchPlace?.addEventListener("click", async ()=>{
    try{
      const g = await geocodePlace(elPlace.value);
      setPicked(g.lat, g.lon, g.label);
      await checkWeather();
    }catch(e){ alert(e.message); }
  });

  elBtnCheckWeather?.addEventListener("click", async ()=>{
    try{ await checkWeather(); }
    catch(e){ alert("Błąd pobierania pogody"); }
  });

  elHeroSearch?.addEventListener("click", async ()=>{
    try{
      const g = await geocodePlace(elHeroPlace.value);
      setPicked(g.lat, g.lon, g.label);
      await checkWeather();
    }catch(e){ alert(e.message); }
  });

  elHeroCheck?.addEventListener("click", async ()=>{
    try{ await checkWeather(); }
    catch(e){ alert("Błąd pobierania pogody"); }
  });
}

initMap();
bind();
