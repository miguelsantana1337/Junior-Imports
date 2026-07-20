import { describe, expect, it } from "vitest";
import { cloneSeedData } from "@/data/seed";
import { buildAdminNotifications } from "./admin-notifications";

const user = { email: "admin@juniorimports.demo", fullName: "Administrador Demo" };
const now = new Date("2026-07-18T12:00:00.000Z").getTime();

describe("alertas administrativos", () => {
  it("prioriza ruptura de estoque e pedido sem contato", () => {
    const data = cloneSeedData();
    data.products = [{ ...data.products[0], stock: 0, minStock: 10, active: true }];
    data.orders = [{ ...data.orders[0], status: "Novo", createdAt: "2026-07-17T10:00:00.000Z" }];
    data.productLots = [];
    data.customerTasks = [];

    const notifications = buildAdminNotifications(data, user, { now });

    expect(notifications[0]).toMatchObject({ category: "inventory", priority: "critical" });
    expect(notifications.some((item) => item.category === "orders" && item.priority === "critical")).toBe(true);
  });

  it("avisa sobre tarefa, lote e compra próximos do prazo", () => {
    const data = cloneSeedData();
    data.products = data.products.map((product) => ({ ...product, stock: 50, minStock: 5 }));
    data.orders = [];
    data.customerTasks = [{ ...data.customerTasks[0], status: "open", assignedTo: user.email, dueAt: "2026-07-18T18:00:00.000Z" }];
    data.productLots = [{ ...data.productLots[0], status: "available", quantity: 5, expiryDate: "2026-07-28" }];
    data.purchaseOrders = [{ ...data.purchaseOrders[0], status: "ordered", expectedAt: "2026-07-20" }];

    const notifications = buildAdminNotifications(data, user, { now });

    expect(notifications.map((item) => item.category)).toEqual(expect.arrayContaining(["crm", "inventory", "purchasing"]));
  });

  it("inclui falhas de automação, eventos de MFA e saúde de produção", () => {
    const data = cloneSeedData();
    data.products = data.products.map((product) => ({ ...product, stock: 50, minStock: 5 }));
    data.orders = [];
    data.productLots = [];
    data.customerTasks = [];
    data.purchaseOrders = [];
    data.automationRuns = [{ ...data.automationRuns[0], status: "failed", attempt: 3, maxAttempts: 3, errorMessage: "Falha de envio", createdAt: "2026-07-18T11:00:00.000Z" }];
    data.auditLogs = [{ id: "audit-mfa", actorId: "u1", actorEmail: "owner@example.com", action: "delete", entityType: "auth_mfa_factors", entityId: "factor-1", entityLabel: "Celular principal", beforeData: {}, afterData: null, createdAt: "2026-07-18T11:30:00.000Z" }];

    const notifications = buildAdminNotifications(data, user, {
      now,
      health: {
        status: "critical",
        checkedAt: "2026-07-18T11:55:00.000Z",
        environment: "production",
        deploymentId: "prod",
        commitSha: "abc123",
        checks: [{ id: "backup", title: "Backup", status: "critical", summary: "Backup atrasado", detail: "Nenhum backup confirmado." }],
      },
    });

    expect(notifications.some((item) => item.category === "marketing" && item.priority === "critical")).toBe(true);
    expect(notifications.some((item) => item.category === "security" && item.title.includes("MFA"))).toBe(true);
    expect(notifications.some((item) => item.category === "system" && item.title === "Backup atrasado")).toBe(true);
  });

  it("não transforma avisos do ambiente local em incidentes", () => {
    const data = cloneSeedData();
    data.products = [];
    data.orders = [];
    data.productLots = [];
    data.customerTasks = [];
    data.purchaseOrders = [];
    data.cashbackEntries = [];
    data.cashbackCampaigns = [];
    data.automationRuns = [];
    data.marketingPublications = [];
    data.auditLogs = [];

    const notifications = buildAdminNotifications(data, user, {
      now,
      health: {
        status: "warning",
        checkedAt: "2026-07-18T11:55:00.000Z",
        environment: "local",
        deploymentId: "local",
        commitSha: "local",
        checks: [{ id: "backup", title: "Backup", status: "warning", summary: "Modo local", detail: "Sem backup remoto." }],
      },
    });

    expect(notifications).toEqual([]);
  });
});
