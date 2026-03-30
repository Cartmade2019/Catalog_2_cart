// ─────────────────────────────────────────────────────────────────────────────
// app.global-settings.tsx — REDESIGNED
// Palette: #1A73E8 (primary), #0F172A (dark), #F8FAFC (bg), #22C55E (green)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from "react";
import { buttonsName } from "../config/config";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { apiVersion, authenticate } from "../shopify.server";
import {Link} from "@remix-run/react";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { accessToken, shop }: any = session;

  if (request.method === "POST") {
    const formData = await request.formData();
    const source = formData.get("source");

    if (source === "ButtonDesign") {
      const buttonText = formData.get("buttonText") as string;
      const fontSize = formData.get("fontSize") as string;
      const borderRadius = formData.get("borderRadius") as string;
      const borderWidth = formData.get("borderWidth") as string;
      const borderColor = formData.get("borderColor") as string;
      const backgroundColor = formData.get("backgroundColor") as string;
      const textColor = formData.get("textColor") as string;
      const paddingX = formData.get("paddingX") as string;
      const paddingY = formData.get("paddingY") as string;
      const shadow = formData.get("shadow") as string;
      const hotspotColor = formData.get("hotspotColor") as string;
      const shadowColor = formData.get("shadowColor") as string;

      const metafieldData = {
        namespace: "cartmade",
        key: "cod_button_settings",
        value: JSON.stringify({
          buttonText, fontSize: parseInt(fontSize), borderRadius: parseInt(borderRadius),
          borderWidth: parseInt(borderWidth), paddingX: parseInt(paddingX), paddingY: parseInt(paddingY),
          shadow: parseInt(shadow), shadowColor, borderColor, hotspotColor, backgroundColor, textColor,
        }),
        type: "json",
        owner_resource: "shop",
      };

      const response = await fetch(`https://${shop}/admin/api/${apiVersion}/metafields.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({ metafield: metafieldData }),
      });

      const responseData = await response.json();
      if (!response.ok) return json({ error: responseData.errors || "Failed to save metafield" }, { status: response.status });
      return json({ message: "Public metafield saved successfully", data: responseData });

    } else if (source === "TooltipSettings") {
      const backgroundColor = formData.get("backgroundColor");
      const fontColor = formData.get("fontColor");
      const priceColor = formData.get("priceColor");

      const metafieldData = {
        namespace: "cartmade",
        key: "cod_tooltip_settings",
        value: JSON.stringify({ backgroundColor, fontColor, priceColor }),
        type: "json",
        owner_resource: "shop",
      };

      const response = await fetch(`https://${shop}/admin/api/${apiVersion}/metafields.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({ metafield: metafieldData }),
      });

      const responseData = await response.json();
      if (!response.ok) return json({ error: responseData.errors || "Failed to save metafield" }, { status: response.status });
      return json({ message: "Public metafield saved successfully", data: responseData });
     } else if (source === "AppStatus") {
      const isEnabled = formData.get("isEnabled") === "true";

      const metafieldData = {
        namespace: "cartmade",
        key: "catalog2cart",
        value: JSON.stringify({ isEnabled }),
        type: "json",
        owner_resource: "shop",
      };

      const response = await fetch(`https://${shop}/admin/api/${apiVersion}/metafields.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ metafield: metafieldData }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return json(
          { error: responseData.errors || "Failed to save app status metafield" },
          { status: response.status },
        );
      }

      return json({ message: "App status saved successfully", data: responseData });
    
    }
    

  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const fetchMetafield = async (namespace: string, key: string) => {
    const query = `query GetMetafield { shop { metafield(namespace: "${namespace}", key: "${key}") { id key value jsonValue type updatedAt } } }`;
    try {
      const response = await admin.graphql(query);
      const data = await response.json();
      return data?.data?.shop?.metafield || null;
    } catch (error) {
      console.error(`Error fetching metafield (${key}):`, error);
      return null;
    }
  };

  try {
  const [buttonSettings, tooltipSettings, appStatusSettings] = await Promise.all([
  fetchMetafield("cartmade", "cod_button_settings"),
  fetchMetafield("cartmade", "cod_tooltip_settings"),
  fetchMetafield("cartmade", "catalog2cart"),
]);
return { buttonSettings, tooltipSettings, appStatusSettings };
  } catch (error) {
    return { error: "Unexpected error occurred while fetching metafields." };
  }
};

// ── TAB DEFINITIONS ───────────────────────────────────────────────────────────
const tabIcons: Record<string, JSX.Element> = {
  app: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
  buttonDesign: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
      <rect x="2" y="7" width="20" height="10" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 12h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  tooltipDesign: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  ),
  animationType: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
      <path d="M5 12a7 7 0 1014 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 5V2M12 5l-2-2M12 5l2-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const GlobalSettings = () => {
  const [activeButton, setActiveButton] = useState<string>("app");
  const loaderData = useLoaderData<any>();

  const handleButtonClick = useCallback(
    (link: string) => { if (activeButton === link) return; setActiveButton(link); },
    [activeButton],
  );

  const toggleAppStatus = async () => {
  const newValue = !enabled;
  setEnabled(newValue);

  const formData = new FormData();
  formData.append("source", "AppStatus");
  formData.append("isEnabled", String(newValue));

  await fetch(window.location.pathname, {
    method: "POST",
    body: formData,
  });
};

  const buttonSettings = loaderData?.buttonSettings || {};
  const tooltipSettings = loaderData?.tooltipSettings || {};
const appStatusSettings = loaderData?.appStatusSettings || {};
const [enabled, setEnabled] = useState(
  appStatusSettings?.jsonValue?.isEnabled ?? true,
);
  const ActiveComponent = buttonsName.find(({ link }) => link === activeButton)?.component;

  const tabDescriptions: Record<string, string> = {
    app: "Overview and quick actions for your catalog setup",
    buttonDesign: "Customize the Add to Cart button appearance and hotspot style",
    tooltipDesign: "Style the product tooltip that appears when hovering a hotspot",
    animationType: "Choose the page-flip animation for your catalog viewer",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #E8EDF2", padding: "20px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 2px", letterSpacing: "-0.01em" }}>Global Settings</h1>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>Customize the look and feel of your shoppable catalog experience</p>
          </div>
          <Link to="/app/pdf-convert" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748B", textDecoration: "none", fontWeight: 500, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 9, padding: "9px 14px", transition: "border-color 0.15s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "#9CA3AF")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "#E2E8F0")}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            My Catalogs
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>

          {/* ── SIDEBAR TABS ── */}
          <div style={{ background: "#ffffff", border: "1px solid #E8EDF2", borderRadius: 14, overflow: "hidden", position: "sticky", top: 24 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>Settings sections</p>
            </div>
            <div style={{ padding: "8px" }}>
              {buttonsName && buttonsName.length && buttonsName.map(({ index, name, link }) => {
                const isActive = link === activeButton;
                return (
                  <button
                    key={index}
                    onClick={() => handleButtonClick(link)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s",
                      background: isActive ? "linear-gradient(135deg, #EFF6FF, #DBEAFE)" : "transparent",
                      color: isActive ? "#1A73E8" : "#374151",
                      fontWeight: isActive ? 600 : 400,
                      fontSize: 14,
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <span style={{ color: isActive ? "#1A73E8" : "#94A3B8", flexShrink: 0, transition: "color 0.15s" }}>
                      {tabIcons[link] || tabIcons.app}
                    </span>
                    {name}
                    {isActive && (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ marginLeft: "auto" }}>
                        <path d="M9 18l6-6-6-6" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Help box */}
            <div style={{ margin: "8px", padding: "14px", background: "linear-gradient(135deg, #F8FAFC, #F1F5F9)", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>Need help?</p>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 10px", lineHeight: 1.5 }}>Changes apply globally across all your catalogs.</p>
              <a href="#" style={{ fontSize: 12, color: "#1A73E8", textDecoration: "none", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
                View docs
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </div>
          </div>

          {/* ── CONTENT PANEL ── */}
          <div>
            {/* Section header */}
            <div style={{ background: "#ffffff", border: "1px solid #E8EDF2", borderRadius: 14, padding: "18px 22px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#1A73E8" }}>
                {tabIcons[activeButton] || tabIcons.app}
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 2px", letterSpacing: "-0.01em" }}>
                  {buttonsName.find(({ link }) => link === activeButton)?.name || "Settings"}
                </h2>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
                  {tabDescriptions[activeButton] || "Configure your catalog settings"}
                </p>
              </div>
            </div>

            {/* Active settings component */}
          <div style={{ background: "#ffffff", border: "1px solid #E8EDF2", borderRadius: 14, overflow: "hidden" }}>
  <div style={{ padding: "22px" }}>
    {activeButton === "app" && (
      <div
        style={{
          marginBottom: 20,
          padding: "18px 20px",
          border: "1px solid #E8EDF2",
          borderRadius: 12,
          background: "#F8FAFC",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0F172A",
                margin: "0 0 4px",
              }}
            >
              App Status
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
              {enabled
                ? "Catalog to Cart is currently enabled for your store."
                : "Catalog to Cart is currently disabled for your store."}
            </p>
          </div>

          <button
            onClick={toggleAppStatus}
            style={{
              background: enabled ? "#DC2626" : "#1A73E8",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {enabled ? "Disable App" : "Enable App"}
          </button>
        </div>
      </div>
    )}

    {ActiveComponent && (
      <ActiveComponent
        {...(activeButton === "buttonDesign" || activeButton === "tooltipDesign"
          ? { buttonSettings, tooltipSettings }
          : {})}
      />
    )}
  </div>
</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;