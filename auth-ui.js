// auth-ui.js — dynamiczny przycisk menu: Zaloguj / Moje konto (PRO) + Wyloguj

(async () => {
  const mainBtn = document.getElementById("navAuthMain");
  const logoutBtn = document.getElementById("navAuthLogout");
  if (!mainBtn || !logoutBtn) return;

  function setLoggedOut() {
    mainBtn.textContent = "Zaloguj";
    mainBtn.setAttribute("href", "/login.html");
    logoutBtn.hidden = true;
  }

  function setLoggedIn(plan) {
    const tag =
      plan === "pro" ? "PRO" :
      plan === "tester" ? "TESTER" :
      "DEMO";

    mainBtn.textContent = `Moje konto (${tag})`;
    mainBtn.setAttribute("href", "/moje-konto.html");
    logoutBtn.hidden = false;
  }

  // domyślnie (gdy offline / brak backendu)
  setLoggedOut();

  // sprawdź sesję
  try {
    const r = await fetch("/api/me", { credentials: "include" });
    if (!r.ok) return;

    const me = await r.json();
    if (!me || !me.authenticated) return setLoggedOut();

    setLoggedIn(me.plan || "demo");
  } catch {
    // offline / brak /api/me — zostaw "Zaloguj"
  }

  // wylogowanie
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    location.reload();
  });
})();
