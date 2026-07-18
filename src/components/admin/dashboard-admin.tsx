"use client";

import {
  IconAlertTriangle,
  IconArrowRight,
  IconBox,
  IconBuildingStore,
  IconCalendarEvent,
  IconCircleCheck,
  IconCloudCheck,
  IconCoin,
  IconDatabase,
  IconFlask,
  IconLayoutDashboard,
  IconPackage,
  IconPhoto,
  IconShoppingBag,
  IconShoppingCartOff,
  IconSparkles,
  IconTag,
  IconTicket,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { useAdminData } from "./admin-data-provider";
import { formatDateTime, formatMoney } from "@/lib/format";
import { buildCustomerInsights, customerRecurrenceRate } from "@/lib/crm";

function getDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const auditEntityLabels: Record<string, string> = {
  products: "Produto",
  categories: "Categoria",
  banners: "Banner",
  home_sections: "Seção",
  store_pages: "Página",
  page_blocks: "Container",
  coupons: "Cupom",
  message_automations: "Automação",
  orders: "Pedido",
  profiles: "Usuário",
  auth_mfa_factors: "Autenticador",
  store_settings: "Configurações",
};

function auditDescription(action: "insert" | "update" | "delete", entityType: string, label: string) {
  const entity = auditEntityLabels[entityType] ?? "Item";
  const verb = action === "insert" ? "criado" : action === "delete" ? "excluído" : "atualizado";
  return `${entity} “${label || "sem nome"}” ${verb}`;
}

export function DashboardAdmin() {
  const { data, demoMode, currentUser } = useAdminData();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const accountName = currentUser.fullName.split(/\s+/)[0] || "Administrador";
  const activityProduct = data.products[0];
  const activityCategory = data.categories[0];
  const todayKey = getDayKey(now);
  const activeProducts = data.products.filter((product) => product.active);
  const activeCoupons = data.coupons.filter((coupon) => coupon.active);
  const activeBanners = data.banners.filter((banner) => banner.active);
  const activeSections = data.sections.filter((section) => section.active);
  const customerInsights = buildCustomerInsights(data.customers, data.orders, now);
  const recurrenceRate = customerRecurrenceRate(customerInsights);
  const customersNeedingContact = customerInsights.filter((customer) => ["at_risk", "inactive"].includes(customer.segment));
  const lowStock = activeProducts.filter((product) => product.stock <= 10);
  const ordersToday = data.orders.filter((order) => order.createdAt.slice(0, 10) === todayKey);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const weeklyRevenue = data.orders
    .filter((order) => new Date(order.createdAt) >= sevenDaysAgo)
    .reduce((sum, order) => sum + order.total, 0);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const day = getDayKey(date);
    return {
      key: day,
      label: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: data.orders.filter((order) => order.createdAt.slice(0, 10) === day).length,
    };
  });
  const maxOrders = Math.max(...days.map((day) => day.value), 1);
  const completedSteps = [activeProducts.length > 0, activeSections.length > 0, false, data.orders.length > 0].filter(Boolean).length;

  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="admin-dashboard-command">
      <header className="admin-dashboard-hero">
        <div className="admin-dashboard-welcome">
          <span className="admin-dashboard-kicker"><IconSparkles /> Centro de controle</span>
          <h1>{greeting}, {accountName}</h1>
          <div className="admin-dashboard-subtitle">
            <span>Sua loja está pronta para testes</span>
            <strong><IconFlask /> Demonstração — não realiza vendas reais</strong>
          </div>
        </div>
        <div className="admin-dashboard-date">
          <IconCalendarEvent />
          <div><span>Visão de hoje</span><time dateTime={todayKey}>{dateLabel}</time></div>
        </div>
      </header>

      <section className="admin-command-stats" aria-label="Resumo da loja">
        <article className="stat-orders"><span><IconShoppingBag /></span><div><small>Pedidos</small><strong>{ordersToday.length}</strong><p>{ordersToday.length} novos hoje</p></div></article>
        <article className="stat-revenue"><span><IconCoin /></span><div><small>Receita simulada</small><strong>{formatMoney(weeklyRevenue)}</strong><p>Últimos 7 dias</p></div></article>
        <article className="stat-products"><span><IconBox /></span><div><small>Produtos ativos</small><strong>{activeProducts.length}</strong><p>Catálogo publicado</p></div></article>
        <article className="stat-coupons"><span><IconTicket /></span><div><small>Cupons ativos</small><strong>{activeCoupons.length}</strong><p>{activeCoupons.length === 1 ? "1 disponível" : `${activeCoupons.length} disponíveis`}</p></div></article>
        <article className="stat-customers"><span><IconUsers /></span><div><small>Clientes</small><strong>{customerInsights.length}</strong><p>{customersNeedingContact.length} para acompanhar</p></div></article>
        <article className="stat-recurrence"><span><IconShoppingBag /></span><div><small>Recompra</small><strong>{recurrenceRate.toFixed(0)}%</strong><p>{customerInsights.filter((customer) => customer.orderCount > 1).length} recorrentes</p></div></article>
      </section>

      <div className="admin-command-grid">
        <div className="admin-command-primary">
          <section className="admin-command-panel admin-priorities">
            <header><h2>Prioridades de hoje</h2></header>
            <div className="admin-priority-list">
              <article>
                <span className="warning"><IconAlertTriangle /></span><b>1</b>
                <div><strong>{lowStock.length ? `Revise ${lowStock.length} produtos com estoque baixo` : "Seu estoque está em dia"}</strong><p>{lowStock.length ? "Produtos com estoque ≤ 10 unidades." : "Nenhum produto precisa de atenção imediata."}</p></div>
                <Link href="/admin/products">Revisar</Link>
              </article>
              <article>
                <span className="danger"><IconPhoto /></span><b>2</b>
                <div><strong>{activeBanners.length ? `Revise seus ${activeBanners.length} banners ativos` : "Sua vitrine ainda não tem banners ativos"}</strong><p>Banners ajudam a destacar promoções e novidades.</p></div>
                <Link href="/admin/banners">{activeBanners.length ? "Gerenciar banners" : "Adicionar banner"}</Link>
              </article>
              <article>
                <span className="info"><IconShoppingBag /></span><b>3</b>
                <div><strong>{customersNeedingContact.length ? `Retome contato com ${customersNeedingContact.length} clientes` : "Relacionamento com clientes em dia"}</strong><p>{customersNeedingContact.length ? "Clientes inativos ou fora da frequência esperada." : "Nenhum cliente precisa de acompanhamento imediato."}</p></div>
                <Link href="/admin/customers">Abrir CRM</Link>
              </article>
            </div>
          </section>

          <section className="admin-command-panel admin-activity">
            <header><h2>Atividade recente</h2><Link href="/admin/data">Ver todas</Link></header>
            <div className="admin-activity-list">
              {data.auditLogs.slice(0, 5).map((log) => <article key={log.id}><span className="blue"><IconDatabase /></span><div><strong>{auditDescription(log.action, log.entityType, log.entityLabel)}</strong><p>{log.actorEmail || "Equipe administrativa"}</p></div><time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time></article>)}
              {!data.auditLogs.length && <>
                <article><span className="blue"><IconPackage /></span><div><strong>{activityProduct ? `Produto “${activityProduct.name}” está no catálogo` : "Cadastre o primeiro produto"}</strong><p>{activityProduct ? `${activityProduct.stock} unidades disponíveis` : "O catálogo ainda está vazio"}</p></div><time>Agora</time></article>
                <article><span className="green"><IconDatabase /></span><div><strong>{demoMode ? "Modo demonstrativo iniciado" : "Supabase conectado com sucesso"}</strong><p>{demoMode ? "Dados armazenados neste navegador" : `Projeto “${data.settings.storeName}” — conexão ativa`}</p></div><time>Agora</time></article>
                <article><span className="purple"><IconTag /></span><div><strong>{activityCategory ? `Categoria “${activityCategory.name}” organizada` : "Crie a primeira categoria"}</strong><p>{activityCategory ? `${data.products.filter((product) => product.categoryId === activityCategory.id).length} produtos vinculados` : "Organize os produtos por categoria"}</p></div><time>Agora</time></article>
              </>}
            </div>
          </section>

          <section className="admin-command-panel admin-weekly-orders">
            <header><div><h2>Pedidos dos últimos 7 dias</h2><p>Pedidos demonstrativos registrados no checkout</p></div><Link href="/admin/orders">Ver pedidos <IconArrowRight /></Link></header>
            <div className="admin-weekly-chart" aria-label="Gráfico de pedidos dos últimos sete dias">
              {days.map((day) => <div className="admin-weekly-day" key={day.key}><div><span style={{ height: `${Math.max(2, (day.value / maxOrders) * 72)}px` }} /></div><small>{day.label} {day.date}</small></div>)}
              {data.orders.length === 0 && <div className="admin-chart-empty"><IconShoppingCartOff /><div><strong>Nenhum pedido registrado neste período</strong><p>Quando receber pedidos, eles aparecerão aqui.</p></div><Link href="/">Simular pedido</Link></div>}
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
              <Link href="/admin/sections"><span className="orange"><IconLayoutDashboard /></span><div><strong>Organizar início</strong><small>Editar página inicial</small></div></Link>
            </div>
          </section>

          <section className="admin-command-panel admin-store-health">
            <header><h2>Status da loja</h2></header>
            <div>
              <article><IconPackage /><strong>Catálogo</strong><span>{activeProducts.length} produtos ativos</span><b>OK</b></article>
              <article><IconBuildingStore /><strong>Vitrine</strong><span>{activeSections.length} seções publicadas</span><b>OK</b></article>
              <article><IconDatabase /><strong>Supabase</strong><span>{demoMode ? "Modo local" : "Conexão ativa"}</span><b>OK</b></article>
              <article><IconCloudCheck /><strong>Teste de checkout</strong><span>Simulação disponível</span><b>OK</b></article>
            </div>
          </section>

          <section className="admin-command-panel admin-next-steps">
            <header><h2>Próximos passos</h2></header>
            <div className="admin-progress-layout">
              <div className="admin-progress-ring"><CircularProgressbar value={(completedSteps / 4) * 100} text={`${completedSteps}/4`} styles={buildStyles({ pathColor: "#1677ff", trailColor: "#e6ebf2", textColor: "#0b1733", textSize: "22px", strokeLinecap: "butt" })} /></div>
              <div className="admin-progress-copy"><strong>{completedSteps} de 4 concluídos</strong><p>Complete os passos para preparar sua loja.</p></div>
            </div>
            <div className="admin-step-list">
              <span className="done"><IconCircleCheck /> Adicionar produtos ao catálogo</span>
              <span className="done"><IconCircleCheck /> Configurar página inicial</span>
              <span className="current"><b>3</b> Configurar formas de entrega</span>
              <span><b>4</b> Realizar pedido de teste completo</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
