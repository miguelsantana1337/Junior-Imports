"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import { calendarItemsForDay, marketingCalendarItems } from "@/lib/marketing";
import { formatDateTime } from "@/lib/format";
import type { MarketingPublication } from "@/types/store";
import { useAdminData } from "./admin-data-provider";

const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const kindLabels = { campaign: "Campanha", banner: "Banner", coupon: "Cupom", cashback: "Cashback", message: "Mensagem" } as const;
const statusLabels = { draft: "Rascunho", in_review: "Em revisão", approved: "Aprovada", scheduled: "Agendada", published: "No ar", paused: "Pausada", archived: "Encerrada" } as const;

function monthCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const cursor = new Date(first);
  cursor.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + index);
    return day;
  });
}
export function MarketingCalendar({ onOpen }: { onOpen: (publication: MarketingPublication) => void }) {
  const { data } = useAdminData();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [kind, setKind] = useState<"all" | keyof typeof kindLabels>("all");
  const items = useMemo(() => marketingCalendarItems(data.marketingPublications, data.coupons, data.cashbackCampaigns).filter((item) => kind === "all" || item.kind === kind), [data.cashbackCampaigns, data.coupons, data.marketingPublications, kind]);
  const cells = useMemo(() => monthCells(month), [month]);
  const monthItems = items.filter((item) => calendarItemsForDay([item], new Date(month.getFullYear(), month.getMonth() + 1, 0)).length || calendarItemsForDay([item], month).length || (new Date(item.startsAt) >= month && new Date(item.startsAt) < new Date(month.getFullYear(), month.getMonth() + 1, 1)));

  return <section className="marketing-calendar-shell">
    <header className="marketing-section-header">
      <div><span>CALENDÁRIO EDITORIAL</span><h2>Tudo que entra no ar, em uma única visão</h2><p>Banners, cupons, cashback, mensagens e campanhas coordenados por data.</p></div>
      <div className="marketing-calendar-controls">
        <select aria-label="Filtrar tipo de campanha" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">Todos os tipos</option>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <button aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button>
        <strong>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>
        <button aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button>
      </div>
    </header>
    <div className="marketing-calendar-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="marketing-calendar-grid">{cells.map((day) => {
      const dayItems = calendarItemsForDay(items, day);
      const outside = day.getMonth() !== month.getMonth();
      const today = day.toDateString() === new Date().toDateString();
      return <article className={`${outside ? "outside" : ""} ${today ? "today" : ""}`} key={day.toISOString()}>
        <header><span>{day.getDate()}</span>{today && <b>Hoje</b>}</header>
        <div>{dayItems.slice(0, 3).map((item) => <button key={item.id} className={`calendar-campaign-pill ${item.kind} ${item.status}`} disabled={!item.publicationId} onClick={() => { const publication = data.marketingPublications.find((candidate) => candidate.id === item.publicationId); if (publication) onOpen(publication); }} title={`${item.name} · ${statusLabels[item.status]}`}><i /> <span>{item.name}</span></button>)}{dayItems.length > 3 && <small>+ {dayItems.length - 3} itens</small>}</div>
      </article>;
    })}</div>
    <div className="marketing-calendar-agenda"><header><CalendarDays /><strong>Agenda do mês</strong><span>{monthItems.length} item{monthItems.length === 1 ? "" : "s"}</span></header>{monthItems.map((item) => <button key={item.id} disabled={!item.publicationId} onClick={() => { const publication = data.marketingPublications.find((candidate) => candidate.id === item.publicationId); if (publication) onOpen(publication); }}><i className={item.kind} /><div><strong>{item.name}</strong><span>{kindLabels[item.kind]} · {statusLabels[item.status]}</span></div><small><Clock3 /> {formatDateTime(item.startsAt)}</small></button>)}</div>
  </section>;
}
