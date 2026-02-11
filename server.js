import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serwuj statyczne pliki portalu (index.html, style.css, weather.js, logo.png...)
app.use(express.static(__dirname, { extensions: ["html"] }));

function msToBeaufort(ms) {
  const limits = [0.5, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  let b = 0;
  while (b < limits.length && ms >= limits[b]) b++;
  return b; // 0..12
}

function degToCompass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const i = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[i];
}

/**
 * Geocode via Nominatim (OpenStreetMap).
 * Własny endpoint (żeby ominąć CORS na front i trzymać 1 origin).
 */
app.get("/api/geocode", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Brak parametru q." });

    // Nominatim wymaga sensownego User-Agent; ustawiamy go w fetch przez headers.
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    const r = await fetch(url.toString(), {
      headers: {
        "User-Agent": "sailABC-weather/1.0 (contact: kontakt@sailabc.com)"
      }
    });

    if (!r.ok) return res.status(502).json({ error: "Błąd geokodowania (upstream)." });

    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      return res.status(404).json({ error: "Nie znaleziono miejsca. Spróbuj doprecyzować." });
    }

    const item = arr[0];
    const lat = Number(item.lat);
    const lon = Number(item.lon);

    return res.json({
      display_name: item.display_name,
      lat,
      lon,
      suggested_zoom: 12
    });
  } catch (e) {
    return res.status(500).json({ error: "Błąd serwera (geocode)." });
  }
});

app.get("/api/weather", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: "Nieprawidłowe lat/lon." });
    }

    // Open-Meteo (bez klucza) — current weather
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current", "temperature_2m,wind_speed_10m,wind_direction_10m,weather_code");
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("timezone", "Europe/Warsaw");

    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "Błąd po stronie API pogody." });

    const data = await r.json();
    const cur = data.current;

    const windMs = cur.wind_speed_10m;
    const windDir = cur.wind_direction_10m;

    return res.json({
      location: { lat, lon },
      current: {
        temperature_c: cur.temperature_2m,
        wind_ms: windMs,
        wind_beaufort: msToBeaufort(windMs),
        wind_dir_deg: windDir,
        wind_dir_compass: degToCompass(windDir),
        weather_code: cur.weather_code,
        time_local: cur.time
      }
    });
  } catch (e) {
    return res.status(500).json({ error: "Błąd serwera (weather)." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`sailABC działa na http://localhost:${PORT}`));
