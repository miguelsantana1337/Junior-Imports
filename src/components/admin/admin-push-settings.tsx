"use client";

import { BellOff, BellRing, CheckCircle2, LoaderCircle, Send, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminNotificationCategories, type AdminNotificationCategory } from "@/lib/admin-preferences";

type PushState = "loading" | "unsupported" | "unavailable" | "denied" | "inactive" | "active";

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = window.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function deviceLabel() {
  const platform = navigator.platform || "Dispositivo";
  const browser = /edg/i.test(navigator.userAgent) ? "Edge"
    : /chrome|crios/i.test(navigator.userAgent) ? "Chrome"
      : /safari/i.test(navigator.userAgent) ? "Safari"
        : "Navegador";
  return `${platform} · ${browser}`.slice(0, 120);
}

async function registration() {
  const current = await navigator.serviceWorker.getRegistration("/admin");
  if (current) return current;
  return navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin", updateViaCache: "none" });
}

async function errorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || fallback;
}

export function AdminPushSettings({ mutedCategories }: { mutedCategories: AdminNotificationCategory[] }) {
  const [state, setState] = useState<PushState>("loading");
  const [publicKey, setPublicKey] = useState("");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const enabledCategories = useMemo(() => adminNotificationCategories.filter((category) => !mutedCategories.includes(category)), [mutedCategories]);
  const categoryKey = enabledCategories.join(",");
  const appleNeedsInstall = typeof window !== "undefined" && isAppleMobile() && !isStandalone();

  const saveSubscription = useCallback(async (value: PushSubscription, categories: AdminNotificationCategory[]) => {
    const serialized = value.toJSON();
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) throw new Error("O navegador não forneceu uma inscrição completa.");
    const response = await fetch("/api/admin/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: serialized.endpoint,
        expirationTime: serialized.expirationTime ?? null,
        keys: serialized.keys,
        categories,
        deviceLabel: deviceLabel(),
      }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, "Não foi possível salvar este aparelho."));
  }, []);

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (active) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setState("denied");
        return;
      }
      try {
        const response = await fetch("/api/admin/push/config", { cache: "no-store" });
        const config = await response.json() as { configured?: boolean; publicKey?: string };
        if (!response.ok || !config.configured || !config.publicKey) {
          if (active) setState("unavailable");
          return;
        }
        const worker = await registration();
        const current = await worker.pushManager.getSubscription();
        if (!active) return;
        setPublicKey(config.publicKey);
        setSubscription(current);
        setState(current ? "active" : "inactive");
      } catch {
        if (active) setState("unavailable");
      }
    }
    void inspect();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (state !== "active" || !subscription) return;
    void saveSubscription(subscription, enabledCategories).catch(() => {
      setFeedback("As preferências serão sincronizadas na próxima abertura.");
    });
  }, [categoryKey, enabledCategories, saveSubscription, state, subscription]);

  async function enable() {
    if (!publicKey || appleNeedsInstall) return;
    setBusy(true);
    setFeedback("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "inactive");
        return;
      }
      const worker = await registration();
      const current = await worker.pushManager.getSubscription();
      const next = current ?? await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
      await saveSubscription(next, enabledCategories);
      setSubscription(next);
      setState("active");
      setFeedback("Notificações ativadas neste aparelho.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!subscription) return;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/admin/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "Não foi possível desativar este aparelho."));
      await subscription.unsubscribe();
      setSubscription(null);
      setState("inactive");
      setFeedback("Notificações desativadas neste aparelho.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível desativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setTesting(true);
    setFeedback("");
    try {
      const response = await fetch("/api/admin/push/test", { method: "POST" });
      if (!response.ok) throw new Error(await errorMessage(response, "Não foi possível enviar o teste."));
      setFeedback("Teste enviado. Ele deve aparecer em instantes.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível enviar o teste.");
    } finally {
      setTesting(false);
    }
  }

  const copy = state === "active"
    ? "Este aparelho recebe alertas importantes mesmo com o painel fechado."
    : state === "denied"
      ? "O navegador bloqueou os avisos. Libere as notificações nas configurações do aparelho."
      : state === "unsupported"
        ? "Este navegador não oferece Web Push. Use o app instalado, Safari, Chrome ou Edge atualizado."
        : state === "unavailable"
          ? "O serviço de push ainda não está disponível neste ambiente."
          : appleNeedsInstall
            ? "No iPhone ou iPad, adicione o painel à Tela de Início antes de ativar os avisos."
            : "Ative uma vez para receber novos pedidos e alertas operacionais com o painel fechado.";

  return <section className={`admin-push-settings ${state}`}>
    <div className="admin-push-settings-icon">{state === "active" ? <BellRing /> : <Smartphone />}</div>
    <div className="admin-push-settings-copy">
      <strong>Notificações no aparelho</strong>
      <span>{copy}</span>
      {feedback && <small role="status">{feedback}</small>}
    </div>
    <div className="admin-push-settings-actions">
      {state === "loading" && <button type="button" disabled><LoaderCircle className="spin" /> Verificando</button>}
      {state === "active" && <>
        <button type="button" onClick={() => void test()} disabled={testing}>{testing ? <LoaderCircle className="spin" /> : <Send />} Testar</button>
        <button type="button" className="danger" onClick={() => void disable()} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <BellOff />} Desativar</button>
      </>}
      {state === "inactive" && <button type="button" className="primary" onClick={() => void enable()} disabled={busy || appleNeedsInstall}>{busy ? <LoaderCircle className="spin" /> : <CheckCircle2 />} Ativar neste aparelho</button>}
    </div>
  </section>;
}
