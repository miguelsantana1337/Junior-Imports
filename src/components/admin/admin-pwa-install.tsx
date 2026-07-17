"use client";

import {
  IconDeviceMobile,
  IconDownload,
  IconShare,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function AdminPwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setAppleMobile(isAppleMobile());

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/admin-sw.js", {
          scope: "/admin",
          updateViaCache: "none",
        })
        .then((registration) => {
          void registration.update();
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        })
        .catch(() => undefined);
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setManualOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setManualOpen(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") setInstalled(true);
  }

  if (installed) return null;

  return (
    <>
      <button
        className="admin-pwa-install-button"
        type="button"
        onClick={() => void install()}
        aria-label="Instalar painel como aplicativo"
        title="Instalar painel como aplicativo"
      >
        <IconDownload />
        <span>Instalar painel</span>
      </button>

      {manualOpen && (
        <div className="admin-modal admin-pwa-modal" role="dialog" aria-modal="true" aria-labelledby="admin-pwa-title">
          <button className="admin-modal-overlay" type="button" onClick={() => setManualOpen(false)} aria-label="Fechar instruções" />
          <section className="admin-modal-panel small">
            <header>
              <div>
                <span>ACESSO RÁPIDO</span>
                <h2 id="admin-pwa-title">Instalar painel</h2>
                <small>Use o controle como um aplicativo no seu dispositivo.</small>
              </div>
              <button type="button" onClick={() => setManualOpen(false)} aria-label="Fechar"><IconX /></button>
            </header>
            <div className="admin-pwa-instructions">
              <div className="admin-pwa-instruction-icon">
                {appleMobile ? <IconShare /> : <IconDeviceMobile />}
              </div>
              {appleMobile ? (
                <>
                  <strong>No Safari do iPhone ou iPad</strong>
                  <p>Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>
                </>
              ) : (
                <>
                  <strong>No menu do navegador</strong>
                  <p>Abra o menu e escolha <b>Instalar Junior Admin</b> ou <b>Adicionar à tela inicial</b>.</p>
                </>
              )}
              <small>O aplicativo exige conexão para exibir dados administrativos atualizados.</small>
              <button className="admin-button primary" type="button" onClick={() => setManualOpen(false)}>Entendi</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
