// weather.js — Open-Meteo + Leaflet + prognoza: current + 24h + 7 dni (tabele)
// 24h: "następne 24h od teraz" (od najbliższej kolejnej pełnej godziny)
// Warunki: ikonka SVG (bez emoji) zamiast tekstu, opis w title/aria-label
// Wiatr: pokazuje też porywy.

let map;
let marker = null;
let picked = null;

// UI
const elPlace = document.getElementById("place");
const elBtnSearchPlace = document.getElementById("btnSearchPlace");
const elBtnCheckWeather = document.getElementById("btnCheckWeather");
const elPickedInfo = document.getElementById("pickedInfo");

const elWWind = document.getElementById("wWind");
const elWWindSub = document.getElementById("wWindSub");
const elWTemp = document.getElementById("wTemp");
const elWTime = document.getElementById("wTime");

// Prognoza: 24h + 7 dni (TBODY w tabelach)
const elForecast24 = document.getElementById("forecast24");
const elHourlyMeta = document.getElementById("hourlyMeta");

const elForecast7 = document.getElementById("forecast7");
const elForecastMeta = document.getElementById("forecastMeta");

// (opcjonalne) elementy hero — jeśli kiedyś je dodasz
const elHeroPlace = document.getElementById("heroPlace");
const elHeroSearch = document.getElementById("heroSearch");
const elHeroCheck = document.getElementById("heroCheck");

const elHeroWind = document.getElementById("heroWind");
const elHeroWindSub = document.getElementById("heroWindSub");
const elHeroTemp = document.getElementById("heroTemp");
const elHeroTime = document.getElementById("heroTime");
const elHeroWave = document.getElementById("heroWave");
const elHeroWaveSub = document.getElementById("heroWaveSub");

// ===== Utils =====

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

function fmtHour(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  return `${hh}:00`;
}

