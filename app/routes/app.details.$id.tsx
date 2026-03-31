
import { json } from "@remix-run/react";

import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  useLoaderData,
} from "react-router";

import { Link } from "@remix-run/react";


import PageFlip from "../components/PageFlip";

// ── Loader ────────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { authenticate } = await import("../shopify.server");
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
const { admin, session } = await authenticate.admin(request);
const { shop, accessToken } = session;
  const metafieldId = `gid://shopify/Metafield/${id}`;

  const META_FIELD_QUERY = `
  query getMetafield($id: ID!) {
    node(id: $id) {
      ... on Metafield {
        id namespace key value jsonValue type
      }
    }
  }`;

  const GET_BUTTON_SETTINGS_QUERY = `
  query GetButtonSettings {
    shop {
      metafield(namespace: "cartmade", key: "cod_button_settings") {
        id key value jsonValue type updatedAt
      }
    }
  }`;

  const response = await admin.graphql(META_FIELD_QUERY, { variables: { id: metafieldId } });
  const data = await admin.graphql(GET_BUTTON_SETTINGS_QUERY);
  if (!data) return { error: "No data found" };

  const buttonResponse = await data.json();
  if (!buttonResponse.data) return { error: "Failed to fetch button settings metafield." };

  const buttonSettings = buttonResponse?.data?.shop?.metafield;
  const hotspotColor = buttonSettings?.jsonValue?.hotspotColor;


  const axios = (await import("axios")).default;
const { apiVersion } = await import("../shopify.server");

const { data: pricePlan } = await axios.get(
  `https://${shop}/admin/api/${apiVersion}/recurring_application_charges.json`,
  {
    headers: {
      "X-Shopify-Access-Token": accessToken,
    },
  },
);

const activePlan = pricePlan?.recurring_application_charges?.find(
  (charge: any) => charge.status === "active",
);

const planName = activePlan?.name ?? "Free";


  try {
    const { data } = await response.json();
    if (!data) return { error: "Pdf not found." };

    const pdfData = {
      id: data.node.id,
      pdfName: data.node.jsonValue.pdfName,
      images: data.node.jsonValue.images,
    };
    return json({ pdfData, shop, hotspotColor ,planName});
  } catch (error) {
    return { error: "Unexpected error occurred while fetching metafield." };
  }
};

// ── Action ────────────────────────────────────────────────────────────────────
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "POST") {
    const { authenticate } = await import("../shopify.server");
    const { admin, session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const id = Number(url.pathname.split("/").pop());
    const formdata: any = await request.formData();
    const images = formdata.get("images");
    const pdfName = formdata.get("pdfName");

    if (typeof images !== "string") {
      return { error: "Invalid image data. Please upload valid images.", images, pdfName };
    }

    const existingMetafield = await admin.rest.resources.Metafield.find({
  session,
  id,
});

const existingValue =
  typeof existingMetafield.value === "string"
    ? JSON.parse(existingMetafield.value)
    : existingMetafield.value || {};

const metafield = new admin.rest.resources.Metafield({ session });
metafield.id = id;
metafield.value = JSON.stringify({
  ...existingValue,
  pdfName: pdfName || existingValue.pdfName || "Undefined",
  images: JSON.parse(images) || [],
});
metafield.type = "json";
await metafield.save({ update: true });

    if (!metafield) return { error: "Failed to save metafield" };
    return { success: true, message: "metafield updated successfully", metafield };
  }
  return null;
};

