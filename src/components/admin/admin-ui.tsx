import type { ReactNode } from "react";

export function AdminPanel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="admin-panel"><header className="admin-panel-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>{children}</section>;
}

export function StatusTag({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className={`status-tag ${active ? "" : "off"}`}>{children}</span>;
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}
