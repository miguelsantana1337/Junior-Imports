"use client";

import { IconCheck, IconLock, IconSparkles } from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useState } from "react";

type LoadingPhase = "entering" | "ready" | "exiting" | "hidden";
const launchSeenKey = "junior-imports:admin-launch-seen:v1";

export function AdminLoadingScreen({ autoDismiss = false }: { autoDismiss?: boolean }) {
  const [phase, setPhase] = useState<LoadingPhase>("entering");
  const [initialized, setInitialized] = useState(!autoDismiss);
  const [shouldAnimate, setShouldAnimate] = useState(!autoDismiss);

  useLayoutEffect(() => {
    if (!autoDismiss) return;
    if (window.sessionStorage.getItem(launchSeenKey)) setPhase("hidden");
    else {
      window.sessionStorage.setItem(launchSeenKey, "1");
      setShouldAnimate(true);
    }
    setInitialized(true);
  }, [autoDismiss]);

  useEffect(() => {
    if (!autoDismiss || !initialized || !shouldAnimate) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const readyTimer = window.setTimeout(() => setPhase("ready"), reducedMotion ? 20 : 420);
    const exitTimer = window.setTimeout(() => setPhase("exiting"), reducedMotion ? 120 : 1_050);
    const hideTimer = window.setTimeout(() => setPhase("hidden"), reducedMotion ? 220 : 1_480);

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [autoDismiss, initialized, shouldAnimate]);

  if (!initialized || phase === "hidden") return null;

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
