import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

import prisma from "./db.server";

import { notifySupabaseEvent } from "./utils/supabase-email-server";
import { getShopData } from "./utils/shopify-shop-data.server";
import { getInstallState, setInstallState } from "./utils/install-state-metafield.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  restResources,
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      await shopify.registerWebhooks({ session });

      try {
        const shopData = await getShopData(admin, session.shop);
        const installState = await getInstallState(admin);

        const event_type =
          installState?.installed_once === true ? "reinstall" : "install";

        if (!shopData.store_email) {
          console.warn("Skipping install/reinstall email because store email is missing", {
            shop: session.shop,
          });
          return;
        }

        await notifySupabaseEvent({
          event_type,
          ...shopData,
        });

        await setInstallState(admin, {
          installed_once: true,
          last_event: event_type,
          last_installed_at: new Date().toISOString(),
          ...shopData,
        });
      } catch (error) {
        console.error("Failed post-auth install/reinstall flow:", error);
      }
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    wip_optionalScopesApi: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;