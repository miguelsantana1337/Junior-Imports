import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { simulateCampaignGuardian } from "@/lib/admin31";
import { runContinuityScan } from "@/lib/admin31-continuity";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { requireAdmin, type AdminSessionUser } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureEnabled } from "@/lib/feature-flags";
import type { AdminPermission } from "@/types/store";

type Row = Record<string, unknown>;
const string = (value: unknown) => String(value ?? "");
const number = (value: unknown) => Number(value) || 0;
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

function requirePermission(actor: AdminSessionUser, permission: AdminPermission) {
  if (!hasAdminPermission(actor.role, actor.permissions, permission)) {
    throw new AdminRequestError("Seu usuário não possui permissão para esta operação.", 403);
  }
}

function responseError(error: unknown) {
  const redirectDigest = error && typeof error === "object" && "digest" in error
    ? String((error as { digest?: unknown }).digest ?? "")
    : "";
  if ((error instanceof Error && error.message === "NEXT_REDIRECT") || redirectDigest.startsWith("NEXT_REDIRECT;")) {
    throw error;
  }
  if (error instanceof AdminRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  return NextResponse.json({ error: message }, { status: 400 });
}

function confirmationHash(action: string, entityType: string, entityId: string, actorId: string) {
  return createHash("sha256").update(`${action}:${entityType}:${entityId}:${actorId}:${randomBytes(16).toString("hex")}`).digest("hex");
}

function mapDivergence(row: Row) {
  return {
    id: string(row.id), ruleKey: string(row.rule_key), entityType: string(row.entity_type), entityId: string(row.entity_id),
    entityLabel: string(row.entity_label), severity: string(row.severity), status: string(row.status), summary: string(row.summary),
    evidence: object(row.evidence), proposedAction: string(row.proposed_action), impactAmount: row.impact_amount === null ? null : number(row.impact_amount),
    occurrenceCount: number(row.occurrence_count), firstSeenAt: string(row.first_seen_at), lastSeenAt: string(row.last_seen_at),
    resolutionReason: string(row.resolution_reason),
  };
}

async function loadDivergences(actor: AdminSessionUser) {
  requirePermission(actor, "orders");
  const supabase = createAdminClient();
  if (!supabase) return { divergences: [] };
  await supabase.rpc("scan_operational_divergences", { p_tenant_id: actor.tenantId });
  const { data, error } = await supabase.from("operational_divergences").select("*")
    .eq("tenant_id", actor.tenantId).order("last_seen_at", { ascending: false }).limit(250);
  if (error) throw new Error("Não foi possível carregar as divergências.");
  return { divergences: (data ?? []).map((row) => mapDivergence(row as Row)) };
}

async function loadGuardian(actor: AdminSessionUser) {
  requirePermission(actor, "marketing");
  const supabase = createAdminClient();
  if (!supabase) return { products: [], campaigns: [], simulations: [] };
  const [products, campaigns, simulations, bundles, options] = await Promise.all([
    supabase.from("products").select("id,name,price,cost_price,active,category_id").eq("tenant_id", actor.tenantId).eq("active", true).order("name"),
    supabase.from("cashback_campaigns").select("*").eq("tenant_id", actor.tenantId).order("updated_at", { ascending: false }),
    supabase.from("campaign_financial_simulations").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }).limit(30),
    supabase.from("product_bundles").select("id,product_id,component_count,allow_repetition,active").eq("tenant_id", actor.tenantId).eq("active", true),
    supabase.from("bundle_options").select("bundle_id,product_id,active").eq("tenant_id", actor.tenantId).eq("active", true),
  ]);
  const productRows = (products.data ?? []) as Row[];
  const productCosts = new Map(productRows.map((product) => [string(product.id), product.cost_price === null ? null : number(product.cost_price)]));
  const guardedProducts = productRows.map((product) => {
    const bundle = (bundles.data ?? []).find((candidate) => candidate.product_id === product.id);
    if (!bundle) return product;
    const costs = (options.data ?? []).filter((option) => option.bundle_id === bundle.id)
      .map((option) => productCosts.get(string(option.product_id))).filter((cost): cost is number => cost !== null && cost !== undefined).sort((a, b) => b - a);
    const componentCount = number(bundle.component_count);
    const worstCost = bundle.allow_repetition ? (costs[0] ?? 0) * componentCount : costs.slice(0, componentCount).reduce((sum, cost) => sum + cost, 0);
    return { ...product, cost_price: costs.length ? worstCost : null, guardian_cost_source: "bundle_worst_case" };
  });
  return {
    products: guardedProducts, campaigns: campaigns.data ?? [], simulations: simulations.data ?? [],
  };
}

