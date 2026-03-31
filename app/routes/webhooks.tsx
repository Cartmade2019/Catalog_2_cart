import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { notifySupabaseEvent } from "../utils/supabase-email.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED": {
      try {
        const store_name = payload?.name || shop;
        const store_email = payload?.email || "";
        const configured_domain = payload?.domain || "";
        const store_owner_name = payload?.shop_owner || "";

        if (store_email) {
          await notifySupabaseEvent({
            event_type: "uninstall",
            store_email,
            store_name,
            shopify_domain: shop,
            store_owner_name,
            configured_domain,
          });
        }
      } catch (error) {
        console.error("Failed uninstall webhook handling:", error);
      }

      return json({ ok: true });
    }

    case "CUSTOMERS_DATA_REQUEST":
      return json({ ok: true });

    case "CUSTOMERS_REDACT":
      return json({ ok: true });

    case "SHOP_REDACT":
      return json({ ok: true });

    default:
      return new Response("Unhandled webhook topic", { status: 404 });
  }
};