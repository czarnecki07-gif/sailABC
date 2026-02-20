// weather.js — Open-Meteo + Leaflet
// - CURRENT: temperatura, wiatr, kierunek, porywy, opad, zachmurzenie + Beaufort
// - HOURLY 24H: następne 24 godziny od momentu sprawdzania (z porywami + Beaufort)
// - DAILY 7D: wierszami (z ikonkami + Beaufort)
// Jednostki: km/h

let map;
let marker = null;
let picked = null;

const elPlace = document.getElementById("place");
const elBtnSearchPlace = document.getElementById("btnSearchPlace");
const elBtnCheckWeather = document.getElementById("btnCheckWeather");
const elPickedInfo = document.getElementById("pickedInfo");

const elWWind = document.getElementById("wWind");
const elWWindSub = document.getElementById("wWindSub");
const elWTemp = document.getElementById("wTemp");
const elWTime = document.getElementById("wTime");

const elHourlyMeta = document.getElementById("hourlyMeta");
const elForecast24 = document.getElementById("forecast24");

const elForecast7 = document.getElementById("forecast7");
const elForecastMeta = document.getElementById("forecastMeta");

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

function pad2(n){ return String(n).padStart(2, "0"); }

function formatHour(iso) {
  const t = iso.split("T")[1] || "";
  return t.slice(0,5);
}

function formatDayLabel(isoDate) {
  const dt = new Date(isoDate + "T00:00:00");
  const days = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
  const d = days[dt.getDay()];
  const dd = pad2(dt.getDate());
  const mm = pad2(dt.getMonth() + 1);
  return `${d} ${dd}.${mm}`;
}

/** Ikony dzień/noc (prosto i czytelnie) */
function wxIcon(code, isDay = true) {
  const c = Number(code);
  const day = isDay === true;

  if (!day) {
    // noc
    if (c === 0) return "🌙";
    if (c === 1) return "🌙☁️";
    if (c === 2) return "🌙☁️";
    if (c === 3) return "☁️";
    if ([45,48].includes(c)) return "🌫️";
    if ([51,53,55,56,57].includes(c)) return "🌧️";
    if ([61,63,65,66,67].includes(c)) return "🌧️";
    if ([71,73,75,77,85,86].includes(c)) return "🌨️";
    if ([80,81,82].includes(c)) return "🌧️";
    if ([95,96,99].includes(c)) return "⛈️";
  }

  // dzień
  if (c === 0) return "☀️";
  if (c === 1) return "🌤️";
  if (c === 2) return "⛅";
  if (c === 3) return "☁️";
  if ([45,48].includes(c)) return "🌫️";
  if ([51,53,55,56,57].includes(c)) return "🌦️";
  if ([61,63,65,66,67].includes(c)) return "🌧️";
  if ([71,73,75,77,85,86].includes(c)) return "🌨️";
  if ([80,81,82].includes(c)) return "🌦️";
  if ([95,96,99].includes(c)) return "⛈️";
  return "•";
}

function setPicked(lat, lon, label) {
  picked = { lat, lon, label: label || "Punkt" };

  if (elBtnCheckWeather) elBtnCheckWeather.disabled = false;

  if (elPickedInfo) {
    elPickedInfo.textContent = `Wybrane: ${picked.label} (${picked.lat.toFixed(4)}, ${picked.lon.toFixed(4)})`;
  }

  if (elForecastMeta) elForecastMeta.textContent = `Prognoza dla: ${picked.label}`;
  if (elHourlyMeta) elHourlyMeta.textContent = `Prognoza 24h dla: ${picked.label}`;

  if (map && typeof L !== "undefined") {
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
  const forecast = new URL("https://api.open-meteo.com/v1/forecast");
  forecast.searchParams.set("latitude", String(lat));
  forecast.searchParams.set("longitude", String(lon));
  forecast.searchParams.set("timezone", "auto");

  // CURRENT
  forecast.searchParams.set(
    "current",
    "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,weather_code,is_day"
  );

  // HOURLY
  forecast.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "precipitation",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
      "weather_code",
      "is_day"
    ].join(",")
  );

  // DAILY
  forecast.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "wind_direction_10m_dominant",
      "precipitation_sum"
    ].join(",")
  );

  const rf = await fetch(forecast.toString());
  const f = await rf.json().catch(() => null);

  if (!rf.ok || !f || !f.current) throw new Error("Nie udało się pobrać pogody (Open-Meteo).");
  return { current: f.current, hourly: f.hourly || null, daily: f.daily || null };
}

