"use client";

import { Activity, CalendarDays, GitPullRequestArrow, Megaphone, Plus, Workflow } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { MarketingPublication } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AutomationStudio } from "./automation-studio";
import { MarketingCalendar } from "./marketing-calendar";
import { newMarketingPublication, PublicationEditor, PublicationWorkflow } from "./publication-workflow";

type StudioTab = "calendar" | "workflow" | "automations";

export function MessagesAdmin() {
  const { data, currentUser, processDueMarketingPublications } = useAdminData();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<StudioTab>(() => searchParams.get("novo") === "1" ? "automations" : "calendar");
  const [editing, setEditing] = useState<MarketingPublication | null>(null);
  const processed = useRef(false);
  useEffect(() => { if (processed.current) return; processed.current = true; void processDueMarketingPublications(); }, [processDueMarketingPublications]);
  const stats = useMemo(() => ({
    scheduled: data.marketingPublications.filter((item) => item.status === "scheduled").length,
    review: data.marketingPublications.filter((item) => item.status === "in_review").length,
    live: data.marketingPublications.filter((item) => item.status === "published").length,
    healthyRuns: data.automationRuns.filter((item) => ["simulated", "succeeded"].includes(item.status)).length,
  }), [data.automationRuns, data.marketingPublications]);

  return <>
    <section className="marketing-studio-hero"><div><span><Megaphone /> MARKETING STUDIO</span><h2>Planeje, aprove e automatize em um só lugar.</h2><p>Uma central operacional para coordenar campanhas sem perder contexto, versão ou controle.</p></div><button className="admin-button primary" onClick={() => { setTab("workflow"); setEditing(newMarketingPublication(currentUser.email)); }}><Plus /> Nova publicação</button></section>
    <section className="marketing-studio-metrics" aria-label="Resumo do Marketing Studio"><article><CalendarDays /><div><span>Agendadas</span><strong>{stats.scheduled}</strong><small>próximas publicações</small></div></article><article><GitPullRequestArrow /><div><span>Em revisão</span><strong>{stats.review}</strong><small>aguardando aprovação</small></div></article><article><Megaphone /><div><span>No ar</span><strong>{stats.live}</strong><small>campanhas publicadas</small></div></article><article><Activity /><div><span>Execuções seguras</span><strong>{stats.healthyRuns}</strong><small>testes e fluxos concluídos</small></div></article></section>
    <nav className="marketing-studio-tabs" aria-label="Áreas do Marketing Studio"><button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}><CalendarDays /> Calendário</button><button className={tab === "workflow" ? "active" : ""} onClick={() => setTab("workflow")}><GitPullRequestArrow /> Publicação</button><button className={tab === "automations" ? "active" : ""} onClick={() => setTab("automations")}><Workflow /> Automações</button></nav>
    {tab === "calendar" && <MarketingCalendar onOpen={(publication) => setEditing(publication)} />}
    {tab === "workflow" && <PublicationWorkflow onOpen={(publication) => setEditing(publication)} onNew={() => setEditing(newMarketingPublication(currentUser.email))} />}
    {tab === "automations" && <AutomationStudio />}
    {editing && <PublicationEditor publication={editing} onClose={() => setEditing(null)} />}
  </>;
}
