"use client";

import { ArrowUpRight, Bot, ChevronDown, Database, LockKeyhole, PanelRightClose, Send, ShieldCheck, Sparkles, Trash2, X, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildCopilotAnswer, type CopilotAnswer } from "@/lib/copilot";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "./admin-data-provider";

type CopilotMessage = { id: string; role: "user" | "assistant"; content: string; answer?: CopilotAnswer; createdAt: string };

const suggestions = [
  "Quais produtos estão com estoque baixo?",
  "Quais pedidos precisam de acompanhamento?",
  "Há cashback vencendo nos próximos 30 dias?",
  "Como funciona esta tela?",
];

export function CopilotJunior() {
  const { data, currentUser } = useAdminData();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const storageKey = `junior-imports:copilot:${data.tenant.id}:${currentUser.id}`;
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [showSources, setShowSources] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) setMessages(JSON.parse(stored) as CopilotMessage[]);
    } catch { window.sessionStorage.removeItem(storageKey); }
  }, [storageKey]);

  useEffect(() => {
    window.sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, storageKey]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  async function ask(prompt: string) {
    const content = prompt.trim();
    if (!content) return;
    const createdAt = new Date().toISOString();
    const answer = buildCopilotAnswer(content, data, pathname);
    setMessages((current) => [...current,
      { id: crypto.randomUUID(), role: "user", content, createdAt },
      { id: crypto.randomUUID(), role: "assistant", content: answer.message, answer, createdAt: new Date().toISOString() },
    ]);
    setQuestion("");
    if (supabase) {
      await supabase.from("copilot_usage").insert({ tenant_id: data.tenant.id, user_id: currentUser.id, mode: "local", model: "", route: pathname, input_tokens: 0, output_tokens: 0, status: answer.intent === "blocked_mutation" ? "blocked" : "completed" });
    }
  }

  return <>
    <button className={`copilot-launcher ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen((current) => !current)} aria-label={open ? "Fechar Copiloto Junior" : "Abrir Copiloto Junior"} aria-expanded={open}>
      {open ? <PanelRightClose /> : <Sparkles />}<span><strong>Copiloto Junior</strong><small>Somente leitura</small></span><kbd>⌘ J</kbd>
    </button>
    {open && <button className="copilot-backdrop" onClick={() => setOpen(false)} aria-label="Fechar Copiloto" />}
    <aside className={`copilot-panel ${open ? "open" : ""}`} aria-hidden={!open} aria-label="Copiloto Junior">
      <header><div className="copilot-avatar"><Bot /><i /></div><div><span><Sparkles /> COPILOTO JUNIOR</span><strong>Como posso ajudar?</strong><small><ShieldCheck /> Modo local seguro · somente leitura</small></div><button onClick={() => setOpen(false)} aria-label="Fechar"><X /></button></header>

      <div className="copilot-mode-banner"><LockKeyhole /><div><strong>Seus dados não saem do painel</strong><p>A IA generativa externa aguarda uma chave segura. Enquanto isso, consultas e orientações usam regras locais auditáveis.</p></div></div>

      <div className="copilot-conversation">
        {!messages.length && <section className="copilot-welcome"><span><Zap /></span><h3>Pronto para encontrar respostas no seu painel.</h3><p>Consulte operação e aprenda a usar o software sem risco de alterar registros.</p><div>{suggestions.map((item) => <button key={item} onClick={() => void ask(item)}>{item}<ArrowUpRight /></button>)}</div></section>}
        {messages.map((message) => message.role === "user" ? <article className="copilot-message user" key={message.id}><p>{message.content}</p></article> : <article className="copilot-message assistant" key={message.id}><div className="copilot-mini-avatar"><Bot /></div><div><strong>{message.answer?.title || "Copiloto Junior"}</strong><p>{message.content}</p>{message.answer?.cards && message.answer.cards.length > 0 && <div className="copilot-cards">{message.answer.cards.map((card, index) => <Link className={card.tone || "default"} href={card.href} key={`${card.href}-${index}`} onClick={() => setOpen(false)}><span><strong>{card.title}</strong><small>{card.detail}</small></span><ArrowUpRight /></Link>)}</div>}{message.answer?.sources && <div className="copilot-source-wrap"><button onClick={() => setShowSources((current) => current === message.id ? null : message.id)}><Database /> Fontes usadas <ChevronDown /></button>{showSources === message.id && <ul>{message.answer.sources.map((source) => <li key={source}>{source}</li>)}<li>Nenhum dado enviado a serviços externos.</li></ul>}</div>}</div></article>)}
        <div ref={endRef} />
      </div>

      <footer><form onSubmit={(event) => { event.preventDefault(); void ask(question); }}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(question); } }} placeholder="Pergunte sobre estoque, pedidos, cashback ou esta tela…" rows={2} maxLength={500} /><button disabled={!question.trim()} aria-label="Enviar pergunta"><Send /></button></form><div><span><LockKeyhole /> Não executa alterações</span>{messages.length > 0 && <button onClick={() => setMessages([])}><Trash2 /> Limpar sessão</button>}</div></footer>
    </aside>
  </>;
}
