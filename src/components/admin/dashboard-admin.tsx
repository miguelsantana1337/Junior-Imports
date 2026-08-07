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
  IconTag,
  IconTicket,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useAdminData } from "./admin-data-provider";
import { formatDateTime, formatMoney, formatStoreDateKey, formatStoreHour, STORE_TIME_ZONE } from "@/lib/format";
import { buildCustomerInsights } from "@/lib/crm";
import { confirmedOrderRevenue } from "@/lib/order-revenue";
import { officialOrders, operationStartLabel, operationStartTime } from "@/lib/operation-scope";

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
  const { data, demoMode, currentUser, referenceNow } = useAdminData();
  const now = new Date(referenceNow);
  const hour = formatStoreHour(now);
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const accountName = currentUser.fullName.split(/\s+/)[0] || "Administrador";
  const activityProduct = data.products[0];
  const activityCategory = data.categories[0];
  const todayKey = formatStoreDateKey(now);
  const activeProducts = data.products.filter((product) => product.active);
  const activeBanners = data.banners.filter((banner) => banner.active);
  const activeSections = data.sections.filter((section) => section.active);
  const operationOrders = officialOrders(data.orders, data.settings);
  const operationDate = operationStartLabel(data.settings);
  const operationStart = operationStartTime(data.settings);
  const customerInsights = buildCustomerInsights(data.customers, data.orders, now);
  const customersNeedingContact = customerInsights.filter((customer) => ["at_risk", "inactive"].includes(customer.segment));
  const lowStock = activeProducts.filter((product) => product.stock <= 10);
  const ordersToday = operationOrders.filter((order) => formatStoreDateKey(order.createdAt) === todayKey);
  const newOrders = operationOrders.filter((order) => order.status === "Novo");
  const paidOrders = operationOrders.filter((order) => order.status === "Pago");
  const sevenDaysAgoKey = formatStoreDateKey(new Date(referenceNow - 6 * 86_400_000));
  const sevenDaysAgo = new Date(`${sevenDaysAgoKey}T00:00:00-03:00`);
  const weeklyRevenue = confirmedOrderRevenue(operationOrders, sevenDaysAgo);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(referenceNow - (6 - index) * 86_400_000);
    const day = formatStoreDateKey(date);
    return {
      key: day,
      label: date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: STORE_TIME_ZONE }).replace(".", ""),
      date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: STORE_TIME_ZONE }),
      value: operationOrders.filter((order) => formatStoreDateKey(order.createdAt) === day).length,
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
          <span className="admin-dashboard-kicker">Início</span>
          <h1><span className="admin-dashboard-title-desktop">{greeting}, {accountName}</span><span className="admin-dashboard-title-mobile">Início</span></h1>
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
        <Link href="/admin/orders?status=Pago"><span><IconCoin /></span><div><strong>{paidOrders.length}</strong><small>Pagos para preparar</small></div></Link>
        <Link href="/admin/products"><span><IconAlertTriangle /></span><div><strong>{lowStock.length}</strong><small>Estoques para revisar</small></div></Link>
        <Link href="/admin/customers"><span><IconUsers /></span><div><strong>{customersNeedingContact.length}</strong><small>Clientes para contatar</small></div></Link>
      </section>

      <section className="admin-command-stats" aria-label="Resumo da loja">
        <article className="stat-orders"><span><IconShoppingBag /></span><div><small>Pedidos</small><strong>{ordersToday.length}</strong><p>{ordersToday.length} novos hoje</p></div></article>
        <article className="stat-revenue"><span><IconCoin /></span><div><small>Receita confirmada</small><strong className="admin-money-value">{formatMoney(weeklyRevenue)}</strong><p>Pedidos pagos · últimos 7 dias</p></div></article>
        <article className="stat-products"><span><IconBox /></span><div><small>Produtos ativos</small><strong>{activeProducts.length}</strong><p>Catálogo publicado</p></div></article>
        <article className="stat-customers"><span><IconUsers /></span><div><small>Clientes</small><strong>{customerInsights.length}</strong><p>{customersNeedingContact.length} para acompanhar</p></div></article>
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
            <header><div><h2>Pedidos dos últimos 7 dias</h2><p>{demoMode ? "Pedidos demonstrativos registrados no checkout" : "Pedidos registrados no checkout"}</p></div><Link href="/admin/orders">Ver pedidos <IconArrowRight /></Link></header>
            <div className="admin-weekly-chart" aria-label="Gráfico de pedidos dos últimos sete dias">
              {days.map((day) => <div className="admin-weekly-day" key={day.key}><div><span style={{ height: `${Math.max(2, (day.value / maxOrders) * 72)}px` }} /></div><small>{day.label} {day.date}</small></div>)}
              {operationOrders.length === 0 && <div className="admin-chart-empty"><IconShoppingCartOff /><div><strong>Nenhum pedido registrado neste período</strong><p>Quando receber pedidos, eles aparecerão aqui.</p></div><Link href={data.tenant.storefrontPath || "/"}>{demoMode ? "Simular pedido" : "Abrir loja"}</Link></div>}
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
