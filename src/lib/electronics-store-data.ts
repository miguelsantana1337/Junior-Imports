import "server-only";

import { cache } from "react";
import { getStoreData } from "@/lib/store-data";
import { scopeStorefrontData } from "@/lib/storefront-catalog-scope";

export const getElectronicsStoreData = cache(async () =>
  scopeStorefrontData(await getStoreData(), "electronics"));
