// weather.js — REALNA pogoda (Open-Meteo) + mapa Leaflet + prognoza 7 dni
// Działa po kliknięciu mapy lub wpisaniu miejsca + „Sprawdź”.
// Wpisany tekst ma zawsze pierwszeństwo nad mapą.

let map;
let marker = null;
let picked = null;

// Sekcja pogody (current)
const elPlace = document.getElementById("place");
const elBtnSearchPlace = document.getElementById("btnSearchPlace");
const elBtnCheckWeather = document.getElementById("btnCheckWeather");
const elPickedInfo = document.getElementById("pickedInfo");

const elWWind = document.getElementById("wWind");
const elWWindSub = document.getElementById("wWindSub");
const elWTemp = document.getElementById("wTemp");
const elWTime = document.getElementById("wTime");

// Prognoza 7 dni (daily)
const elForecast7 = document.getElementById("forecast7");
const elForecastMeta = document.getElementById("forecastMeta");

// Panel górny (hero) — jeśli masz te elementy w HTML
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

function msToKn(ms) { return ms * 1.943844; }

function setPicked(lat, lon, label) {
  picked = { lat, lon, label: label || "Punkt" };

  if (elBtnCheckWeather) elBtnCheckWeather.disabled = false;
  if (elHeroCheck) elHeroCheck.disabled = false;

  if (elPickedInfo) {
    elPickedInfo.textContent = `Wybrane: ${picked.label} (${picked.lat.toFixed(4)}, ${picked.lon.toFixed(4)})`;
  }

  if (elForecastMeta) {
    elForecastMeta.textContent = `Prognoza dla: ${picked.label}`;
  }

  if (map) {
    if (!marker) marker = L.marker([lat, lon]).addTo(map);
    marker.setLatLng([lat, lon]);
    map.setView([lat, lon], Math.max(map.getZoom(), 10));
  }
}

async function geocodePlace(q) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "pl");
  url.searchParams.set("format", "json");

  const r = await fetch(url.toString());
  const data = await r.json().catch(() => null);

  if (!r.ok || !data || !data.results || !data.results.length) {
    throw new Error("Nie znaleziono miejsca. Spróbuj inaczej albo kliknij punkt na mapie.");
  }

  const b = data.results[0];
  const label = [b.name, b.admin1, b.country].filter(Boolean).join(", ");
  return { lat: b.latitude, lon: b.longitude, label };
}

async function fetchWeather(lat, lon) {
  // current + daily jednym strzałem
  const forecast = new URL("https://api.open-meteo.com/v1/forecast");
  forecast.searchParams.set("latitude", String(lat));
  forecast.searchParams.set("longitude", String(lon));
  forecast.searchParams.set("timezone", "auto");

  // CURRENT
  forecast.searchParams.set(
    "current",
    "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover"
  );

  // DAILY (7 dni)
  forecast.searchParams.set(
    "daily",
    [
      "temperature_2m_max",
      "temperature_2m_min",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "wind_direction_10m_dominant",
      "precipitation_sum",
      "cloud_cover_mean"
    ].join(",")
  );

  // Marine (fala)
  const marine = new URL("https://marine-api.open-meteo.com/v1/marine");
  marine.searchParams.set("latitude", String(lat));
  marine.searchParams.set("longitude", String(lon));
  marine.searchParams.set("timezone", "auto");
  marine.searchParams.set("current", "wave_height,wave_direction,wave_period");

  const [rf, rm] = await Promise.all([fetch(forecast.toString()), fetch(marine.toString())]);

  const f = await rf.json().catch(() => null);
  const m = await rm.json().catch(() => null);

  if (!rf.ok || !f || !f.current) throw new Error("Nie udało się pobrać pogody (Open-Meteo).");

  const c = f.current;
  const d = f.daily || {};
  const mc = m?.current || {};

  // Open-Meteo: km/h -> m/s
  const windMs = (c.wind_speed_10m ?? 0) / 3.6;
  const gustMs = (c.wind_gusts_10m ?? 0) / 3.6;

  const windKn = msToKn(windMs);
  const gustKn = msToKn(gustMs);
  const windDeg = Number(c.wind_direction_10m ?? 0);

  return {
    current: {
      time: c.time,
      temp: c.temperature_2m,
      precip: c.precipitation,
      cloud: c.cloud_cover,
      windBf: beaufortFromMs(windMs),
      windKn: Number(windKn.toFixed(1)),
      gustKn: Number(gustKn.toFixed(1)),
      windDir: degToCompass(windDeg),
      windDeg: Math.round(((windDeg % 360) + 360) % 360),
      waveH: (typeof mc.wave_height === "number") ? mc.wave_height : null,
      waveDir: (typeof mc.wave_direction === "number") ? degToCompass(mc.wave_direction) : null,
      waveP: (typeof mc.wave_period === "number") ? mc.wave_period : null
    },
    daily: {
      time: d.time || [],
      tmax: d.temperature_2m_max || [],
      tmin: d.temperature_2m_min || [],
      windMax: d.wind_speed_10m_max || [],       // km/h
      gustMax: d.wind_gusts_10m_max || [],       // km/h
      windDirDom: d.wind_direction_10m_dominant || [],
      precipSum: d.precipitation_sum || [],     // mm
      cloudMean: d.cloud_cover_mean || []       // %
    }
  };
}

