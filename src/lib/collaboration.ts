export type CollaborationEntityType = "general" | "product" | "customer" | "order" | "publication" | "report" | "purchase";
export type CollaborationPriority = "normal" | "high" | "urgent";

export interface CollaborationThread {
  id: string;
  title: string;
  entityType: CollaborationEntityType;
  entityId: string;
  entityLabel: string;
  status: "open" | "resolved" | "archived";
  priority: CollaborationPriority;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationComment {
  id: string;
  threadId: string;
  body: string;
  mentions: string[];
  actorEmail: string;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  threadId: string;
  entityType: Exclude<CollaborationEntityType, "general">;
  entityId: string;
  entityLabel: string;
  requestNote: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedByEmail: string;
  reviewerEmail: string;
  decisionNote: string;
  dueAt: string;
  createdAt: string;
  decidedAt: string;
  updatedAt: string;
}

export interface TeamPresence {
  userId: string;
  email: string;
  fullName: string;
  route: string;
  entityType: string;
  entityId: string;
  lastSeenAt: string;
}

type Row = Record<string, unknown>;
const str = (value: unknown) => String(value ?? "");

export function parseMentions(body: string) {
  return [...new Set(Array.from(body.matchAll(/@([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[a-z0-9._-]{2,})/gi), (match) => match[1].toLowerCase()))];
}

export function isPresenceOnline(lastSeenAt: string, now = new Date()) {
  const seen = new Date(lastSeenAt).getTime();
  return Number.isFinite(seen) && now.getTime() - seen <= 90_000;
}

export function mapCollaborationThread(row: Row): CollaborationThread {
  return { id: str(row.id), title: str(row.title), entityType: str(row.entity_type) as CollaborationEntityType, entityId: str(row.entity_id), entityLabel: str(row.entity_label), status: str(row.status) as CollaborationThread["status"], priority: str(row.priority) as CollaborationPriority, createdByEmail: str(row.created_by_email), createdAt: str(row.created_at), updatedAt: str(row.updated_at) };
}

export function mapCollaborationComment(row: Row): CollaborationComment {
  return { id: str(row.id), threadId: str(row.thread_id), body: str(row.body), mentions: Array.isArray(row.mentions) ? row.mentions.map(str) : [], actorEmail: str(row.actor_email), createdAt: str(row.created_at) };
}

export function mapApprovalRequest(row: Row): ApprovalRequest {
  return { id: str(row.id), threadId: str(row.thread_id), entityType: str(row.entity_type) as ApprovalRequest["entityType"], entityId: str(row.entity_id), entityLabel: str(row.entity_label), requestNote: str(row.request_note), status: str(row.status) as ApprovalRequest["status"], requestedByEmail: str(row.requested_by_email), reviewerEmail: str(row.reviewer_email), decisionNote: str(row.decision_note), dueAt: str(row.due_at), createdAt: str(row.created_at), decidedAt: str(row.decided_at), updatedAt: str(row.updated_at) };
}

export function mapTeamPresence(row: Row): TeamPresence {
  return { userId: str(row.user_id), email: str(row.email), fullName: str(row.full_name), route: str(row.route), entityType: str(row.entity_type), entityId: str(row.entity_id), lastSeenAt: str(row.last_seen_at) };
}

export const collaborationEntityLabels: Record<CollaborationEntityType, string> = {
  general: "Assunto geral",
  product: "Produto",
  customer: "Cliente",
  order: "Pedido",
  publication: "Publicação",
  report: "Relatório",
  purchase: "Compra",
};

