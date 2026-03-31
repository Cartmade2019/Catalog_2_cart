import { ActionFunction, json } from "@remix-run/node";

import db from "../db.server";
import { authenticate } from "../shopify.server";

export const action: ActionFunction = async ({ request }) => {
  const { topic, shop, session } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED":
      console.log("App uninstalled");
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }
      return json(
        { success: true, message: "App unistalled" },
        { status: 200 },
      );

    case "CUSTOMERS_DATA_REQUEST":
      console.log("Customers data requested");
      return json(
        { success: true, message: "Customers data requested" },
        { status: 200 },
      );
    case "CUSTOMERS_REDACT":
      console.log("Customers data redacted");
      return json(
        { success: true, message: "Customers data redacted" },
        { status: 200 },
      );
    case "SHOP_REDACT":
      console.log("Shop data redacted");
      return json(
        { success: true, message: "Shop data redacted" },
        { status: 200 },
      );

    // Add more webhook event handlers as needed...
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

};