function renderCurrent(c) {
  const windKmh = Number(c.wind_speed_10m ?? 0);
  const gustKmh = Number(c.wind_gusts_10m ?? 0);
  const bf = beaufortFromMs(windKmh / 3.6);

  const windDeg = Number(c.wind_direction_10m ?? 0);
  const windDir = degToCompass(windDeg);

  if (elWWind) elWWind.textContent = `${bf}°B`;
  if (elWWindSub) {
    elWWindSub.textContent =
      `${windDir} (${Math.round(windDeg)}°) • ${Math.round(windKmh)} km/h • porywy ${Math.round(gustKmh)} km/h`;
  }

  if (elWTemp) elWTemp.textContent = `${Math.round(Number(c.temperature_2m ?? 0))}°C`;

  const t = c.time || "—";
  const precip = Number(c.precipitation ?? 0);
  const cloud = Number(c.cloud_cover ?? 0);
  if (elWTime) elWTime.textContent = `czas: ${t} • opad: ${precip.toFixed(1)} mm • zachmurzenie: ${cloud}%`;
}

function findHourlyStartIndex(hourlyTime) {
  const now = new Date();
  for (let i = 0; i < hourlyTime.length; i++) {
    const dt = new Date(hourlyTime[i]);
    if (dt >= now) return i;
  }
  return 0;
}

function renderForecast24(h) {
  if (!elForecast24) return;

  if (!h || !Array.isArray(h.time) || !h.time.length) {
    elForecast24.innerHTML = `<tr><td colspan="5" class="muted">Brak danych prognozy 24h.</td></tr>`;
    return;
  }

  const start = findHourlyStartIndex(h.time);
  const end = Math.min(start + 24, h.time.length);

  const rows = [];
  for (let i = start; i < end; i++) {
    const hour = formatHour(h.time[i]);
    const isDay = (h.is_day?.[i] ?? 1) === 1;
    const ic = wxIcon(h.weather_code?.[i], isDay);

    const wind = Number(h.wind_speed_10m?.[i] ?? 0);
    const gust = Number(h.wind_gusts_10m?.[i] ?? 0);
    const bf = beaufortFromMs(wind / 3.6);

    const deg = Number(h.wind_direction_10m?.[i] ?? 0);
    const dir = degToCompass(deg);

    const temp = Math.round(Number(h.temperature_2m?.[i] ?? 0));
    const precip = Number(h.precipitation?.[i] ?? 0);

    rows.push(`
      <tr>
        <td>${hour}</td>
        <td><span class="wx-ic" aria-hidden="true">${ic}</span></td>
        <td>${bf}°B • ${dir} • ${Math.round(wind)} km/h • porywy ${Math.round(gust)} km/h</td>
        <td>${temp}°C</td>
        <td>${precip.toFixed(1)} mm</td>
      </tr>
    `);
  }

  elForecast24.innerHTML = rows.join("");
}

function renderForecast7(d) {
  if (!elForecast7) return;

  if (!d || !Array.isArray(d.time) || !d.time.length) {
    elForecast7.innerHTML = `<tr><td colspan="5" class="muted">Brak danych prognozy 7 dni.</td></tr>`;
    return;
  }

  const n = Math.min(7, d.time.length);
  const rows = [];

  for (let i = 0; i < n; i++) {
    const label = formatDayLabel(d.time[i]);

    // daily nie ma is_day — bierzemy ikonę dzienną (czytelniej)
    const ic = wxIcon(d.weather_code?.[i], true);

    const tmax = Math.round(Number(d.temperature_2m_max?.[i] ?? 0));
    const tmin = Math.round(Number(d.temperature_2m_min?.[i] ?? 0));

    const wind = Number(d.wind_speed_10m_max?.[i] ?? 0);
    const gust = Number(d.wind_gusts_10m_max?.[i] ?? 0);
    const bf = beaufortFromMs(wind / 3.6);

    const deg = Number(d.wind_direction_10m_dominant?.[i] ?? 0);
    const dir = degToCompass(deg);

    const precip = Number(d.precipitation_sum?.[i] ?? 0);

    rows.push(`
      <tr>
        <td>${label}</td>
        <td><span class="wx-ic" aria-hidden="true">${ic}</span></td>
        <td>${bf}°B • ${dir} • ${Math.round(wind)} km/h • porywy ${Math.round(gust)} km/h</td>
        <td>${tmin}–${tmax}°C</td>
        <td>${precip.toFixed(1)} mm</td>
      </tr>
    `);
  }

  elForecast7.innerHTML = rows.join("");
}

async function checkWeather() {
  const q = (elPlace?.value || "").trim();

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
  renderForecast24(data.hourly);
  renderForecast7(data.daily);
}

function initMap() {
  const mapEl = document.getElementById("weatherMap");
  if (!mapEl) return;

  // Leaflet musi być dostępny
  if (typeof L === "undefined") {
    // brak Leaflet => nie ma mapy, ale nie blokujemy reszty
    mapEl.innerHTML = `<div class="note">Mapa nie załadowała się (Leaflet). Sprawdź połączenie lub blokady zasobów.</div>`;
    return;
  }

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

  elBtnSearchPlace?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (e) { alert(e.message || "Błąd"); }
  });

  elBtnCheckWeather?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (e) { alert(e.message || "Błąd pobierania pogody"); }
  });

  elPlace?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      try { await checkWeather(); } catch (err) { alert(err?.message || "Błąd pobierania pogody"); }
    }
  });
}

// Start
initMap();
bind();
