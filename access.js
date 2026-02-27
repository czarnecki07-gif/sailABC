// access.js — SUPER PROSTE: DEMO vs PRO na kod (localStorage)

(() => {
  const KEY = "sailabc_pro_code";
  const PRO_CODE = "SAILABC-PRO-2026"; // <-- zmień na swój kod

  function isPro() {
    return localStorage.getItem(KEY) === PRO_CODE;
  }

  function setBadge() {
    const badge = document.querySelector("[data-pro-badge]");
    if (!badge) return;
    badge.textContent = isPro() ? "PRO" : "DEMO";
  }

  function askForCode() {
    const code = prompt("Wpisz kod PRO:");
    if (!code) return;
    if (code.trim() === PRO_CODE) {
      localStorage.setItem(KEY, PRO_CODE);
      alert("PRO aktywne.");
      location.reload();
    } else {
      alert("Zły kod.");
    }
  }

  function gate() {
    document.addEventListener("click", (e) => {
      const a = e.target?.closest?.('a[data-access="pro"]');
      if (!a) return;

      if (isPro()) return;

      e.preventDefault();
      const ok = confirm("To narzędzie jest PRO. Chcesz wpisać kod?");
      if (ok) askForCode();
    }, true);
  }

  document.addEventListener("DOMContentLoaded", () => {
    setBadge();
    gate();
  });
})();
