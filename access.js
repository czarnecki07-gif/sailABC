// access.js — blokada DEMO/PRO (front-only, localStorage)
// Użycie: dodaj data-access="pro" do linków/btn narzędzi PRO.
// Ustawia localStorage: sailabc_pro = "1" (odblokowane) albo usuwa (zablokowane).

(function () {
  const KEY = "sailabc_pro";

  function hasPro() {
    return localStorage.getItem(KEY) === "1";
  }

  function setPro(value) {
    if (value) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
    updateBadges();
  }

  function ensureModal() {
    let modal = document.getElementById("accessModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "accessModal";
    modal.className = "access-modal";
    modal.innerHTML = `
      <div class="access-modal__backdrop" data-close="1"></div>
      <div class="access-modal__card" role="dialog" aria-modal="true" aria-labelledby="accessTitle">
        <div class="access-modal__head">
          <h3 id="accessTitle" class="access-modal__title">Dostęp PRO</h3>
          <button class="access-modal__x" type="button" aria-label="Zamknij" data-close="1">×</button>
        </div>

        <p class="access-modal__text">
          To narzędzie jest dostępne w wersji PRO. Odblokujesz pełny dostęp do wszystkich narzędzi sailABC Tools.
        </p>

        <div class="access-modal__actions">
          <a class="btn btn-primary" href="/oprogramowanie.html#pakiety">Odblokuj PRO</a>
          <button class="btn btn-ghost" type="button" data-close="1">Zamknij</button>
        </div>

        <div class="access-modal__dev">
          <button class="btn" type="button" id="btnProToggle"></button>
          <span class="access-modal__hint">Tryb testowy (na razie). Później podłączymy płatności.</span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // zamykanie
    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    // test toggle
    const btnToggle = modal.querySelector("#btnProToggle");
    btnToggle?.addEventListener("click", () => setPro(!hasPro()));

    updateModalToggleLabel();
    return modal;
  }

  function openModal() {
    const modal = ensureModal();
    modal.classList.add("open");
    updateModalToggleLabel();
    // focus dla dostępności
    const x = modal.querySelector(".access-modal__x");
    x?.focus?.();
  }

  function closeModal() {
    const modal = document.getElementById("accessModal");
    if (modal) modal.classList.remove("open");
  }

  function updateModalToggleLabel() {
    const modal = document.getElementById("accessModal");
    if (!modal) return;
    const btnToggle = modal.querySelector("#btnProToggle");
    if (!btnToggle) return;
    btnToggle.textContent = hasPro() ? "PRO aktywne — wyłącz (test)" : "Włącz PRO (test)";
  }

  function updateBadges() {
    // opcjonalnie: oznaczenia PRO/DEMO jeśli dodasz elementy z [data-pro-badge]
    document.querySelectorAll("[data-pro-badge]").forEach((el) => {
      el.textContent = hasPro() ? "PRO" : "DEMO";
    });
    updateModalToggleLabel();
  }

  function interceptProLinks() {
    document.addEventListener("click", (e) => {
      const a = e.target?.closest?.("[data-access]");
      if (!a) return;

      const req = a.getAttribute("data-access");
      if (req !== "pro") return;

      if (hasPro()) return; // przepuść normalnie

      e.preventDefault();
      openModal();
    });
  }

  // init
  interceptProLinks();
  updateBadges();

  // eksport minimalny (jeśli kiedyś będziesz chciał sterować z konsoli)
  window.sailabcAccess = {
    hasPro,
    setPro,
    openModal,
    closeModal
  };
})();
