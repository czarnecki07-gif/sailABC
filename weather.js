// weather.js — mapa + wyszukiwanie miejsca + pobranie pogody z backendu

const elPlace = document.getElementById("place");
const btnSearchPlace = document.getElementById("btnSearchPlace");
const btnCheckWeather = document.getElementById("btnCheckWeather");
const pickedInfo = document.getElementById("pickedInfo");
const weatherNote = document.getElementById("weatherNote");

const wWind = document.getElementById("wWind");
const wWindSub = document.getElementById("wWindSub");
const wTemp = document.getElementById("wTemp");
const wTime = document.getElementById("wTime");
const wRaw = document.getElementById("wRaw");

let picked = null;
let marker = null;

// Start mapy: Zalew Szczeciński
const map = L.map("weatherMap").setView([53.70, 14.60], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

function setPicked(lat, lon, label) {
  picked = { lat, lon, label };

  if (marker) marker.remove();
  marker = L.marker([lat, lon]).addTo(map);

  pickedInfo.textContent = label
    ? `Wybrano: ${label} (lat ${lat.toFixed(5)}, lon ${lon.toFixed(5)})`
    : `Wybrano: lat ${lat.toFixed(5)}, lon ${lon.toFixed(5)}`;

  btnCheckWeather.disabled = false;
  weatherNote.innerHTML = `<strong>Gotowe:</strong> kliknij „Sprawdź pogodę”.`;
}

map.on("click", (e) => {
  setPicked(e.latlng.lat, e.latlng.lng, "punkt z mapy");
});

async function geocodePlace(q) {
  const url = `/api/geocode?q=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "Błąd geokodowania");
  return data;
}

btnSearchPlace.addEventListener("click", async () => {
  const q = (elPlace.value || "").trim();
  if (!q) {
    weatherNote.innerHTML = `<strong>Uwaga:</strong> wpisz nazwę miejsca.`;
    return;
  }

  btnSearchPlace.disabled = true;
  btnSearchPlace.textContent = "Szukam…";

  try {
    const g = await geocodePlace(q);
    const zoom = Number.isFinite(g.suggested_zoom) ? g.suggested_zoom : 12;

    map.setView([g.lat, g.lon], Math.max(10, zoom));
    setPicked(g.lat, g.lon, g.display_name);

    weatherNote.innerHTML = `<strong>OK:</strong> znaleziono miejsce.`;
  } catch (err) {
    weatherNote.innerHTML = `<strong>Błąd:</strong> ${err.message}`;
  } finally {
    btnSearchPlace.disabled = false;
    btnSearchPlace.textContent = "Szukaj na mapie";
  }
});

elPlace.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    btnSearchPlace.click();
  }
});

btnCheckWeather.addEventListener("click", async () => {
  if (!picked) return;

  btnCheckWeather.disabled = true;
  btnCheckWeather.textContent = "Sprawdzam…";

  try {
    const url = `/api/weather?lat=${encodeURIComponent(picked.lat)}&lon=${encodeURIComponent(picked.lon)}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "Błąd API pogody");

    const c = data.current;

    wWind.textContent = `${c.wind_beaufort}°B`;
    wWindSub.textContent = `${c.wind_ms} m/s • ${c.wind_dir_compass} (${c.wind_dir_deg}°)`;

    wTemp.textContent = `${c.temperature_c}°C`;
    wTime.textContent = `czas: ${c.time_local}`;

    wRaw.textContent = JSON.stringify(data, null, 2);
    weatherNote.innerHTML = `<strong>OK:</strong> dane pobrane.`;
  } catch (err) {
    weatherNote.innerHTML = `<strong>Błąd:</strong> ${err.message}`;
  } finally {
    btnCheckWeather.disabled = false;
    btnCheckWeather.textContent = "Sprawdź pogodę";
  }
});
