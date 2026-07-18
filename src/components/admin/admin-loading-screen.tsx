"use client";

import { IconCheck, IconLock, IconSparkles } from "@tabler/icons-react";
import { useEffect, useState } from "react";

type LoadingPhase = "entering" | "ready" | "exiting" | "hidden";

export function AdminLoadingScreen({ autoDismiss = false }: { autoDismiss?: boolean }) {
  const [phase, setPhase] = useState<LoadingPhase>("entering");

  useEffect(() => {
    if (!autoDismiss) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const readyTimer = window.setTimeout(() => setPhase("ready"), reducedMotion ? 20 : 420);
    const exitTimer = window.setTimeout(() => setPhase("exiting"), reducedMotion ? 120 : 1_050);
    const hideTimer = window.setTimeout(() => setPhase("hidden"), reducedMotion ? 220 : 1_480);

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [autoDismiss]);

  if (phase === "hidden") return null;

  return (
    <div className={`admin-launch-screen is-${phase}`} role="status" aria-live="polite" aria-label="Carregando o painel administrativo">
      <div className="admin-launch-aurora" aria-hidden="true" />
      <div className="admin-launch-grid" aria-hidden="true" />

      <section className="admin-launch-card">
        <div className="admin-launch-orbit" aria-hidden="true">
          <span /><span /><span />
          <div className="admin-launch-mark"><b>JI</b></div>
        </div>

        <div className="admin-launch-copy">
          <span><IconSparkles /> Workspace premium</span>
          <h1>Junior Imports</h1>
          <p>{phase === "ready" ? "Ambiente pronto para operar." : "Preparando seu centro de controle..."}</p>
        </div>

        <div className="admin-launch-progress" aria-hidden="true"><span /></div>

        <footer>
          <span><IconLock /> Sessão protegida</span>
          <span className="admin-launch-ready"><IconCheck /> Sistema operacional</span>
        </footer>
      </section>
    </div>
  );
}