function fmtDay(isoDate) {
  const dt = new Date(isoDate + "T00:00:00");
  const days = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
  const d = days[dt.getDay()];
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${d} ${dd}.${mm}`;
}

// start prognozy 24h: najbliższa następna pełna godzina (>= teraz zaokrąglone w górę)
function findStartIndex(hourlyTimes) {
  if (!Array.isArray(hourlyTimes) || hourlyTimes.length === 0) return 0;

  const now = new Date();

  // "ceiling" do kolejnej pełnej godziny
  const nowCeil = new Date(now);
  nowCeil.setMinutes(0, 0, 0);
  if (now.getMinutes() > 0 || now.getSeconds() > 0 || now.getMilliseconds() > 0) {
    nowCeil.setHours(nowCeil.getHours() + 1);
  }

  for (let i = 0; i < hourlyTimes.length; i++) {
    const t = new Date(hourlyTimes[i]);
    if (t >= nowCeil) return i;
  }
  return 0;
}

// ===== Warunki: label + ikony SVG (bez emoji) =====

function weatherLabel(code) {
  const c = Number(code);
  if (Number.isNaN(c)) return "Zmienne";

  if (c === 0) return "Słonecznie";
  if (c === 1) return "Przeważnie słonecznie";
  if (c === 2) return "Częściowe zachmurzenie";
  if (c === 3) return "Zachmurzenie";

  if (c === 45 || c === 48) return "Mgła";

  if ([51,53,55].includes(c)) return "Mżawka";
  if ([56,57].includes(c)) return "Marznąca mżawka";

  if ([61,63,65].includes(c)) return "Deszcz";
  if ([66,67].includes(c)) return "Marznący deszcz";

  if ([71,73,75].includes(c)) return "Śnieg";
  if (c === 77) return "Ziarna śniegu";

  if ([80,81,82].includes(c)) return "Przelotny deszcz";
  if ([85,86].includes(c)) return "Przelotny śnieg";

  if (c === 95) return "Burza";
  if ([96,99].includes(c)) return "Burza z gradem";

  return "Zmienne";
}

function svgSun() {
  return `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4"></circle>
    <line x1="12" y1="2" x2="12" y2="5"></line>
    <line x1="12" y1="19" x2="12" y2="22"></line>
    <line x1="2" y1="12" x2="5" y2="12"></line>
    <line x1="19" y1="12" x2="22" y2="12"></line>
    <line x1="4.2" y1="4.2" x2="6.3" y2="6.3"></line>
    <line x1="17.7" y1="17.7" x2="19.8" y2="19.8"></line>
    <line x1="17.7" y1="6.3" x2="19.8" y2="4.2"></line>
    <line x1="4.2" y1="19.8" x2="6.3" y2="17.7"></line>
  </svg>`;
}

function svgCloud() {
  return `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7.5 18.5h10a4 4 0 0 0 .7-7.9A5.5 5.5 0 0 0 7.7 9.7 3.8 3.8 0 0 0 7.5 18.5z"></path>
  </svg>`;
}

function svgCloudSun() {
  return `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="7.5" cy="9" r="2.5"></circle>
    <line x1="7.5" y1="3" x2="7.5" y2="4.6"></line>
    <line x1="3.5" y1="9" x2="5.1" y2="9"></line>
    <line x1="10" y1="6.5" x2="11.2" y2="5.3"></line>
    <path d="M9 18.5h8.5a3.6 3.6 0 0 0 .6-7.1A5 5 0 0 0 9.1 12"></path>
  </svg>`;
}

function svgRain() {
  return `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7.5 14.5h10a4 4 0 0 0 .7-7.9A5.5 5.5 0 0 0 7.7 5.7 3.8 3.8 0 0 0 7.5 14.5z"></path>
    <line x1="9" y1="17" x2="8" y2="21"></line>
    <line x1="13" y1="17" x2="12" y2="21"></line>
    <line x1="17" y1="17" x2="16" y2="21"></line>
  </svg>`;
}

function svgSnow() {
  return `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7.5 14.5h10a4 4 0 0 0 .7-7.9A5.5 5.5 0 0 0 7.7 5.7 3.8 3.8 0 0 0 7.5 14.5z"></path>
    <line x1="10" y1="18" x2="10" y2="20"></line>
    <line x1="14" y1="18" x2="14" y2="20"></line>
    <line x1="12" y1="19" x2="12" y2="21"></line>
  </svg>`;
}

function svgFog() {
  return `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <line x1="4" y1="9" x2="20" y2="9"></line>
    <line x1="6" y1="13" x2="18" y2="13"></line>
    <line x1="5" y1="17" x2="19" y2="17"></line>
  </svg>`;
}

function svgStorm() {
  return `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7.5 14.5h10a4 4 0 0 0 .7-7.9A5.5 5.5 0 0 0 7.7 5.7 3.8 3.8 0 0 0 7.5 14.5z"></path>
    <polyline points="12,15 10,19 13,19 11,22"></polyline>
  </svg>`;
}

function weatherIcon(code) {
  const c = Number(code);

  if (c === 0) return svgSun();
  if (c === 1 || c === 2) return svgCloudSun();
  if (c === 3) return svgCloud();

  if (c === 45 || c === 48) return svgFog();

  if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(c)) return svgRain();
  if ([71,73,75,77,85,86].includes(c)) return svgSnow();
  if ([95,96,99].includes(c)) return svgStorm();

  return svgCloud();
}

// ===== Core =====

function setPicked(lat, lon, label) {
  picked = { lat, lon, label: label || "Punkt" };

  if (elBtnCheckWeather) elBtnCheckWeather.disabled = false;
  if (elHeroCheck) elHeroCheck.disabled = false;

  if (elPickedInfo) {
    elPickedInfo.textContent = `Wybrane: ${picked.label} (${picked.lat.toFixed(4)}, ${picked.lon.toFixed(4)})`;
  }

  if (elForecastMeta) elForecastMeta.textContent = `Prognoza dla: ${picked.label}`;
  if (elHourlyMeta) elHourlyMeta.textContent = `Prognoza 24h dla: ${picked.label}`;

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
  const forecast = new URL("https://api.open-meteo.com/v1/forecast");
  forecast.searchParams.set("latitude", String(lat));
  forecast.searchParams.set("longitude", String(lon));
  forecast.searchParams.set("timezone", "auto");

  // CURRENT
  forecast.searchParams.set(
    "current",
    "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover"
  );

  // HOURLY
  forecast.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "precipitation",
      "weathercode",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m"
    ].join(",")
  );

  // DAILY
  forecast.searchParams.set(
    "daily",
    [
      "weathercode",
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
  const h = f.hourly || {};
  const mc = m?.current || {};

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
    hourly: {
      time: h.time || [],
      temp: h.temperature_2m || [],
      precip: h.precipitation || [],
      code: h.weathercode || [],
      wind: h.wind_speed_10m || [],
      gust: h.wind_gusts_10m || [],
      windDir: h.wind_direction_10m || []
    },
    daily: {
      time: d.time || [],
      code: d.weathercode || [],
      tmax: d.temperature_2m_max || [],
      tmin: d.temperature_2m_min || [],
      windMax: d.wind_speed_10m_max || [],
      gustMax: d.wind_gusts_10m_max || [],
      windDirDom: d.wind_direction_10m_dominant || [],
      precipSum: d.precipitation_sum || [],
      cloudMean: d.cloud_cover_mean || []
    }
  };
}

function renderCurrent(c) {
  if (elWWind) elWWind.textContent = `${c.windBf}°B`;
  if (elWWindSub) elWWindSub.textContent = `${c.windDir} (${c.windDeg}°) • ${c.windKn} kn • porywy ${c.gustKn} kn`;
  if (elWTemp) elWTemp.textContent = `${Math.round(c.temp)}°C`;
  if (elWTime) elWTime.textContent = `czas: ${c.time} • opad: ${c.precip ?? 0} mm • zachmurzenie: ${c.cloud ?? 0}%`;

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

function renderHourly24(h) {
  if (!elForecast24) return;

  elForecast24.innerHTML = "";

  const start = findStartIndex(h.time);
  const end = Math.min(start + 24, h.time.length);

  if (start >= h.time.length || end <= start) {
    elForecast24.innerHTML = `<tr><td colspan="5" class="muted">Brak danych prognozy 24h.</td></tr>`;
    return;
  }

  for (let i = start; i < end; i++) {
    const windMs = (h.wind[i] ?? 0) / 3.6;
    const gustMs = (h.gust[i] ?? 0) / 3.6;

    const bf = beaufortFromMs(windMs);
    const windKn = msToKn(windMs);
    const gustKn = msToKn(gustMs);

    const wdir = degToCompass(h.windDir[i] ?? 0);

    const label = weatherLabel(h.code[i]);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtHour(h.time[i])}</td>
      <td class="wxcell" title="${label}">
        <span class="wx-icon" aria-label="${label}">
          ${weatherIcon(h.code[i])}
        </span>
      </td>
      <td>
        <strong>${bf}°B</strong> ${wdir} • ${windKn.toFixed(0)} kn
        <br><span class="muted">porywy ${gustKn.toFixed(0)} kn</span>
      </td>
      <td>${Math.round(h.temp[i] ?? 0)}°C</td>
      <td>${Number(h.precip[i] ?? 0).toFixed(1)} mm</td>
    `;
    elForecast24.appendChild(tr);
  }
}

