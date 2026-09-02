import type { Metadata } from "next";
import { ElectronicsScreen } from "@/components/store/electronics-screen";

export const metadata: Metadata = {
  title: "Eletrônicos",
  description: "Tecnologia Apple e eletrônicos selecionados pela Junior Imports.",
};

export default function HomePage() {
  return <ElectronicsScreen />;
}