async function loadReferrals(actor: AdminSessionUser) {
  requirePermission(actor, "customers");
  const supabase = createAdminClient();
  if (!supabase) return { campaigns: [], codes: [], links: [], rewards: [], customers: [] };
  const [campaigns, codes, links, rewards, customers] = await Promise.all([
    supabase.from("referral_campaigns").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }),
    supabase.from("referral_codes").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }),
    supabase.from("referral_links").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }).limit(200),
    supabase.from("referral_rewards").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("id,name,email,phone").eq("tenant_id", actor.tenantId).order("name").limit(1000),
  ]);
  return { campaigns: campaigns.data ?? [], codes: codes.data ?? [], links: links.data ?? [], rewards: rewards.data ?? [], customers: customers.data ?? [] };
}

async function loadBundles(actor: AdminSessionUser) {
  requirePermission(actor, "catalog");
  const supabase = createAdminClient();
  if (!supabase) return { bundles: [], products: [] };
  const [bundles, options, products] = await Promise.all([
    supabase.from("product_bundles").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }),
    supabase.from("bundle_options").select("*").eq("tenant_id", actor.tenantId).order("order_index"),
    supabase.from("products").select("id,name,stock,cost_price,active,image_url").eq("tenant_id", actor.tenantId).order("name"),
  ]);
  const productMap = new Map((products.data ?? []).map((row) => [string(row.id), row as Row]));
  return {
    products: products.data ?? [],
    bundles: (bundles.data ?? []).map((bundle) => ({
      ...bundle,
      product_name: string(productMap.get(string(bundle.product_id))?.name),
      options: (options.data ?? []).filter((option) => option.bundle_id === bundle.id).map((option) => ({
        ...option,
        product_name: string(productMap.get(string(option.product_id))?.name),
        stock: number(productMap.get(string(option.product_id))?.stock),
      })),
    })),
  };
}

async function loadFunnel(actor: AdminSessionUser) {
  requirePermission(actor, "orders");
  const supabase = createAdminClient();
  if (!supabase) return { events: [], carts: [], metrics: [] };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [events, carts] = await Promise.all([
    supabase.from("storefront_funnel_events").select("*").eq("tenant_id", actor.tenantId).gte("occurred_at", since).order("occurred_at", { ascending: false }).limit(5000),
    supabase.from("storefront_cart_sessions").select("*").eq("tenant_id", actor.tenantId).order("last_activity_at", { ascending: false }).limit(500),
  ]);
  const stages = ["product_viewed", "added_to_cart", "checkout_started", "order_registered", "whatsapp_opened", "partial_payment", "paid", "delivered"];
  const rows = events.data ?? [];
  const metrics = stages.map((stage, index) => {
    const sessions = new Set(rows.filter((row) => row.stage === stage).map((row) => row.session_id)).size;
    const previous = index === 0 ? sessions : new Set(rows.filter((row) => row.stage === stages[index - 1]).map((row) => row.session_id)).size;
    return { stage, sessions, conversionFromPrevious: previous > 0 ? Number((sessions / previous * 100).toFixed(1)) : 0 };
  });
  return { events: rows.slice(0, 250), carts: carts.data ?? [], metrics };
}

async function loadFlags(actor: AdminSessionUser) {
  requirePermission(actor, "settings");
  const supabase = createAdminClient();
  if (!supabase) return { flags: [] };
  const { data, error } = await supabase.from("feature_flags").select("*").eq("tenant_id", actor.tenantId).order("name");
  if (error) throw new Error("Não foi possível carregar as liberações.");
  return { flags: data ?? [] };
}

async function loadContinuity(actor: AdminSessionUser) {
  requirePermission(actor, "dashboard");
  const supabase = createAdminClient();
  if (!supabase) return { alerts: [], backups: [], copies: [], recoveryTests: [], webhookConfigured: false };
  const [alerts, backups, copies, recoveryTests] = await Promise.all([
    supabase.from("operational_alerts").select("*").eq("tenant_id", actor.tenantId).order("last_seen_at", { ascending: false }).limit(100),
    supabase.from("backup_runs").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }).limit(20),
    supabase.from("external_backup_copies").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }).limit(20),
    supabase.from("recovery_test_runs").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }).limit(20),
  ]);
  return { alerts: alerts.data ?? [], backups: backups.data ?? [], copies: copies.data ?? [], recoveryTests: recoveryTests.data ?? [], webhookConfigured: Boolean(process.env.OPERATIONS_ALERT_WEBHOOK_URL) };
}

