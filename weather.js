// weather.js — REALNA pogoda (Open-Meteo) + mapa Leaflet
// Działa po: kliknięciu mapy lub wpisaniu miejsca + „Sprawdź”
// Wpisany tekst ma zawsze pierwszeństwo nad kliknięciem na mapie.
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

// Panel górny (hero) — jeśli masz te elementy w HTML, zaktualizują się automatycznie
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
  // Forecast (temperatura + wiatr + porywy + kierunek)
  const forecast = new URL("https://api.open-meteo.com/v1/forecast");
  forecast.searchParams.set("latitude", String(lat));
  forecast.searchParams.set("longitude", String(lon));
  forecast.searchParams.set("timezone", "auto");
  forecast.searchParams.set(
    "current",
    "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
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
  const mc = m?.current || {};

  // Open-Meteo: km/h -> m/s
  const windMs = (c.wind_speed_10m ?? 0) / 3.6;
  const gustMs = (c.wind_gusts_10m ?? 0) / 3.6;

  const windKn = msToKn(windMs);
  const gustKn = msToKn(gustMs);
  const windDeg = Number(c.wind_direction_10m ?? 0);

  return {
    time: c.time,
    temp: c.temperature_2m,
    windBf: beaufortFromMs(windMs),
    windKn: Number(windKn.toFixed(1)),
    gustKn: Number(gustKn.toFixed(1)),
    windDir: degToCompass(windDeg),
    windDeg: Math.round(((windDeg % 360) + 360) % 360),

    waveH: (typeof mc.wave_height === "number") ? mc.wave_height : null,
    waveDir: (typeof mc.wave_direction === "number") ? degToCompass(mc.wave_direction) : null,
    waveP: (typeof mc.wave_period === "number") ? mc.wave_period : null
  };
}

function renderWeather(w) {
  // Sekcja #pogoda
  if (elWWind) elWWind.textContent = `${w.windBf}°B`;
  if (elWWindSub) {
    elWWindSub.textContent = `${w.windDir} (${w.windDeg}°) • ${w.windKn} kn • porywy ${w.gustKn} kn`;
  }
  if (elWTemp) elWTemp.textContent = `${Math.round(w.temp)}°C`;
  if (elWTime) elWTime.textContent = `czas: ${w.time}`;

  // HERO
  if (elHeroWind) elHeroWind.textContent = `${w.windBf}°B`;
  if (elHeroWindSub) elHeroWindSub.textContent = `${w.windDir} • ${w.windKn} kn (porywy ${w.gustKn} kn)`;
  if (elHeroTemp) elHeroTemp.textContent = `${Math.round(w.temp)}°C`;
  if (elHeroTime) elHeroTime.textContent = w.time;

  if (elHeroWave) elHeroWave.textContent = (w.waveH == null) ? "—" : `${w.waveH.toFixed(1)} m`;
  if (elHeroWaveSub) {
    elHeroWaveSub.textContent =
      (w.waveH == null)
        ? "fala: brak danych (punkt na lądzie)"
        : `${w.waveDir} • okres ${Math.round(w.waveP)} s`;
  }
}

async function checkWeather() {
  // Wpisany tekst ma pierwszeństwo — jeśli jest, zawsze geokoduj i ustaw punkt
  const q = (elPlace?.value || elHeroPlace?.value || "").trim();

  if (q) {
    const g = await geocodePlace(q);
    setPicked(g.lat, g.lon, g.label);
  }

  if (!picked) {
    alert("Wpisz miejsce albo kliknij punkt na mapie.");
    return;
  }

  const w = await fetchWeather(picked.lat, picked.lon);
  renderWeather(w);
}

function initMap() {
  const mapEl = document.getElementById("weatherMap");
  if (!mapEl) return;

  map = L.map("weatherMap").setView([53.5, 16.2], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  map.on("click", (e) => {
    // klik na mapie ustawia punkt
    setPicked(e.latlng.lat, e.latlng.lng, "Punkt na mapie");
  });
}

function bind() {
  // wpisywanie ma pierwszeństwo nad mapą
  elPlace?.addEventListener("input", () => {
    picked = null;
    if (elBtnCheckWeather) elBtnCheckWeather.disabled = false;
  });

  elHeroPlace?.addEventListener("input", () => {
    picked = null;
    if (elHeroCheck) elHeroCheck.disabled = false;
  });

  // "Szukaj" ustawia punkt i od razu pobiera pogodę
  elBtnSearchPlace?.addEventListener("click", async () => {
    try {
      await checkWeather();
    } catch (e) {
      alert(e.message);
    }
  });

  // "Sprawdź" pobiera pogodę (po wpisaniu lub po mapie)
  elBtnCheckWeather?.addEventListener("click", async () => {
    try {
      await checkWeather();
    } catch (e) {
      alert("Błąd pobierania pogody");
    }
  });

  // Enter w polu sekcji pogoda
  elPlace?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      try { await checkWeather(); } catch (_) { alert("Błąd pobierania pogody"); }
    }
  });

  // HERO: szukaj/sprawdź
  elHeroSearch?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (e) { alert(e.message); }
  });

  elHeroCheck?.addEventListener("click", async () => {
    try { await checkWeather(); } catch (_) { alert("Błąd pobierania pogody"); }
  });

  // Enter w polu hero
  elHeroPlace?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      try { await checkWeather(); } catch (_) { alert("Błąd pobierania pogody"); }
    }
  });
}

initMap();
bind();
