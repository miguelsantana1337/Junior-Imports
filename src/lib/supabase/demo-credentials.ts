import "server-only";

import { platformConfig } from "@/config/platform";

export const demoAdminCredentials = {
  email:
    process.env.DEMO_ADMIN_EMAIL?.trim()
    || platformConfig.demoAdmin.email,
  password:
    process.env.DEMO_ADMIN_PASSWORD?.trim()
    || "junior123",
  fullName:
    process.env.DEMO_ADMIN_NAME?.trim()
    || platformConfig.demoAdmin.fullName,
};
