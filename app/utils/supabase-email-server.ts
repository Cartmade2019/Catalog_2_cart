type SupabaseEventPayload = {
  event_type: "install" | "uninstall" | "reinstall"|"support";
  store_email: string;
  store_name: string;
  shopify_domain: string;
  store_owner_name?: string;
  configured_domain?: string;
  subject?: string;
  message?: string;
  priority?: string;
  attachment_url?:string[];
  pdf_app?:boolean;
};

export async function notifySupabaseEvent(payload: SupabaseEventPayload) {
  const url = process.env.SUPABASE_FUNCTION_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url) {
    throw new Error("Missing SHOPIFY_WEBHOOK_URL");
  }

  if (!anonKey) {
    throw new Error("Missing SUPABASE_ANON_KEY");
  }

 const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`,
      "apikey": anonKey,
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