function renderDaily7(d) {
  if (!elForecast7) return;

  elForecast7.innerHTML = "";

  const n = Math.min(7, d.time.length);
  if (!n) {
    elForecast7.innerHTML = `<tr><td colspan="5" class="muted">Brak danych prognozy 7 dni.</td></tr>`;
    return;
  }

  for (let i = 0; i < n; i++) {
    const labelDay = fmtDay(d.time[i]);

    const tmax = Math.round(d.tmax[i] ?? 0);
    const tmin = Math.round(d.tmin[i] ?? 0);

    const windMs = (d.windMax[i] ?? 0) / 3.6;
    const gustMs = (d.gustMax[i] ?? 0) / 3.6;

    const windMaxKn = msToKn(windMs);
    const gustMaxKn = msToKn(gustMs);

    const wdir = degToCompass(d.windDirDom[i] ?? 0);
    const bf = beaufortFromMs(windMs);

    const precip = Number(d.precipSum[i] ?? 0).toFixed(1);
    const label = weatherLabel(d.code[i]);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${labelDay}</td>
      <td class="wxcell" title="${label}">
        <span class="wx-icon" aria-label="${label}">
          ${weatherIcon(d.code[i])}
        </span>
      </td>
      <td><strong>${bf}°B</strong> ${wdir} • ${windMaxKn.toFixed(0)} kn • porywy ${gustMaxKn.toFixed(0)} kn</td>
      <td>${tmin}–${tmax}°C</td>
      <td>${precip} mm</td>
    `;
    elForecast7.appendChild(tr);
  }
}

async function checkWeather() {
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
  renderHourly24(data.hourly);
  renderDaily7(data.daily);
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
