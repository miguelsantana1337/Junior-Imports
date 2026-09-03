import { Plus } from "lucide-react";

export function ElectronicsBlueprintCorners() {
  return <span className="electronics-blueprint-corners" aria-hidden="true">
    {(["tl", "tr", "bl", "br"] as const).map((corner) => <Plus key={corner} className={`corner ${corner}`} strokeWidth={1} />)}
  </span>;
}
