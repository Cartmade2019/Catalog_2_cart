type SupabaseEventPayload = {
    event_type: "install" | "uninstall" | "reinstall";
    store_email: string;
    store_name: string;
    shopify_domain: string;
    store_owner_name?: string;
    configured_domain?: string;
  };
  
  export async function notifySupabaseEvent(payload: SupabaseEventPayload) {
    const url = process.env.SHOPIFY_WEBHOOK_URL;
  
    if (!url) {
      throw new Error("Missing SHOPIFY_WEBHOOK_URL");
    }
  
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  
    const data = await response.json().catch(() => null);
  
    if (!response.ok) {
      throw new Error(
        `Supabase function failed: ${response.status} ${response.statusText} ${JSON.stringify(data)}`
      );
    }
  
    return data;
  }