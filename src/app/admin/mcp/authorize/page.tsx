import { redirect } from "next/navigation";
import { Bot, CheckCircle2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { OAuthRequestError, validateOAuthAuthorizeRequest } from "@/lib/mcp/oauth";

export const metadata = { title: "Conectar ChatGPT" };

function currentPath(params: URLSearchParams) {
  return `/admin/mcp/authorize?${params.toString()}`;
}
export default async function McpAuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  Object.entries(raw).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  let oauthRequest;
  try {
    oauthRequest = await validateOAuthAuthorizeRequest(params);
  } catch (error) {
    const message = error instanceof OAuthRequestError ? error.message : "Solicitação inválida.";
    return <main className="mfa-page"><section className="mfa-card"><X /><h1>Conexão inválida</h1><p>{message}</p></section></main>;
  }

  const returnTo = currentPath(params);
  const supabase = await createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user) redirect(`/admin/login?returnTo=${encodeURIComponent(returnTo)}`);
  const assurance = await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.data?.currentLevel !== "aal2") redirect(`/admin/mfa?returnTo=${encodeURIComponent(returnTo)}`);
  const actor = await requireAdmin();

  return (
    <main className="mfa-page">
      <section className="mfa-card mcp-consent-card">
        <div className="mfa-icon"><Bot /></div>
        <span>INTEGRAÇÃO SEGURA</span>
        <h1>Conectar Junior Imports ao ChatGPT</h1>
        <p><strong>{oauthRequest.clientName}</strong> solicita acesso à loja vinculada a <strong>{actor.email}</strong>.</p>
        <div className="mcp-consent-list">
          <article><CheckCircle2 /><div><strong>Consultar a operação</strong><p>Pedidos, produtos, estoque, clientes, caixa e prioridades.</p></div></article>
          {oauthRequest.scopes.includes("junior.write") && <article><LockKeyhole /><div><strong>Preparar alterações</strong><p>Toda gravação exibirá um resumo e exigirá sua confirmação explícita.</p></div></article>}
          <article><ShieldCheck /><div><strong>Permissões preservadas</strong><p>O ChatGPT só poderá fazer o que este usuário já pode fazer no painel.</p></div></article>
        </div>
        <form action="/api/mcp/oauth/authorize/approve" method="post">
          {["client_id", "redirect_uri", "state", "scope", "code_challenge", "code_challenge_method", "response_type", "resource"].map((key) => (
            <input key={key} type="hidden" name={key} value={params.get(key) ?? ""} />
          ))}
          <button className="admin-button primary" type="submit" name="decision" value="approve"><ShieldCheck /> Autorizar com MFA</button>
          <button className="admin-button" type="submit" name="decision" value="deny"><X /> Cancelar</button>
        </form>
        <small>A conexão pode ser revogada a qualquer momento. Senhas e códigos MFA nunca são enviados ao ChatGPT.</small>
      </section>
    </main>
  );
}
