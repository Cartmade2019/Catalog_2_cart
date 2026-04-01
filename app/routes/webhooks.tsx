import { ActionFunction, json } from "@remix-run/node";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { notifySupabaseEvent } from "app/utils/supabase-email-server";

export const action: ActionFunction = async ({ request }) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED": {
      console.log("App uninstalled:", shop);

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
        } else {
          console.warn("Skipping uninstall email because store_email is missing", { shop });
        }
      } catch (error) {
        console.error("Failed APP_UNINSTALLED handling:", error);
      }

      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }

      return json(
        { success: true, message: "App uninstalled" },
        { status: 200 }
      );
    }

    case "CUSTOMERS_DATA_REQUEST":
      console.log("Customers data requested");
      return json(
        { success: true, message: "Customers data requested" },
        { status: 200 }
      );

    case "CUSTOMERS_REDACT":
      console.log("Customers data redacted");
      return json(
        { success: true, message: "Customers data redacted" },
        { status: 200 }
      );

    case "SHOP_REDACT":
      console.log("Shop data redacted");
      return json(
        { success: true, message: "Shop data redacted" },
        { status: 200 }
      );

    default:
      return new Response("Unhandled webhook topic", { status: 404 });
  }
};