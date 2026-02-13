// weather.js — Leaflet + wyszukiwanie miejsca + pobieranie realnych danych z /api/*
// Wymaga backendu: /api/geocode i /api/weather (np. Cloudflare Worker)

let map;
let marker = null;
let picked = null; // { lat, lon, label }

const elPlace = document.getElementById("place");
const elBtnSearchPlace = document.getElementById("btnSearchPlace");
const elBtnCheckWeather = document.getElementById("btnCheckWeather");
const elPickedInfo = document.getElementById("pickedInfo");

const elWWind = document.getElementById("wWind");
const elWWindSub = document.getElementById("wWindSub");
const elWTemp = document.getElementById("wTemp");
const elWTime = document.getElementById("wTime");
const elWRaw = document.getElementById("wRaw");

// HERO (panel na górze)
const elHeroPlace = document.getElementById("heroPlace");
const elHeroSearch = document.getElementById("heroSearch");
const elHeroCheck = document.getElementById("heroCheck");

const elHeroWind = document.getElementById("heroWind");
const elHeroWindSub = document.getElementById("heroWindSub");
const elHeroTemp = document.getElementById("heroTemp");
const elHeroTime = document.getElementById("heroTime");
const elHeroWave = document.getElementById("heroWave");
const elHeroWaveSub = document.getElementById("heroWaveSub");

function setPicked(lat, lon, label) {
  picked = { lat, lon, label: label || `${lat.toFixed(4)}, ${lon.toFixed(4)}` };

  if (elBtnCheckWeather) elBtnCheckWeather.disabled = false;
  if (elHeroCheck) elHeroCheck.disabled = false;

  if (elPickedInfo) {
    elPickedInfo.textContent = `Wybrane: ${picked.label} (${picked.lat.toFixed(4)}, ${picked.lon.toFixed(4)})`;
  }

  if (map) {
    if (!marker) marker = L.marker([lat, lon]).addTo(map);
    marker.setLatLng([lat, lon]);
    map.setView([lat, lon], Math.max(map.getZoom(), 10));
  }
}

async function apiGeocode(q) {
  const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) throw new Error(data?.error || "Błąd geokodowania.");
  return data;
}

async function apiWeather(lat, lon) {
  const r = await fetch(`/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) throw new Error(data?.error || "Błąd pobierania pogody.");
  return data;
}

function renderWeather(data) {
  const c = data.current;
  const w = c.wind;
  const m = c.marine;

  // Sekcja pogoda
  if (elWWind) elWWind.textContent = `${w.beaufort}°B`;
  if (elWWindSub) {
    elWWindSub.textContent = `${w.dir_compass} (${Math.round(w.dir_deg)}°) • ${w.speed_kn} kn • porywy ${w.gust_kn} kn`;
  }
  if (elWTemp) elWTemp.textContent = `${Math.round(c.temperature_c)}°C`;
  if (elWTime) elWTime.textContent = `czas: ${c.time_local}`;
  if (elWRaw) elWRaw.textContent = JSON.stringify(data, null, 2);

  // HERO
  if (elHeroWind) elHeroWind.textContent = `${w.beaufort}°B`;
  if (elHeroWindSub) elHeroWindSub.textContent = `${w.dir_compass} • ${w.speed_kn} kn (porywy ${w.gust_kn} kn)`;
  if (elHeroTemp) elHeroTemp.textContent = `${Math.round(c.temperature_c)}°C`;
  if (elHeroTime) elHeroTime.textContent = c.time_local;

  // Fala (jeśli dostępna)
  if (elHeroWave) {
    elHeroWave.textContent = (m.wave_height_m == null) ? "—" : `${m.wave_height_m.toFixed(1)} m`;
  }
  if (elHeroWaveSub) {
    if (m.wave_height_m == null) {
      elHeroWaveSub.textContent = "fala: brak danych (punkt na lądzie)";
    } else {
      const dir = m.wave_dir_compass ?? "—";
      const per = (m.wave_period_s == null) ? "—" : `${m.wave_period_s.toFixed(0)} s`;
      elHeroWaveSub.textContent = `${dir} • okres ${per}`;
    }
  }
}

async function searchAndPick(inputEl) {
  const q = (inputEl?.value || "").trim();
  if (!q) return;

  const g = await apiGeocode(q);
  setPicked(Number(g.lat), Number(g.lon), g.display_name);

  // synchronizuj oba pola
  if (elPlace && inputEl !== elPlace) elPlace.value = q;
  if (elHeroPlace && inputEl !== elHeroPlace) elHeroPlace.value = q;
}

async function checkWeather() {
  if (!picked) return;
  const data = await apiWeather(picked.lat, picked.lon);
  renderWeather(data);
}

function initMap() {
  const mapEl = document.getElementById("weatherMap");
  if (!mapEl) return;

  map = L.map("weatherMap").setView([53.5, 16.2], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 18
  }).addTo(map);

  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    setPicked(lat, lng, "Punkt na mapie");
  });
}

function bind() {
  // Sekcja pogoda
  elBtnSearchPlace?.addEventListener("click", async () => {
    try { await searchAndPick(elPlace); } catch (e) { alert(e.message); }
  });
  elBtnCheckWeather?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (e) { alert(e.message); }
  });

  elPlace?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      try { await searchAndPick(elPlace); } catch (err) { alert(err.message); }
    }
  });

  // HERO
  elHeroSearch?.addEventListener("click", async () => {
    try { await searchAndPick(elHeroPlace); } catch (e) { alert(e.message); }
  });
  elHeroCheck?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (e) { alert(e.message); }
  });

  elHeroPlace?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      try { await searchAndPick(elHeroPlace); } catch (err) { alert(err.message); }
    }
  });
}

initMap();
bind();
