"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Clock3,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney, formatWhatsappDisplay, whatsappUrl } from "@/lib/format";
import {
  buildWhatsappAssistantMessage,
  buildWhatsappAssistantSuggestions,
  defaultWhatsappAssistantAction,
  hasUsableWhatsappPhone,
  whatsappAssistantActions,
  whatsappAssistantContactSummary,
  type WhatsappAssistantActionId,
  type WhatsappAssistantPriority,
} from "@/lib/whatsapp-assistant";
import type { CustomerContact, Order } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { useAdminDialog } from "./use-admin-dialog";

const priorityLabels: Record<WhatsappAssistantPriority, string> = {
  urgent: "Agora",
  high: "Importante",
  medium: "Acompanhar",
  low: "Relacionamento",
};

const resultLabels: Record<CustomerContact["result"], string> = {
  follow_up: "Aguardando resposta",
  answered: "Cliente respondeu",
  sale: "Gerou venda",
  no_answer: "Sem resposta",
  opt_out: "Não deseja contato",
};

interface WhatsappAssistantTarget {
  order: Order;
  actionId?: WhatsappAssistantActionId;
}

export function WhatsappAssistantQueue({ onCompose }: { onCompose: (target: WhatsappAssistantTarget) => void }) {
  const { data, referenceNow } = useAdminData();
  const suggestions = useMemo(
    () => buildWhatsappAssistantSuggestions(data, new Date(referenceNow)),
    [data, referenceNow],
  );
  const priorityCount = suggestions.filter((item) => item.priority === "urgent" || item.priority === "high").length;
  const assistedCount = data.customerContacts.filter((contact) => contact.summary.includes("[Assistente WhatsApp:")).length;

  return <section className="whatsapp-assistant-shell" aria-labelledby="whatsapp-assistant-title">
    <header className="whatsapp-assistant-hero">
      <div className="whatsapp-assistant-heading"><span><Sparkles /> ASSISTENTE WHATSAPP</span><h2 id="whatsapp-assistant-title">As conversas certas, na hora certa.</h2><p>O sistema organiza as prioridades e prepara o texto. O Junior revisa e decide quando enviar.</p></div>
      <div className="whatsapp-assistant-cost"><WalletCards /><span><strong>R$ 0</strong><small>sem API ou disparo automático</small></span></div>
    </header>

    <div className="whatsapp-assistant-summary" aria-label="Resumo do atendimento">
      <article><span className={priorityCount ? "attention" : "positive"}><Clock3 /></span><div><small>Prioridades</small><strong>{priorityCount}</strong><p>pedidos para olhar primeiro</p></div></article>
      <article><span className="whatsapp"><MessageCircle /></span><div><small>Mensagens prontas</small><strong>{suggestions.length}</strong><p>com dados do pedido</p></div></article>
      <article><span className="positive"><CheckCircle2 /></span><div><small>Registradas</small><strong>{assistedCount}</strong><p>no histórico de atendimento</p></div></article>
      <article><span className="secure"><ShieldCheck /></span><div><small>Controle</small><strong>Manual</strong><p>nenhuma mensagem sai sozinha</p></div></article>
    </div>

    <div className="whatsapp-assistant-list">
      <div className="whatsapp-assistant-list-heading"><div><strong>Fila sugerida</strong><span>Ordenada por urgência e etapa do pedido.</span></div><b>{suggestions.length}</b></div>
      {suggestions.slice(0, 8).map((suggestion) => {
        const order = data.orders.find((item) => item.id === suggestion.orderId);
        if (!order) return null;
        const customer = data.customers.find((item) => item.id === order.customerId);
        const blocked = !hasUsableWhatsappPhone(order.customer.phone) || customer?.whatsappConsent === false;
        return <article className={`whatsapp-assistant-card ${suggestion.priority}`} key={`${suggestion.orderId}-${suggestion.actionId}`}>
          <span className={`whatsapp-assistant-priority ${suggestion.priority}`}>{priorityLabels[suggestion.priority]}</span>
          <div className="whatsapp-assistant-customer"><strong>{order.customer.name}</strong><span>{order.code} · {order.status} · {formatMoney(order.total)}</span><small>{suggestion.reason}</small></div>
          <div className="whatsapp-assistant-phone"><MessageCircle /><span><strong>{formatWhatsappDisplay(order.customer.phone) || "Sem telefone"}</strong><small>{blocked ? "Revise telefone ou consentimento" : suggestion.title}</small></span></div>
          <button className="admin-button primary" onClick={() => onCompose({ order, actionId: suggestion.actionId })}><Sparkles /> Preparar mensagem</button>
        </article>;
      })}
      {!suggestions.length && <div className="whatsapp-assistant-empty"><CheckCircle2 /><div><strong>Atendimento em dia.</strong><span>Nenhum pedido precisa de uma nova mensagem agora.</span></div></div>}
      {suggestions.length > 8 && <p className="whatsapp-assistant-more">Mais {suggestions.length - 8} sugestão{suggestions.length - 8 === 1 ? "" : "ões"} aparecerá{suggestions.length - 8 === 1 ? "" : "ão"} conforme a fila for concluída.</p>}
    </div>
  </section>;
}