// ── UI Component ───────────────────────────────────────────────────────────────
const DetailPage = () => {
  const loaderData: any = useLoaderData();
  const { pdfData } = loaderData;
  if (loaderData?.error) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", border: "1px solid #FCA5A5", borderRadius: 16, padding: "40px 48px", textAlign: "center", maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.75" /><path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Catalog not found</h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 20px", lineHeight: 1.6 }}>{loaderData.error}</p>
          <Link to="/app/pdf-convert" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #1A73E8, #1557b0)", color: "#fff", textDecoration: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 600 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back to catalogs
          </Link>
        </div>
      </div>
    );
  }

  const pageCount = pdfData?.images?.length ?? 0;
  const hotspotTotal = pdfData?.images?.reduce(
    (sum: number, img: any) => sum + (img.points?.length ?? 0),
    0,
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #E8EDF2", padding: "16px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Link to="/app/pdf-convert" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748B", textDecoration: "none", fontWeight: 500, transition: "color 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#1A73E8")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#64748B")}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              PDF Catalogs
            </Link>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="#CBD5E1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontSize: 13, color: "#0F172A", fontWeight: 500 }}>{pdfData?.pdfName || "Catalog Editor"}</span>
          </div>

          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid #BFDBFE" }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#1A73E8" strokeWidth="1.75" strokeLinejoin="round" /><path d="M14 2v6h6" stroke="#1A73E8" strokeWidth="1.75" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 4px", letterSpacing: "-0.01em" }}>{pdfData?.pdfName || "Catalog Editor"}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#1A73E8", background: "#EFF6FF", borderRadius: 20, padding: "2px 10px", border: "1px solid #BFDBFE" }}>
                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                    {pageCount} {pageCount === 1 ? "page" : "pages"}
                  </span>
                  {hotspotTotal > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#15803D", background: "#DCFCE7", borderRadius: 20, padding: "2px 10px", border: "1px solid #BBF7D0" }}>
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" /></svg>
                      {hotspotTotal} hotspot{hotspotTotal !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link to="/app/global-settings" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F8FAFC", color: "#374151", border: "1px solid #E2E8F0", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 500, textDecoration: "none", cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "#9CA3AF")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "#E2E8F0")}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.75" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.75" /></svg>
                Global settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>

        {/* ── TIP BANNER ── */}
        <div style={{ background: "linear-gradient(135deg, #EFF6FF, #F0F9FF)", border: "1px solid #BAE6FD", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(26,115,232,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#1A73E8" strokeWidth="1.75" /><path d="M12 16v-4M12 8h.01" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1E3A5F", margin: "0 0 2px" }}>How to add hotspots</p>
            <p style={{ fontSize: 13, color: "#3B82C4", margin: 0, lineHeight: 1.5 }}>Click anywhere on a catalog page to drop a hotspot pin. Search for a product, save — and your catalog becomes instantly shoppable.</p>
          </div>
        </div>

        {/* ── QUICK STATS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total pages", value: pageCount, color: "#1A73E8", bg: "#EFF6FF" },
            { label: "Tagged hotspots", value: hotspotTotal, color: "#22C55E", bg: "#F0FDF4" },
            { label: "Untagged pages", value: Math.max(0, pageCount - (pdfData?.images?.filter((img: any) => img.points?.length > 0).length ?? 0)), color: "#F59E0B", bg: "#FFFBEB" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#fff", border: "1px solid #E8EDF2", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 500, color: "#0F172A", margin: 0, letterSpacing: "-0.04em" }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── PAGEFLIP EDITOR ── */}
        <div style={{ background: "#ffffff", border: "1px solid #E8EDF2", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(15,23,42,0.06)" }}>
          {/* Editor header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Interactive Catalog Editor</span>
            </div>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Changes save automatically</span>
          </div>

          <PageFlip
            pdfName={pdfData.pdfName}
            images={pdfData.images}
            metaFieldId={pdfData.id}
            shopName={loaderData.shop}
            hotspotColor={loaderData.hotspotColor}
            planName={loaderData.planName}
          />
        </div>

        {/* ── BOTTOM HELP ── */}
        <div style={{ marginTop: 16, padding: "14px 20px", background: "#ffffff", borderRadius: 12, border: "1px solid #E8EDF2", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <kbd style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 5, padding: "2px 7px", fontFamily: "monospace", fontSize: 11, color: "#374151", boxShadow: "0 1px 0 #D1D5DB" }}>Esc</kbd>
              <span style={{ fontSize: 12, color: "#64748B" }}>Deselect hotspot</span>
            </div>
            <div style={{ width: 1, height: 16, background: "#E2E8F0" }} />
            <span style={{ fontSize: 12, color: "#64748B" }}>Click on any page to add a hotspot pin</span>
          </div>
          <Link to="/app/pdf-convert" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B", textDecoration: "none", fontWeight: 500 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#1A73E8")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#64748B")}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back to all catalogs
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DetailPage;