async function loadMobile(actor: AdminSessionUser) {
  requirePermission(actor, "inventory");
  const supabase = createAdminClient();
  if (!supabase) return { barcodes: [], products: [], drafts: [], reversals: [], inventoryMovements: [] };
  const [barcodes, products, drafts, reversals, movements] = await Promise.all([
    supabase.from("product_barcodes").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }),
    supabase.from("products").select("id,name,sku,stock,image_url").eq("tenant_id", actor.tenantId).eq("active", true).order("name"),
    supabase.from("operation_drafts").select("*").eq("tenant_id", actor.tenantId).eq("actor_id", actor.id).order("created_at", { ascending: false }).limit(25),
    supabase.from("operation_reversals").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }).limit(50),
    supabase.from("inventory_movements").select("*").eq("tenant_id", actor.tenantId).order("created_at", { ascending: false }).limit(50),
  ]);
  return { barcodes: barcodes.data ?? [], products: products.data ?? [], drafts: drafts.data ?? [], reversals: reversals.data ?? [], inventoryMovements: movements.data ?? [] };
}

export async function GET(request: Request) {
  try {
    const actor = await requireAdmin();
    const selectedModule = new URL(request.url).searchParams.get("module") ?? "overview";
    const loaders: Record<string, () => Promise<Record<string, unknown>>> = {
      divergences: () => loadDivergences(actor), guardian: () => loadGuardian(actor), referrals: () => loadReferrals(actor),
      bundles: () => loadBundles(actor), funnel: () => loadFunnel(actor), flags: () => loadFlags(actor),
      continuity: () => loadContinuity(actor), mobile: () => loadMobile(actor),
    };
    const loader = loaders[selectedModule];
    if (!loader) return NextResponse.json({ error: "Módulo inválido." }, { status: 400 });
    return NextResponse.json(await loader(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responseError(error);
  }
}

const guardianSchema = z.object({
  campaignId: z.string().max(100).optional(),
  lines: z.array(z.object({ productId: z.string(), name: z.string(), price: z.number().nonnegative(), cost: z.number().nonnegative().nullable(), quantity: z.number().int().positive(), directDiscount: z.number().nonnegative().optional() })).min(1).max(100),
  coupon: z.object({ type: z.enum(["percent", "fixed"]), value: z.number().nonnegative() }).nullable().optional(),
  cashbackPercent: z.number().min(0).max(100), cashbackFixed: z.number().min(0).max(1_000_000), shipping: z.number().min(0).max(1_000_000),
  minimumMarginPercent: z.number().min(-100).max(100), scenarioKey: z.string().min(1).max(80), scenarioLabel: z.string().min(1).max(160),
});

const referralCampaignSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(3).max(160), status: z.enum(["draft", "active", "paused", "ended"]),
  startsAt: z.string().datetime(), endsAt: z.union([z.literal(""), z.string().datetime()]), rewardType: z.enum(["percent", "fixed"]),
  rewardValue: z.number().positive().max(1_000_000), rewardCap: z.number().min(0).max(1_000_000), creditValidDays: z.number().int().min(1).max(730),
  maximumPerReferrer: z.number().int().min(0).max(10000), maximumPerMonth: z.number().int().min(0).max(10000), minimumOrderAmount: z.number().min(0).max(1_000_000),
});

const bundleSchema = z.object({
  id: z.string().uuid().optional(), productId: z.string().min(1).max(160), name: z.string().trim().min(3).max(160), selectionLabel: z.string().trim().min(3).max(160),
  componentCount: z.number().int().min(1).max(50), allowRepetition: z.boolean(), maxPerComponent: z.number().int().min(1).max(50), active: z.boolean(),
  optionProductIds: z.array(z.string().min(1).max(160)).min(1).max(100),
});

