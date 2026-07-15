"use client";

import { platformConfig } from "@/config/platform";
import { useStore } from "@/components/providers/store-provider";

export function StoreModeNotice() {
  const { data } = useStore();
  return (
    <div className="demo-notice">
      {data.settings.checkoutMode === "whatsapp"
        ? "PEDIDOS FINALIZADOS PELO WHATSAPP · PAGAMENTO E ENTREGA COMBINADOS DIRETAMENTE COM A LOJA"
        : platformConfig.demoNotice}
    </div>
  );
}