function renderCurrent(c) {
  if (elWWind) elWWind.textContent = `${c.windBf}°B`;
  if (elWWindSub) elWWindSub.textContent = `${c.windDir} (${c.windDeg}°) • ${c.windKn} kn • porywy ${c.gustKn} kn`;
  if (elWTemp) elWTemp.textContent = `${Math.round(c.temp)}°C`;
  if (elWTime) elWTime.textContent = `czas: ${c.time} • opad: ${c.precip ?? 0} mm • zachmurzenie: ${c.cloud ?? 0}%`;

  // HERO
  if (elHeroWind) elHeroWind.textContent = `${c.windBf}°B`;
  if (elHeroWindSub) elHeroWindSub.textContent = `${c.windDir} • ${c.windKn} kn (porywy ${c.gustKn} kn)`;
  if (elHeroTemp) elHeroTemp.textContent = `${Math.round(c.temp)}°C`;
  if (elHeroTime) elHeroTime.textContent = c.time;

  if (elHeroWave) elHeroWave.textContent = (c.waveH == null) ? "—" : `${c.waveH.toFixed(1)} m`;
  if (elHeroWaveSub) {
    elHeroWaveSub.textContent =
      (c.waveH == null)
        ? "fala: brak danych (punkt na lądzie)"
        : `${c.waveDir} • okres ${Math.round(c.waveP)} s`;
  }
}

function formatDayLabel(isoDate) {
  // isoDate = YYYY-MM-DD
  const dt = new Date(isoDate + "T00:00:00");
  const days = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
  const d = days[dt.getDay()];
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${d} ${dd}.${mm}`;
}

function renderForecast(d) {
  if (!elForecast7) return;

  const n = Math.min(7, d.time.length);
  if (!n) {
    elForecast7.innerHTML = `<div class="muted">Brak danych prognozy.</div>`;
    return;
  }

  const items = [];
  for (let i = 0; i < n; i++) {
    const label = formatDayLabel(d.time[i]);

    const tmax = Math.round(d.tmax[i] ?? 0);
    const tmin = Math.round(d.tmin[i] ?? 0);

    // km/h -> kn
    const windMaxKn = msToKn((d.windMax[i] ?? 0) / 3.6);
    const gustMaxKn = msToKn((d.gustMax[i] ?? 0) / 3.6);
    const windDir = degToCompass(d.windDirDom[i] ?? 0);
    const bf = beaufortFromMs(((d.windMax[i] ?? 0) / 3.6));

    const precip = (d.precipSum[i] ?? 0).toFixed(1);
    const cloud = Math.round(d.cloudMean[i] ?? 0);

    items.push(`
      <div class="forecast-day">
        <div class="forecast-top">
          <div class="forecast-date">${label}</div>
          <div class="forecast-temp">${tmin}–${tmax}°C</div>
        </div>
        <div class="forecast-row">
          <span>Wiatr: <strong>${bf}°B</strong> ${windDir}</span>
          <span>${windMaxKn.toFixed(0)} kn</span>
          <span>porywy ${gustMaxKn.toFixed(0)} kn</span>
        </div>
        <div class="forecast-row">
          <span>Opady: <strong>${precip} mm</strong></span>
          <span>Zachmurzenie: <strong>${cloud}%</strong></span>
        </div>
      </div>
    `);
  }

  elForecast7.innerHTML = items.join("");
}

async function checkWeather() {
  // tekst ma pierwszeństwo
  const q = (elPlace?.value || elHeroPlace?.value || "").trim();

  if (q) {
    const g = await geocodePlace(q);
    setPicked(g.lat, g.lon, g.label);
  }

  if (!picked) {
    alert("Wpisz miejsce albo kliknij punkt na mapie.");
    return;
  }

  const data = await fetchWeather(picked.lat, picked.lon);
  renderCurrent(data.current);
  renderForecast(data.daily);
}

function initMap() {
  const mapEl = document.getElementById("weatherMap");
  if (!mapEl) return;

  map = L.map("weatherMap").setView([53.5, 16.2], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  map.on("click", (e) => {
    setPicked(e.latlng.lat, e.latlng.lng, "Punkt na mapie");
  });
}

function bind() {
  elPlace?.addEventListener("input", () => {
    picked = null;
    if (elBtnCheckWeather) elBtnCheckWeather.disabled = false;
  });

  elHeroPlace?.addEventListener("input", () => {
    picked = null;
    if (elHeroCheck) elHeroCheck.disabled = false;
  });

  elBtnSearchPlace?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (e) { alert(e.message); }
  });

  elBtnCheckWeather?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (_) { alert("Błąd pobierania pogody"); }
  });

  elPlace?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      try { await checkWeather(); } catch (_) { alert("Błąd pobierania pogody"); }
    }
  });

  elHeroSearch?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (e) { alert(e.message); }
  });

  elHeroCheck?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (_) { alert("Błąd pobierania pogody"); }
  });

  elHeroPlace?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      try { await checkWeather(); } catch (_) { alert("Błąd pobierania pogody"); }
    }
  });
}

initMap();
bind();
