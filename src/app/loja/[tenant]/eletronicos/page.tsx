import type { Metadata } from "next";
import { ElectronicsScreen } from "@/components/store/electronics-screen";

export const metadata: Metadata = {
  title: "Eletrônicos",
  description: "Vitrine exclusiva de eletrônicos da Junior Imports.",
};

export default function TenantElectronicsPage() {
  return <ElectronicsScreen />;
}
