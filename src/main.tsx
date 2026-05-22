import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function notifyUpdateAvailable(worker: ServiceWorker) {
  const accepted = window.confirm(
    "Nova versão do Daily Post-it disponível. Atualizar agora?"
  );
  if (accepted) {
    worker.postMessage("SKIP_WAITING");
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("PWA Service Worker registered:", reg.scope);

        // A waiting worker means an update was downloaded but the old one is still controlling the page.
        if (reg.waiting && navigator.serviceWorker.controller) {
          notifyUpdateAvailable(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdateAvailable(installing);
            }
          });
        });

        // Check for updates every 30 minutes while the app stays open.
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      })
      .catch((err) => {
        console.error("PWA Service Worker registration failed:", err);
      });

    // When the new SW takes control, reload so the page is served by it.
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