export function WhatsappAssistantDialog({ target, onClose }: { target: WhatsappAssistantTarget; onClose: () => void }) {
  const { data, currentUser, saveCustomer, saveCustomerContact } = useAdminData();
  const order = data.orders.find((item) => item.id === target.order.id) ?? target.order;
  const initialAction = target.actionId ?? defaultWhatsappAssistantAction(order);
  const [actionId, setActionId] = useState<WhatsappAssistantActionId>(initialAction);
  const [message, setMessage] = useState(() => buildWhatsappAssistantMessage(order, initialAction, data.settings.storeName));
  const [result, setResult] = useState<CustomerContact["result"]>("follow_up");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useAdminDialog(onClose);
  const customer = data.customers.find((item) => item.id === order.customerId);
  const validPhone = hasUsableWhatsappPhone(order.customer.phone);
  const optedOut = customer?.whatsappConsent === false;
  const canOpen = validPhone && !optedOut && Boolean(message.trim());
  const canRegister = Boolean(customer && order.customerId);
  const link = canOpen ? whatsappUrl(order.customer.phone, message) : "#";

  function changeAction(nextAction: WhatsappAssistantActionId) {
    setActionId(nextAction);
    setMessage(buildWhatsappAssistantMessage(order, nextAction, data.settings.storeName));
    setCopied(false);
    setSaved(false);
  }

  async function copyMessage() {
    setError("");
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  async function registerContact() {
    if (!customer || !order.customerId) {
      setError("Vincule este pedido a um cliente antes de registrar o contato.");
      return;
    }
    setSaving(true);
    setError("");
    const now = new Date().toISOString();
    const compactMessage = message.replace(/\s+/g, " ").trim();
    const summary = `${whatsappAssistantContactSummary(order, actionId)} Texto: ${compactMessage.slice(0, 280)}${compactMessage.length > 280 ? "…" : ""}`;
    try {
      await saveCustomerContact({
        id: crypto.randomUUID(),
        customerId: order.customerId,
        channel: "whatsapp",
        result,
        summary,
        nextStepAt: "",
        actorEmail: currentUser.email,
        createdAt: now,
      });
      if (result === "opt_out") {
        await saveCustomer({ ...customer, whatsappConsent: false, updatedAt: now });
      }
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar o contato.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin-modal whatsapp-assistant-modal" role="dialog" aria-modal="true" aria-label={`Preparar mensagem para ${order.customer.name}`}>
    <button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" />
    <div className="admin-modal-panel whatsapp-assistant-panel" ref={panelRef}>
      <header><div><span>ASSISTENTE WHATSAPP</span><h2>{order.customer.name}</h2><small>{order.code} · {order.status} · {formatMoney(order.total)}</small></div><button type="button" onClick={onClose} aria-label="Fechar"><X /></button></header>

      {saved ? <div className="whatsapp-assistant-success"><CheckCircle2 /><div><strong>Contato registrado.</strong><p>A mensagem entrou no histórico de atendimento do cliente.</p></div><button className="admin-button primary" onClick={onClose}>Concluir</button></div> : <div className="whatsapp-assistant-compose">
        <section className="whatsapp-assistant-compose-main">
          <label>Objetivo da mensagem<select value={actionId} onChange={(event) => changeAction(event.target.value as WhatsappAssistantActionId)}>{Object.entries(whatsappAssistantActions).map(([value, action]) => <option value={value} disabled={value === "tracking_update" && !order.trackingCode.trim()} key={value}>{action.label}</option>)}</select></label>
          <label>Mensagem pronta<textarea rows={10} value={message} onChange={(event) => { setMessage(event.target.value); setCopied(false); }} maxLength={1500} /></label>
          <div className="whatsapp-assistant-message-meta"><span>{message.length}/1500 caracteres</span><span>Nenhuma mensagem será enviada automaticamente.</span></div>
          <div className="whatsapp-assistant-compose-actions"><button type="button" className="admin-button" onClick={() => void copyMessage()}><Clipboard /> {copied ? "Copiada" : "Copiar mensagem"}</button>{canOpen ? <a className="admin-button primary" href={link} target="_blank" rel="noreferrer"><MessageCircle /> Abrir WhatsApp <ExternalLink /></a> : <button type="button" className="admin-button primary" disabled><MessageCircle /> Abrir WhatsApp</button>}</div>
          {!validPhone && <div className="whatsapp-assistant-warning"><AlertTriangle /><span>O telefone deste pedido está incompleto. Corrija o cadastro antes de abrir a conversa.</span></div>}
          {optedOut && <div className="whatsapp-assistant-warning"><ShieldCheck /><span>Este cliente não autorizou contato pelo WhatsApp. O envio está bloqueado.</span></div>}
        </section>

        <aside className="whatsapp-assistant-register">
          <header><UserRound /><div><strong>Depois de enviar</strong><span>Registre o resultado para a fila aprender o próximo passo.</span></div></header>
          <label>Resultado<select value={result} onChange={(event) => setResult(event.target.value as CustomerContact["result"])}>{Object.entries(resultLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <div className="whatsapp-assistant-register-note"><ShieldCheck /><p>Confirme somente depois de enviar. O sistema registra a ação, mas não lê suas conversas.</p></div>
          {!canRegister && <p className="admin-form-error">Este pedido ainda não está vinculado a um cliente.</p>}
          {error && <p className="admin-form-error" role="alert">{error}</p>}
          <button type="button" className="admin-button primary" disabled={saving || !canRegister || !message.trim()} onClick={() => void registerContact()}><CheckCircle2 /> {saving ? "Registrando..." : "Já enviei — registrar"}</button>
        </aside>
      </div>}
    </div>
  </div>;
}

export type { WhatsappAssistantTarget };
