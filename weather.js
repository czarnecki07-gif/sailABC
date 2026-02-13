// weather.js — REALNA pogoda bez backendu (Open-Meteo + Open-Meteo Marine + Open-Meteo Geocoding)
// Działa po: kliknięciu punktu na mapie lub wpisaniu miejsca + „Sprawdź”
// Aktualizuje: sekcję #pogoda + panel na górze (hero), jeśli masz tam odpowiednie ID.

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

// HERO (panel u góry) — jeśli masz te elementy w HTML, zaktualizują się automatycznie:
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
  const limits = [0.5, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  let b = 0;
  while (b < limits.length && ms >= limits[b]) b++;
  return b;
}

function degToCompass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const i = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[i];
}

function msToKn(ms) {
  return ms * 1.943844;
}

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

async function geocodeOpenMeteo(q) {
  const u = new URL("https://geocoding-api.open-meteo.com/v1/search");
  u.searchParams.set("name", q);
  u.searchParams.set("count", "5");
  u.searchParams.set("language", "pl");
  u.searchParams.set("format", "json");

  const r = await fetch(u.toString());
  const data = await r.json().catch(() => null);

  if (!r.ok || !data || !data.results || data.results.length === 0) {
    throw new Error("Nie znaleziono miejsca. Spróbuj inaczej albo kliknij punkt na mapie.");
  }

  const best = data.results[0];
  const label = [best.name, best.admin1, best.country].filter(Boolean).join(", ");

  return { lat: best.latitude, lon: best.longitude, label };
}

async function fetchOpenMeteoWeather(lat, lon) {
  // Forecast (wiatr/temperatura/ciśnienie itd.)
  const forecast = new URL("https://api.open-meteo.com/v1/forecast");
  forecast.searchParams.set("latitude", String(lat));
  forecast.searchParams.set("longitude", String(lon));
  forecast.searchParams.set("timezone", "auto");
  forecast.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "showers",
      "snowfall",
      "cloud_cover",
      "pressure_msl",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(",")
  );

  // Marine (fala) — może zwrócić brak danych na lądzie
  const marine = new URL("https://marine-api.open-meteo.com/v1/marine");
  marine.searchParams.set("latitude", String(lat));
  marine.searchParams.set("longitude", String(lon));
  marine.searchParams.set("timezone", "auto");
  marine.searchParams.set("current", ["wave_height","wave_direction","wave_period"].join(","));

  const [rf, rm] = await Promise.all([
    fetch(forecast.toString()),
    fetch(marine.toString()),
  ]);

  const df = await rf.json().catch(() => null);
  const dm = await rm.json().catch(() => null);

  if (!rf.ok || !df || !df.current) throw new Error("Nie udało się pobrać prognozy (Open-Meteo).");

  const c = df.current;
  const mc = dm?.current || {};

  // Open-Meteo: wind_speed_10m i gusty są w km/h → m/s
  const windMs = (c.wind_speed_10m ?? 0) / 3.6;
  const gustMs = (c.wind_gusts_10m ?? 0) / 3.6;
  const windDeg = Number(c.wind_direction_10m ?? 0);

  const windKn = msToKn(windMs);
  const gustKn = msToKn(gustMs);

  const out = {
    location: { lat, lon },
    current: {
      time_local: c.time,
      temperature_c: c.temperature_2m,
      apparent_temperature_c: c.apparent_temperature,
      pressure_hpa: c.pressure_msl,
      cloud_cover_pct: c.cloud_cover,
      precipitation_mm: c.precipitation,
      rain_mm: c.rain,
      showers_mm: c.showers,
      snowfall_cm: c.snowfall,
      wind: {
        beaufort: beaufortFromMs(windMs),
        speed_ms: Number(windMs.toFixed(1)),
        speed_kn: Number(windKn.toFixed(1)),
        gust_ms: Number(gustMs.toFixed(1)),
        gust_kn: Number(gustKn.toFixed(1)),
        dir_deg: Math.round(((windDeg % 360) + 360) % 360),
        dir_compass: degToCompass(windDeg),
      },
      marine: {
        wave_height_m: (typeof mc.wave_height === "number") ? mc.wave_height : null,
        wave_period_s: (typeof mc.wave_period === "number") ? mc.wave_period : null,
        wave_dir_deg: (typeof mc.wave_direction === "number") ? mc.wave_direction : null,
        wave_dir_compass: (typeof mc.wave_direction === "number") ? degToCompass(mc.wave_direction) : null,
      }
    }
  };

  return out;
}

function renderWeather(data) {
  const c = data.current;
  const w = c.wind;
  const m = c.marine;

  // Sekcja #pogoda
  if (elWWind) elWWind.textContent = `${w.beaufort}°B`;
  if (elWWindSub) elWWindSub.textContent = `${w.dir_compass} (${w.dir_deg}°) • ${w.speed_kn} kn • porywy ${w.gust_kn} kn`;
  if (elWTemp) elWTemp.textContent = `${Math.round(c.temperature_c)}°C`;
  if (elWTime) elWTime.textContent = `czas: ${c.time_local}`;
  if (elWRaw) elWRaw.textContent = JSON.stringify(data, null, 2);

  // HERO (góra) — jeśli istnieje
  if (elHeroWind) elHeroWind.textContent = `${w.beaufort}°B`;
  if (elHeroWindSub) elHeroWindSub.textContent = `${w.dir_compass} • ${w.speed_kn} kn (porywy ${w.gust_kn} kn)`;
  if (elHeroTemp) elHeroTemp.textContent = `${Math.round(c.temperature_c)}°C`;
  if (elHeroTime) elHeroTime.textContent = c.time_local;

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

  const g = await geocodeOpenMeteo(q);
  setPicked(Number(g.lat), Number(g.lon), g.label);

  // synchronizuj oba pola
  if (elPlace && inputEl !== elPlace) elPlace.value = q;
  if (elHeroPlace && inputEl !== elHeroPlace) elHeroPlace.value = q;
}

async function checkWeather() {
  if (!picked) return;
  const data = await fetchOpenMeteoWeather(picked.lat, picked.lon);
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
  // Sekcja #pogoda
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

  // HERO (góra)
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
