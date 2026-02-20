// pwa.js — rejestracja SW + przycisk instalacji (Android/Chrome/Edge)

let deferredPrompt = null;

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  } catch (e) {
    // celowo bez alertów, żeby nie denerwować usera
    console.warn("SW register error:", e);
  }
}

function setupInstallButton() {
  const btn = document.getElementById("btnInstallPwa");
  if (!btn) return;

  // domyślnie ukryty (CSS też ukrywa)
  btn.hidden = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    // Chrome/Edge Android: przechwyt prompt
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    btn.disabled = true;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);

    deferredPrompt = null;
    btn.hidden = true;
    btn.disabled = false;
  });

  // Jeśli app już zainstalowana
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    btn.hidden = true;
  });
}

registerSW();
setupInstallButton();
