// aggregator.js — makieta agregatora (frontend-only)

const demoOffers = [
  {
    id: "b1",
    kind: "boat",
    title: "Antila 27 — gotowa do sezonu",
    region: "Mazury",
    price: 159000,
    currency: "PLN",
    tags: ["żagiel", "27 ft", "2018"],
    excerpt: "Komplet żagli, silnik 9.9, elektronika, nowa tapicerka.",
    source: "demo",
    url: "#kontakt",
  },
  {
    id: "b2",
    kind: "boat",
    title: "Twister 26 — klasyk po serwisie",
    region: "Bałtyk",
    price: 74900,
    currency: "PLN",
    tags: ["turystyka", "26 ft"],
    excerpt: "Nowy takielunek (2023), zimowany w hali.",
    source: "demo",
    url: "#kontakt",
  },
  {
    id: "b3",
    kind: "boat",
    title: "Sun Odyssey 36i — morski komfort",
    region: "Europa",
    price: 79000,
    currency: "EUR",
    tags: ["morski", "36 ft", "3 kabiny"],
    excerpt: "Autopilot, regularny serwis, gotowy do czarteru.",
    source: "demo",
    url: "#kontakt",
  },
  {
    id: "g1",
    kind: "gear",
    title: "Kamizelka automatyczna 150N",
    region: "Polska",
    price: 299,
    currency: "PLN",
    tags: ["bezpieczeństwo", "okazja"],
    excerpt: "Po przeglądzie, kompletna, z nabojem.",
    source: "demo",
    url: "#kontakt",
  },
  {
    id: "g2",
    kind: "gear",
    title: "Plotter 7” (używany) — sprawny",
    region: "Polska",
    price: 1450,
    currency: "PLN",
    tags: ["GPS", "elektronika"],
    excerpt: "Ekran bez rys, komplet kabli.",
    source: "demo",
    url: "#kontakt",
  },
  {
    id: "g3",
    kind: "gear",
    title: "Kotwica + 30 m łańcucha",
    region: "Zalew Szczeciński",
    price: 690,
    currency: "PLN",
    tags: ["pokład", "stal"],
    excerpt: "Do jachtów 24–30 ft, stan bardzo dobry.",
    source: "demo",
    url: "#kontakt",
  },
];

const elList = document.getElementById("agg-list");
const elQ = document.getElementById("agg-q");
const elType = document.getElementById("agg-type");
const elRegion = document.getElementById("agg-region");
const elSort = document.getElementById("agg-sort");
const elReset = document.getElementById("agg-reset");
const elCount = document.getElementById("agg-count");

function formatPrice(n, cur) {
  try {
    return new Intl.NumberFormat("pl-PL").format(n) + " " + cur;
  } catch {
    return `${n} ${cur}`;
  }
}

function matchesQuery(offer, q) {
  if (!q) return true;
  const hay = [
    offer.title,
    offer.region,
    offer.currency,
    offer.excerpt,
    ...(offer.tags || []),
  ].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

function filterAndSort() {
  const q = (elQ?.value || "").trim();
  const type = elType?.value || "all";
  const region = elRegion?.value || "all";
  const sort = elSort?.value || "new";

  let out = demoOffers.slice();

  out = out.filter((o) => matchesQuery(o, q));
  if (type !== "all") out = out.filter((o) => o.kind === type);
  if (region !== "all") out = out.filter((o) => o.region === region);

  if (sort === "priceAsc") out.sort((a, b) => a.price - b.price);
  if (sort === "priceDesc") out.sort((a, b) => b.price - a.price);

  render(out);
}

function pill(text) {
  const span = document.createElement("span");
  span.className = "pill";
  span.textContent = text;
  return span;
}

function render(items) {
  if (!elList) return;
  elList.innerHTML = "";

  if (elCount) elCount.textContent = `${items.length} ofert`;

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `
      <h3>Brak wyników</h3>
      <p class="muted">Zmień filtry albo wyszukaj inaczej (to jest demo makiety).</p>
    `;
    elList.appendChild(empty);
    return;
  }

  for (const o of items) {
    const card = document.createElement("article");
    card.className = "card listing agg-card";

    const typeLabel = o.kind === "boat" ? "Jacht / łódź" : "Osprzęt";

    const meta = document.createElement("div");
    meta.className = "agg-meta";
    meta.appendChild(pill(typeLabel));
    meta.appendChild(pill(o.region));
    for (const t of (o.tags || []).slice(0, 2)) meta.appendChild(pill(t));

    card.innerHTML = `
      <div class="agg-thumb" role="img" aria-label="Zdjęcie (demo)"></div>
      <div class="agg-body">
        <h3>${escapeHtml(o.title)}</h3>
        <p class="muted">${escapeHtml(o.excerpt)}</p>

        <div class="price-row">
          <span class="price">${escapeHtml(formatPrice(o.price, o.currency))}</span>
          <span class="agg-source">źródło: ${escapeHtml(o.source)}</span>
        </div>
      </div>
    `;

    const body = card.querySelector(".agg-body");
    body.insertBefore(meta, body.querySelector(".price-row"));

    const btn = document.createElement("a");
    btn.className = "btn btn-small btn-primary";
    btn.href = o.url || "#kontakt";
    btn.textContent = "Zobacz / Zapytaj";
    body.appendChild(btn);

    elList.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bind() {
  elQ?.addEventListener("input", filterAndSort);
  elType?.addEventListener("change", filterAndSort);
  elRegion?.addEventListener("change", filterAndSort);
  elSort?.addEventListener("change", filterAndSort);

  elReset?.addEventListener("click", () => {
    if (elQ) elQ.value = "";
    if (elType) elType.value = "all";
    if (elRegion) elRegion.value = "all";
    if (elSort) elSort.value = "new";
    filterAndSort();
  });

  filterAndSort();
}

bind();
