import {
  IconBrandOpenai,
  IconCheck,
  IconExternalLink,
  IconLock,
  IconPlugConnected,
  IconPlugConnectedX,
  IconShieldCheck,
} from "@tabler/icons-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { mcpUrls } from "@/lib/mcp/config";
import { disconnectChatGptAction } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
  if (!value) return "Ainda não utilizada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default async function ChatGptIntegrationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requireAdmin("settings");
  const admin = createAdminClient();
  const params = await searchParams;
  const { data: connections, error } = admin ? await admin
    .from("mcp_oauth_tokens")
    .select("id, scopes, created_at, last_used_at, expires_at")
    .eq("tenant_id", actor.tenantId)
    .eq("user_id", actor.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false }) : { data: null, error: new Error("Integração indisponível") };
  const activeConnections = connections ?? [];
  const latest = activeConnections[0];
  const connected = activeConnections.length > 0;
  const setupPending = Boolean(error);
  const mcp = mcpUrls();

  return <div className="mcp-integration-page">
    {params.status === "disconnected" && <div className="mcp-integration-alert success"><IconCheck /> ChatGPT desconectado com sucesso.</div>}
    {params.status === "error" && <div className="mcp-integration-alert error">Não foi possível desconectar agora. Tente novamente.</div>}
    <section className="mcp-integration-hero">
      <span className="mcp-integration-logo"><IconBrandOpenai /></span>
      <div>
        <small>ASSISTENTE OPERACIONAL</small>
        <h2>Junior Imports no ChatGPT</h2>
        <p>Consulte a operação, prepare atendimentos e execute rotinas do painel conversando com o ChatGPT.</p>
      </div>
      <span className={`mcp-integration-status ${connected ? "connected" : ""}`}>
        {connected ? <IconPlugConnected /> : <IconPlugConnectedX />}
        {connected ? "Conectado" : setupPending ? "Preparando" : "Não conectado"}
      </span>
    </section>

    <div className="mcp-integration-grid">
      <section className="admin-panel mcp-integration-card">
        <header className="admin-panel-head"><div><h2>O que ele pode fazer</h2><p>As respostas usam os dados atuais da loja e respeitam o acesso do usuário conectado.</p></div></header>
        <div className="mcp-capability-list">
          <article><IconCheck /><div><strong>Resumo e busca</strong><span>Pedidos, clientes, produtos, estoque, financeiro e oportunidades de recompra.</span></div></article>
          <article><IconCheck /><div><strong>Rotina de pedidos</strong><span>Avançar etapas, registrar pagamentos parciais, cancelar, arquivar e ajustar o total financeiro.</span></div></article>
          <article><IconCheck /><div><strong>Operação e atendimento</strong><span>Movimentar estoque, registrar caixa e preparar mensagens com link para abrir no WhatsApp.</span></div></article>
        </div>
      </section>

      <section className="admin-panel mcp-integration-card security">
        <header className="admin-panel-head"><div><h2>Proteções ativas</h2><p>O ChatGPT nunca recebe sua senha nem o segredo do autenticador.</p></div></header>
        <div className="mcp-capability-list">
          <article><IconShieldCheck /><div><strong>Login e MFA obrigatórios</strong><span>A conexão só é liberada após entrar no painel e confirmar o código de duas etapas.</span></div></article>
          <article><IconLock /><div><strong>Confirmação antes de alterar</strong><span>Toda ação sensível mostra um resumo e aguarda sua autorização explícita.</span></div></article>
          <article><IconShieldCheck /><div><strong>Permissões e auditoria</strong><span>O plugin herda seu perfil do painel e registra as ações realizadas.</span></div></article>
        </div>
      </section>
    </div>

    <section className="admin-panel mcp-connection-panel">
      <header className="admin-panel-head"><div><h2>Sua conexão</h2><p>Cada usuário conecta a própria conta e pode removê-la a qualquer momento.</p></div></header>
      {connected ? <div className="mcp-connection-details">
        <div><small>SITUAÇÃO</small><strong>Ativa em {activeConnections.length} sessão{activeConnections.length === 1 ? "" : "ões"}</strong></div>
        <div><small>CONECTADA EM</small><strong>{formatDate(latest?.created_at)}</strong></div>
        <div><small>ÚLTIMO USO</small><strong>{formatDate(latest?.last_used_at)}</strong></div>
        <div><small>ACESSO CONCEDIDO</small><strong>{(latest?.scopes ?? []).includes("junior.write") ? "Consulta e ações confirmadas" : "Somente consulta"}</strong></div>
        <form action={disconnectChatGptAction}><button className="admin-button danger" type="submit"><IconPlugConnectedX /> Desconectar ChatGPT</button></form>
      </div> : <div className="mcp-connection-empty">
        <IconBrandOpenai />
        <div><strong>{setupPending ? "A estrutura está sendo publicada" : "Abra o ChatGPT para conectar"}</strong><p>{setupPending ? "Esta tela ficará disponível assim que a atualização do banco terminar." : "No primeiro uso, o ChatGPT abrirá o login deste painel e solicitará seu MFA e sua autorização."}</p></div>
        {!setupPending && <a className="admin-button primary" href="https://chatgpt.com" target="_blank" rel="noreferrer">Abrir ChatGPT <IconExternalLink /></a>}
      </div>}
      <footer className="mcp-endpoint-note"><IconLock /><span>Canal protegido: <code>{mcp.resource}</code></span></footer>
    </section>
  </div>;
}