export async function POST(request: Request) {
  let actor: AdminSessionUser | null = null;
  try {
    actor = await requireAdmin();
    guardAdminMutation(request, actor.id, 40);
    const body = await request.json().catch(() => null) as Row | null;
    const action = string(body?.action);
    const supabase = createAdminClient();
    if (!supabase) throw new AdminRequestError("Supabase indisponível.", 503);
    const assertFeature = async (key: string) => {
      if (!await featureEnabled(supabase, { tenantId: actor!.tenantId, key, subject: actor!.id, role: actor!.role })) {
        throw new AdminRequestError("Este módulo está temporariamente interrompido pela publicação controlada.", 503);
      }
    };

    if (action === "divergence_preview") {
      await assertFeature("reconciliation_center");
      requirePermission(actor, "orders"); requirePermission(actor, "inventory");
      const id = z.string().uuid().parse(body?.id);
      const { data: divergence, error } = await supabase.from("operational_divergences").select("*").eq("tenant_id", actor.tenantId).eq("id", id).maybeSingle();
      if (error || !divergence) throw new Error("Divergência não encontrada.");
      if (["manual_payment_review", "manual_finance_review"].includes(string(divergence.proposed_action))) {
        return NextResponse.json({ manual: true, preview: { summary: divergence.summary, evidence: divergence.evidence, guidance: "Abra o pedido e revise os pagamentos antes de decidir." } });
      }
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
      const { data: confirmation, error: confirmationError } = await supabase.from("operational_action_confirmations").insert({
        tenant_id: actor.tenantId, actor_id: actor.id, action: divergence.proposed_action, entity_type: "divergence", entity_id: id,
        payload_hash: confirmationHash(string(divergence.proposed_action), "divergence", id, actor.id),
        preview: { summary: divergence.summary, evidence: divergence.evidence, impact_amount: divergence.impact_amount }, expires_at: expiresAt,
      }).select("id,preview,expires_at").single();
      if (confirmationError) throw new Error("Não foi possível preparar a confirmação.");
      return NextResponse.json({ confirmation });
    }

    if (action === "divergence_apply") {
      await assertFeature("reconciliation_center");
      requirePermission(actor, "orders"); requirePermission(actor, "inventory");
      const id = z.string().uuid().parse(body?.id); const confirmationId = z.string().uuid().parse(body?.confirmationId);
      const reason = z.string().trim().min(5).max(300).parse(body?.reason);
      const { data, error } = await supabase.rpc("apply_operational_reconciliation", {
        p_tenant_id: actor.tenantId, p_divergence_id: id, p_confirmation_id: confirmationId,
        p_actor_id: actor.id, p_actor_email: actor.email, p_reason: reason,
      });
      if (error) throw new Error(error.message);
      await supabase.rpc("scan_operational_divergences", { p_tenant_id: actor.tenantId });
      return NextResponse.json({ ok: true, result: data });
    }

    if (action === "divergence_ignore") {
      await assertFeature("reconciliation_center");
      requirePermission(actor, "orders");
      const id = z.string().uuid().parse(body?.id); const reason = z.string().trim().min(5).max(300).parse(body?.reason);
      const { error } = await supabase.from("operational_divergences").update({ status: "ignored", resolution_reason: reason, resolved_by: actor.id, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("tenant_id", actor.tenantId).eq("id", id);
      if (error) throw new Error("Não foi possível ignorar a divergência.");
      return NextResponse.json({ ok: true });
    }

    if (action === "guardian_simulate") {
      await assertFeature("campaign_guardian");
      requirePermission(actor, "marketing");
      const input = guardianSchema.parse(body?.input);
      const result = simulateCampaignGuardian(input);
      let campaignRevision = 1;
      if (input.campaignId) {
        const { data: campaign } = await supabase.from("cashback_campaigns").select("published_revision").eq("tenant_id", actor.tenantId).eq("id", input.campaignId).maybeSingle();
        campaignRevision = number(campaign?.published_revision);
      }
      const { data: savedSimulation, error } = await supabase.from("campaign_financial_simulations").insert({
        tenant_id: actor.tenantId, campaign_id: input.campaignId || null, campaign_revision: campaignRevision, calculation_version: "commerce-v2",
        scenario_key: input.scenarioKey, scenario_label: input.scenarioLabel, input, result,
        paid_amount: result.paidProducts, discount_amount: result.discount, cashback_amount: result.cashback,
        cost_amount: result.cost, margin_amount: result.margin, margin_percent: result.marginPercent,
        decision: result.decision, warnings: result.warnings, created_by: actor.id,
      }).select("id").single();
      if (error) throw new Error("Não foi possível salvar a simulação.");
      if (input.campaignId) await supabase.from("cashback_campaigns").update({ guardian_status: result.decision, calculation_version: "commerce-v2", updated_at: new Date().toISOString() }).eq("tenant_id", actor.tenantId).eq("id", input.campaignId);
      return NextResponse.json({ result: { ...result, simulationId: savedSimulation.id } });
    }

    if (action === "guardian_publish") {
      await assertFeature("campaign_guardian");
      requirePermission(actor, "marketing");
      const campaignId = z.string().min(1).max(100).parse(body?.campaignId);
      const simulationId = z.string().uuid().parse(body?.simulationId);
      const reason = z.string().trim().min(5).max(300).parse(body?.reason);
      const { data: simulation, error: simulationError } = await supabase.from("campaign_financial_simulations").select("*")
        .eq("tenant_id", actor.tenantId).eq("campaign_id", campaignId).eq("id", simulationId).maybeSingle();
      if (simulationError || !simulation) throw new Error("Simulação não encontrada.");
      if (simulation.decision === "blocked") throw new Error("Campanhas com margem negativa ou custo incompleto não podem ser publicadas.");
      if (simulation.decision === "warning") {
        requirePermission(actor, "finance");
        const { error: authorizationError } = await supabase.from("campaign_financial_simulations").update({ authorized_by: actor.id, authorization_reason: reason })
          .eq("tenant_id", actor.tenantId).eq("id", simulationId);
        if (authorizationError) throw new Error("Não foi possível registrar a autorização reforçada.");
      }
      const { error } = await supabase.from("cashback_campaigns").update({ status: "active", updated_at: new Date().toISOString() })
        .eq("tenant_id", actor.tenantId).eq("id", campaignId);
      if (error) throw new Error(error.message || "Não foi possível publicar a campanha.");
      return NextResponse.json({ ok: true });
    }

    if (action === "referral_campaign_save") {
      await assertFeature("referral_program");
      requirePermission(actor, "marketing");
      const input = referralCampaignSchema.parse(body?.input);
      const record: Row = { tenant_id: actor.tenantId, name: input.name, status: input.status, starts_at: input.startsAt, ends_at: input.endsAt || null, reward_type: input.rewardType, reward_value: input.rewardValue, reward_cap: input.rewardCap, credit_valid_days: input.creditValidDays, max_rewards_per_referrer: input.maximumPerReferrer, max_rewards_per_month: input.maximumPerMonth, minimum_order_amount: input.minimumOrderAmount, created_by: actor.id, updated_at: new Date().toISOString() };
      if (input.id) record.id = input.id;
      const { error } = await supabase.from("referral_campaigns").upsert(record);
      if (error) throw new Error("Não foi possível salvar a campanha de indicação.");
      return NextResponse.json({ ok: true });
    }

    if (action === "referral_code_save") {
      await assertFeature("referral_program");
      requirePermission(actor, "customers");
      const customerId = z.string().min(1).max(160).parse(body?.customerId);
      const requested = z.string().trim().min(4).max(24).regex(/^[A-Za-z0-9_-]+$/).optional().parse(body?.code || undefined);
      const code = (requested || `JI${randomBytes(4).toString("hex")}`).toUpperCase();
      const { error } = await supabase.from("referral_codes").upsert({ tenant_id: actor.tenantId, customer_id: customerId, code, status: "active", created_by: actor.id, updated_at: new Date().toISOString() }, { onConflict: "tenant_id,customer_id" });
      if (error) throw new Error("Não foi possível criar o código de indicação.");
      return NextResponse.json({ ok: true, code });
    }

    if (action === "referral_bonus_preview") {
      await assertFeature("referral_program");
      requirePermission(actor, "customers"); requirePermission(actor, "finance");
      const customerId = z.string().min(1).max(160).parse(body?.customerId);
      const amount = z.number().positive().max(100000).parse(body?.amount);
      const validDays = z.number().int().min(1).max(730).parse(body?.validDays);
      const { data: customer } = await supabase.from("customers").select("id,name").eq("tenant_id", actor.tenantId).eq("id", customerId).maybeSingle();
      if (!customer) throw new Error("Cliente não encontrado.");
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
      const preview = { customerId, customerName: customer.name, amount, validDays };
      const { data: confirmation, error } = await supabase.from("operational_action_confirmations").insert({
        tenant_id: actor.tenantId, actor_id: actor.id, action: "grant_referral_manual_bonus", entity_type: "customer", entity_id: customerId,
        payload_hash: confirmationHash("grant_referral_manual_bonus", "customer", customerId, actor.id), preview, expires_at: expiresAt,
      }).select("id,preview,expires_at").single();
      if (error) throw new Error("Não foi possível preparar a confirmação do bônus.");
      return NextResponse.json({ confirmation });
    }

    if (action === "referral_bonus_apply") {
      await assertFeature("referral_program");
      requirePermission(actor, "customers"); requirePermission(actor, "finance");
      const customerId = z.string().min(1).max(160).parse(body?.customerId);
      const amount = z.number().positive().max(100000).parse(body?.amount);
      const validDays = z.number().int().min(1).max(730).parse(body?.validDays);
      const confirmationId = z.string().uuid().parse(body?.confirmationId);
      const reason = z.string().trim().min(5).max(300).parse(body?.reason);
      const { data, error } = await supabase.rpc("grant_referral_manual_bonus", {
        p_tenant_id: actor.tenantId, p_customer_id: customerId, p_amount: amount, p_valid_days: validDays,
        p_confirmation_id: confirmationId, p_actor_id: actor.id, p_actor_email: actor.email, p_reason: reason,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, result: data });
    }

    if (action === "bundle_save") {
      await assertFeature("configurable_bundles");
      requirePermission(actor, "catalog");
      const tenantId = actor.tenantId;
      const input = bundleSchema.parse(body?.input);
      const bundleId = input.id || randomUUID();
      const { data, error } = await supabase.rpc("save_product_bundle", {
        p_tenant_id: tenantId,
        p_bundle_id: bundleId,
        p_product_id: input.productId,
        p_name: input.name,
        p_selection_label: input.selectionLabel,
        p_component_count: input.componentCount,
        p_allow_repetition: input.allowRepetition,
        p_max_per_component: input.maxPerComponent,
        p_active: input.active,
        p_option_product_ids: input.optionProductIds,
        p_actor_id: actor.id,
      });
      if (error) throw new Error(error.message || "Não foi possível salvar o kit.");
      return NextResponse.json({ ok: true, result: data });
    }

    if (action === "funnel_cart_update") {
      await assertFeature("conversion_funnel");
      requirePermission(actor, "orders");
      const id = z.string().uuid().parse(body?.id);
      const status = z.enum(["active", "contacted", "snoozed", "dismissed"]).parse(body?.status);
      const reason = z.string().trim().max(300).parse(body?.reason ?? "");
      const delayHours = z.number().int().min(1).max(720).optional().parse(body?.delayHours);
      const { error } = await supabase.rpc("update_cart_recovery_status", { p_tenant_id: actor.tenantId, p_cart_id: id, p_status: status, p_reason: reason, p_delay_hours: delayHours ?? 24, p_actor_id: actor.id });
      if (error) throw new Error("Não foi possível atualizar a oportunidade.");
      return NextResponse.json({ ok: true });
    }

    if (action === "flag_update") {
      requirePermission(actor, "settings");
      const id = z.string().uuid().parse(body?.id); const reason = z.string().trim().min(5).max(300).parse(body?.reason);
      const enabled = z.boolean().parse(body?.enabled); const killSwitch = z.boolean().parse(body?.killSwitch);
      const rollout = z.number().min(0).max(100).parse(body?.rolloutPercentage);
      const { error } = await supabase.from("feature_flags").update({ enabled, kill_switch: killSwitch, rollout_percentage: rollout, reason, updated_by: actor.id, updated_at: new Date().toISOString() }).eq("tenant_id", actor.tenantId).eq("id", id);
      if (error) throw new Error("Não foi possível atualizar a liberação.");
      return NextResponse.json({ ok: true });
    }

    if (action === "mobile_barcode_save") {
      await assertFeature("mobile_operations");
      requirePermission(actor, "inventory");
      const productId = z.string().min(1).max(160).parse(body?.productId); const barcode = z.string().trim().min(4).max(80).parse(body?.barcode);
      const { error } = await supabase.from("product_barcodes").upsert({ tenant_id: actor.tenantId, product_id: productId, barcode, symbology: string(body?.symbology) || "unknown", active: true, created_by: actor.id, updated_at: new Date().toISOString() }, { onConflict: "tenant_id,barcode" });
      if (error) throw new Error("Não foi possível associar o código.");
      return NextResponse.json({ ok: true });
    }

    if (action === "mobile_draft_save") {
      await assertFeature("mobile_operations");
      requirePermission(actor, "dashboard");
      const source = z.enum(["voice", "barcode", "manual", "chatgpt"]).parse(body?.source);
      const intent = z.string().min(1).max(80).parse(body?.intent); const transcript = z.string().max(1000).parse(body?.transcript ?? "");
      const payload = object(body?.payload);
      const { data, error } = await supabase.from("operation_drafts").insert({ tenant_id: actor.tenantId, actor_id: actor.id, source, intent, transcript, payload }).select("id").single();
      if (error) throw new Error("Não foi possível guardar o rascunho.");
      return NextResponse.json({ ok: true, id: data.id });
    }

    if (action === "reversal_preview") {
      await assertFeature("mobile_operations");
      const originalType = z.enum(["inventory_movement", "financial_transaction", "cashback_entry"]).parse(body?.originalType);
      const originalId = z.string().min(1).max(200).parse(body?.originalId);
      requirePermission(actor, originalType === "inventory_movement" ? "inventory" : originalType === "financial_transaction" ? "finance" : "customers");
      const table = originalType === "inventory_movement" ? "inventory_movements" : originalType === "financial_transaction" ? "financial_transactions" : "cashback_entries";
      const { data: original, error } = await supabase.from(table).select("*").eq("tenant_id", actor.tenantId).eq("id", originalId).maybeSingle();
      if (error || !original) throw new Error("Operação original não encontrada.");
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
      const preview = originalType === "inventory_movement" ? { productId: original.product_id, quantity: -number(original.quantity), currentBalance: original.balance_after }
        : originalType === "financial_transaction" ? { amount: original.amount, compensatingType: original.type === "income" ? "expense" : "income" }
          : { amount: original.amount, originalKind: original.kind };
      const { data: confirmation, error: confirmationError } = await supabase.from("operational_action_confirmations").insert({ tenant_id: actor.tenantId, actor_id: actor.id, action: `reverse_${originalType}`, entity_type: originalType, entity_id: originalId, payload_hash: confirmationHash(`reverse_${originalType}`, originalType, originalId, actor.id), preview, expires_at: expiresAt }).select("id,preview,expires_at").single();
      if (confirmationError) throw new Error("Não foi possível preparar a reversão.");
      return NextResponse.json({ confirmation });
    }

    if (action === "reversal_apply") {
      await assertFeature("mobile_operations");
      const originalType = z.enum(["inventory_movement", "financial_transaction", "cashback_entry"]).parse(body?.originalType);
      const originalId = z.string().min(1).max(200).parse(body?.originalId); const confirmationId = z.string().uuid().parse(body?.confirmationId);
      const reason = z.string().trim().min(5).max(300).parse(body?.reason);
      requirePermission(actor, originalType === "inventory_movement" ? "inventory" : originalType === "financial_transaction" ? "finance" : "customers");
      const { data, error } = await supabase.rpc("apply_operational_reversal", { p_tenant_id: actor.tenantId, p_original_type: originalType, p_original_id: originalId, p_confirmation_id: confirmationId, p_actor_id: actor.id, p_actor_email: actor.email, p_reason: reason });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, result: data });
    }

    if (action === "continuity_alert_update") {
      requirePermission(actor, "dashboard");
      const id = z.string().uuid().parse(body?.id); const status = z.enum(["acknowledged", "resolved"]).parse(body?.status);
      const now = new Date().toISOString();
      const update = status === "acknowledged" ? { status, acknowledged_by: actor.id, acknowledged_at: now, updated_at: now } : { status, resolved_by: actor.id, resolved_at: now, updated_at: now };
      const { error } = await supabase.from("operational_alerts").update(update).eq("tenant_id", actor.tenantId).eq("id", id);
      if (error) throw new Error("Não foi possível atualizar o alerta.");
      return NextResponse.json({ ok: true });
    }

    if (action === "continuity_scan") {
      requirePermission(actor, "dashboard");
      return NextResponse.json({ ok: true, result: await runContinuityScan(supabase, actor.tenantId) });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return responseError(error);
  }
}
