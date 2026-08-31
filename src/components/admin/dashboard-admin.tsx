"use client";

import {
  IconAlertTriangle,
  IconArrowRight,
  IconBox,
  IconBuildingStore,
  IconCalendarEvent,
  IconCloudCheck,
  IconCoin,
  IconDatabase,
  IconFlask,
  IconLayoutDashboard,
  IconPackage,
  IconPhoto,
  IconShoppingBag,
  IconShoppingCartOff,
  IconTicket,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useAdminData } from "./admin-data-provider";
import { formatMoney, formatStoreDateKey, formatStoreHour, STORE_TIME_ZONE } from "@/lib/format";
import { buildCustomerInsights, customerMatchesOrder } from "@/lib/crm";
import { orderPaymentsRevenue } from "@/lib/order-payments";
import { officialFinancialTransactions, officialOrders, operationStartLabel, operationStartTime } from "@/lib/operation-scope";
import { orderOperationalStatus, orderPaymentStatus } from "@/lib/order-lifecycle";
import { buildAdminPeriodBuckets, filterByAdminPeriod } from "@/lib/admin-period";
import { useAdminPeriod } from "@/components/admin/admin-period-context";

export function DashboardAdmin() {
  const { data, demoMode, currentUser, referenceNow } = useAdminData();
  const { range } = useAdminPeriod();
  const now = new Date(referenceNow);
  const hour = formatStoreHour(now);
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const accountName = currentUser.fullName.split(/\s+/)[0] || "Administrador";
  const todayKey = formatStoreDateKey(now);
  const activeProducts = data.products.filter((product) => product.active);
  const activeSections = data.sections.filter((section) => section.active);
  const operationOrders = officialOrders(data.orders, data.settings);
  const operationTransactions = officialFinancialTransactions(data.financialTransactions, data.settings);
  const operationDate = operationStartLabel(data.settings);
  const operationStart = operationStartTime(data.settings);
  const customerInsights = buildCustomerInsights(data.customers, data.orders, now);
  const customersNeedingContact = customerInsights.filter((customer) => ["at_risk", "inactive"].includes(customer.segment));
  const lowStock = activeProducts.filter((product) => product.stock <= 10);
  const periodOrders = filterByAdminPeriod(operationOrders, (order) => order.createdAt, range);
  const periodTransactions = filterByAdminPeriod(operationTransactions, (transaction) => transaction.paidAt || transaction.createdAt, range);
  const periodBuyers = customerInsights.filter((customer) => periodOrders.some((order) => customerMatchesOrder(customer, order)));
  const newOrders = operationOrders.filter((order) => orderOperationalStatus(order) === "Novo");
  const pendingPayments = operationOrders.filter((order) => (
    !["Cancelado", "Entregue"].includes(orderOperationalStatus(order))
    && ["Pendente", "Parcial"].includes(orderPaymentStatus(order))
  ));
  const periodRevenue = orderPaymentsRevenue(periodTransactions, new Date(0));

  const days = buildAdminPeriodBuckets(range).map((bucket) => {
    return {
      key: bucket.key,
      label: bucket.label,
      shortLabel: bucket.shortLabel,
      value: periodOrders.filter((order) => {
        const day = formatStoreDateKey(order.createdAt);
        return day >= bucket.dateFrom && day <= bucket.dateTo;
      }).length,
    };
  });
  const maxOrders = Math.max(...days.map((day) => day.value), 1);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: STORE_TIME_ZONE,
  }).format(now);
  return (
    <div className="admin-dashboard-command">
      <header className="admin-dashboard-hero">
        <div className="admin-dashboard-welcome">
          <span className="admin-dashboard-kicker">Hoje</span>
          <h1><span className="admin-dashboard-title-desktop">{greeting}, {accountName}</span><span className="admin-dashboard-title-mobile">Hoje</span></h1>
          <div className="admin-dashboard-subtitle">
            <span>{demoMode ? "Sua loja está pronta para testes" : "Sua loja está pronta para operar"}</span>
            <strong>{demoMode ? <><IconFlask /> Demonstração — não realiza vendas reais</> : <><IconCloudCheck /> Operação conectada — pedidos reais</>}</strong>
          </div>
        </div>
        <div className="admin-dashboard-date">
          <IconCalendarEvent />
          <div><span>Visão de hoje</span><time dateTime={todayKey}>{dateLabel}</time></div>
        </div>
      </header>

      {operationDate && <div className="operation-baseline-note"><IconCalendarEvent /><div><strong>{operationStart !== null && now.getTime() < operationStart ? `Operação oficial programada para ${operationDate}` : `Operação oficial desde ${operationDate}`}</strong><span>Receita, pedidos operacionais, gráficos e comparativos consideram somente este novo ciclo. O histórico anterior continua preservado.</span></div></div>}

      <section className="admin-workflow-strip" aria-label="Fluxo operacional">
        <Link href="/admin/orders?status=Novo"><span><IconShoppingBag /></span><div><strong>{newOrders.length}</strong><small>Novos pedidos</small></div></Link>
        <Link href="/admin/orders?payment=open"><span><IconCoin /></span><div><strong>{pendingPayments.length}</strong><small>Pagamentos pendentes</small></div></Link>
        <Link href="/admin/products"><span><IconAlertTriangle /></span><div><strong>{lowStock.length}</strong><small>Estoques para revisar</small></div></Link>
        <Link href="/admin/customers"><span><IconUsers /></span><div><strong>{customersNeedingContact.length}</strong><small>Clientes para contatar</small></div></Link>
      </section>

      <section className="admin-command-stats" aria-label="Resumo da loja">
        <article className="stat-orders"><span><IconShoppingBag /></span><div><small>Pedidos no período</small><strong>{periodOrders.length}</strong><p>{range.label}</p></div></article>
        <article className="stat-revenue"><span><IconCoin /></span><div><small>Receita recebida</small><strong className="admin-money-value">{formatMoney(periodRevenue)}</strong><p>Pagamentos recebidos · {range.label.toLocaleLowerCase("pt-BR")}</p></div></article>
        <article className="stat-products"><span><IconBox /></span><div><small>Produtos ativos</small><strong>{activeProducts.length}</strong><p>Catálogo publicado</p></div></article>
        <article className="stat-customers"><span><IconUsers /></span><div><small>Compradores no período</small><strong>{periodBuyers.length}</strong><p>{customerInsights.length} clientes cadastrados</p></div></article>
      </section>

      <div className="admin-command-grid">
        <div className="admin-command-primary">
          <section className="admin-command-panel admin-weekly-orders">
            <header><div><h2>Pedidos · {range.label}</h2><p>{demoMode ? "Pedidos demonstrativos registrados no checkout" : "Pedidos registrados no checkout"}</p></div><Link href="/admin/orders">Ver pedidos <IconArrowRight /></Link></header>
            <div className="admin-weekly-chart" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} aria-label={`Gráfico de pedidos: ${range.label}`}>
              {days.map((day) => <div className="admin-weekly-day" key={day.key}><div><span style={{ height: `${Math.max(2, (day.value / maxOrders) * 72)}px` }} /></div><small data-short={day.shortLabel}>{day.label}</small></div>)}
              {periodOrders.length === 0 && <div className="admin-chart-empty"><IconShoppingCartOff /><div><strong>Nenhum pedido registrado neste período</strong><p>Quando receber pedidos, eles aparecerão aqui.</p></div><Link href={data.tenant.storefrontPath || "/"}>{demoMode ? "Simular pedido" : "Abrir loja"}</Link></div>}
            </div>
          </section>
        </div>

        <aside className="admin-command-secondary">
          <section className="admin-command-panel admin-shortcuts">
            <header><h2>Atalhos</h2></header>
            <div>
              <Link href="/admin/products/new"><span className="blue"><IconPackage /></span><div><strong>Novo produto</strong><small>Adicionar ao catálogo</small></div></Link>
              <Link href="/admin/coupons?novo=1"><span className="purple"><IconTicket /></span><div><strong>Novo cupom</strong><small>Criar promoção</small></div></Link>
              <Link href="/admin/banners?novo=1"><span className="green"><IconPhoto /></span><div><strong>Novo banner</strong><small>Destacar na vitrine</small></div></Link>
              <Link href="/admin/layout"><span className="orange"><IconLayoutDashboard /></span><div><strong>Editar loja</strong><small>Páginas, seções e conteúdo</small></div></Link>
            </div>
          </section>

          <section className="admin-command-panel admin-store-health">
            <header><h2>Status da loja</h2></header>
            <div>
              <article><IconPackage /><strong>Catálogo</strong><span>{activeProducts.length} produtos ativos</span><b>OK</b></article>
              <article><IconBuildingStore /><strong>Vitrine</strong><span>{activeSections.length} seções publicadas</span><b>OK</b></article>
              <article><IconDatabase /><strong>Supabase</strong><span>{demoMode ? "Modo local" : "Conexão ativa"}</span><b>OK</b></article>
              <article><IconCloudCheck /><strong>{demoMode ? "Teste de checkout" : "Checkout WhatsApp"}</strong><span>{demoMode ? "Simulação disponível" : "Fluxo operacional"}</span><b>OK</b></article>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
