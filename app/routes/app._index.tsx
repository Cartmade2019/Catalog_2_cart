// ─────────────────────────────────────────────────────────────────────────────
// app._index.tsx — REDESIGNED
// Hero now has an inline SVG illustration of a shoppable catalog
// Tone: clean, professional, matches existing palette
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from "@remix-run/react";

// ── Inline catalog illustration ───────────────────────────────────────────────
const CatalogIllustration = () => (
  <svg
    viewBox="0 0 480 320"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: "100%", maxWidth: 480, height: "auto" }}
  >
    {/* Outer shadow / bg */}
    <rect x="12" y="12" width="456" height="296" rx="16" fill="#E8EDF2" />
    {/* Card */}
    <rect x="4" y="4" width="456" height="296" rx="16" fill="#fff" stroke="#E8EDF2" strokeWidth="1.5" />

    {/* Left page — catalog spread */}
    <rect x="22" y="22" width="202" height="258" rx="8" fill="#F1F5F9" />
    {/* Page image placeholder — grid */}
    <rect x="30" y="30" width="186" height="116" rx="6" fill="#E2E8F0" />
    {/* Simulated product image blocks */}
    <rect x="36" y="36" width="86" height="98" rx="4" fill="#CBD5E1" />
    <rect x="128" y="36" width="82" height="46" rx="4" fill="#CBD5E1" />
    <rect x="128" y="88" width="38" height="46" rx="4" fill="#CBD5E1" />
    <rect x="172" y="88" width="38" height="46" rx="4" fill="#CBD5E1" />

    {/* Text lines bottom of left page */}
    <rect x="30" y="156" width="120" height="8" rx="3" fill="#E2E8F0" />
    <rect x="30" y="170" width="80" height="6" rx="3" fill="#EEF2F7" />
    <rect x="30" y="186" width="186" height="5" rx="3" fill="#EEF2F7" />
    <rect x="30" y="197" width="160" height="5" rx="3" fill="#EEF2F7" />
    <rect x="30" y="208" width="140" height="5" rx="3" fill="#EEF2F7" />

    {/* ── Hotspot pins on left page ── */}
    {/* Pin 1 — on product image */}
    <circle cx="79" cy="85" r="12" fill="#1A73E8" opacity="0.15" />
    <circle cx="79" cy="85" r="7" fill="#1A73E8" />
    <circle cx="79" cy="85" r="3" fill="#fff" />

    {/* Pin 2 */}
    <circle cx="155" cy="60" r="12" fill="#1A73E8" opacity="0.15" />
    <circle cx="155" cy="60" r="7" fill="#1A73E8" />
    <circle cx="155" cy="60" r="3" fill="#fff" />

    {/* Tooltip for pin 1 */}
    <rect x="90" y="64" width="100" height="42" rx="7" fill="#0F172A" />
    <polygon points="90,80 82,85 90,90" fill="#0F172A" />
    <rect x="98" y="72" width="60" height="6" rx="3" fill="#94A3B8" />
    <rect x="98" y="83" width="44" height="6" rx="3" fill="#fff" />
    <rect x="98" y="94" width="76" height="8" rx="3" fill="#1A73E8" />

    {/* Divider between pages */}
    <rect x="232" y="22" width="2" height="258" rx="1" fill="#E2E8F0" />

    {/* Right page */}
    <rect x="240" y="22" width="216" height="258" rx="8" fill="#F8FAFC" />
    {/* Right page content — product grid */}
    <rect x="250" y="30" width="96" height="118" rx="6" fill="#E2E8F0" />
    <rect x="352" y="30" width="96" height="56" rx="6" fill="#E2E8F0" />
    <rect x="352" y="92" width="96" height="56" rx="6" fill="#E2E8F0" />

    {/* Product card below */}
    <rect x="250" y="156" width="198" height="72" rx="8" fill="#fff" stroke="#E8EDF2" strokeWidth="1" />
    <rect x="260" y="166" width="44" height="52" rx="5" fill="#EEF2F7" />
    <rect x="312" y="168" width="80" height="7" rx="3" fill="#E2E8F0" />
    <rect x="312" y="181" width="56" height="6" rx="3" fill="#EEF2F7" />
    <rect x="312" y="195" width="40" height="6" rx="3" fill="#BFDBFE" />
    <rect x="312" y="208" width="72" height="12" rx="5" fill="#1A73E8" />

    {/* "Add to cart" label on button */}
    <rect x="322" y="212" width="52" height="4" rx="2" fill="#fff" opacity="0.8" />

    {/* Pin on right page */}
    <circle cx="298" cy="68" r="12" fill="#22C55E" opacity="0.18" />
    <circle cx="298" cy="68" r="7" fill="#22C55E" />
    <circle cx="298" cy="68" r="3" fill="#fff" />

    {/* Right text lines */}
    <rect x="250" y="240" width="120" height="7" rx="3" fill="#E2E8F0" />
    <rect x="250" y="253" width="80" height="5" rx="3" fill="#EEF2F7" />
    <rect x="250" y="264" width="198" height="5" rx="3" fill="#EEF2F7" />

    {/* Page numbers */}
    <rect x="100" y="268" width="24" height="6" rx="3" fill="#E2E8F0" />
    <rect x="344" y="268" width="24" height="6" rx="3" fill="#E2E8F0" />
  </svg>
);

// ── Step cards ────────────────────────────────────────────────────────────────
const steps = [
  {
    number: "01",
    title: "Upload your catalog",
    description: "Drag and drop any PDF — product lookbooks, seasonal catalogs, brochures. We handle the rest.",
    color: "#EFF6FF",
    accent: "#1A73E8",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path d="M12 15V4M12 4l-4 4M12 4l4 4" stroke="#1A73E8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" stroke="#1A73E8" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Tag your products",
    description: "Click anywhere on a page to drop a hotspot pin. Search your Shopify store and link the exact product.",
    color: "#F0FDF4",
    accent: "#22C55E",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" stroke="#22C55E" strokeWidth="1.75" />
        <circle cx="12" cy="12" r="8" stroke="#22C55E" strokeWidth="1.75" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Publish to your store",
    description: "Copy your catalog key, paste it into the theme block, and go live in seconds.",
    color: "#FFF7ED",
    accent: "#F59E0B",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path d="M5 12l5 5L19 7" stroke="#F59E0B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const features = [
  {
    title: "Page-flip experience",
    description: "Your catalog opens like a real book — smooth page turns that keep shoppers engaged.",
    accent: "#1A73E8",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
  {
    title: "Hotspot product pins",
    description: "Clickable pins sit directly on products. Customers see pricing and add to cart without leaving the page.",
    accent: "#22C55E",
    bg: "#F0FDF4",
    border: "#BBF7D0",
  },
  {
    title: "Fully customisable",
    description: "Control hotspot colors, button styles, tooltip design, and animation type from global settings.",
    accent: "#F59E0B",
    bg: "#FFFBEB",
    border: "#FDE68A",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
const Index = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .heroBtn:hover { background: #1557b0 !important; }
        .ghostBtn:hover { border-color: #9CA3AF !important; color: #0F172A !important; }
        .stepCard:hover { border-color: #CBD5E1 !important; box-shadow: 0 4px 16px rgba(15,23,42,0.06) !important; }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8EDF2", padding: "48px 48px 0" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "flex-end" }}>
          {/* Left — text */}
          <div style={{ paddingBottom: 48, animation: "fadeUp 0.5s ease both" }}>
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 99, padding: "4px 12px", marginBottom: 22 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1A73E8", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: "#1A73E8", fontWeight: 500, letterSpacing: "0.02em" }}>Shopify App — Shoppable PDF Catalogs</span>
            </div>

            <h1 style={{ fontSize: 36, fontWeight: 700, color: "#0F172A", lineHeight: 1.2, margin: "0 0 14px", letterSpacing: "-0.03em" }}>
              Turn your PDF catalogs into{" "}
              <span style={{ color: "#1A73E8" }}>shoppable experiences</span>
            </h1>

            <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, maxWidth: 440, margin: "0 0 30px" }}>
              Upload any product catalog. Tag items with hotspot pins. Embed a beautiful page-flip viewer — customers browse and buy without ever leaving.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="heroBtn"
                onClick={() => navigate("/app/pdf-convert")}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#1A73E8", color: "#fff", border: "none", borderRadius: 9, padding: "12px 22px", fontSize: 14, fontWeight: 500, cursor: "pointer", boxShadow: "0 2px 8px rgba(26,115,232,0.3)", transition: "background 0.15s", letterSpacing: "-0.01em" }}
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
                Upload your first catalog
              </button>
              <button
                className="ghostBtn"
                onClick={() => navigate("/app/global-settings")}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 9, padding: "12px 20px", fontSize: 14, fontWeight: 400, cursor: "pointer", transition: "border-color 0.15s, color 0.15s", letterSpacing: "-0.01em" }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.75" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.75" /></svg>
                Global settings
              </button>
            </div>
          </div>

          {/* Right — illustration */}
          <div style={{ paddingBottom: 0, animation: "fadeUp 0.5s ease 0.1s both", alignSelf: "flex-end" }}>
            <CatalogIllustration />
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ padding: "52px 48px 0", maxWidth: 1008, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1A73E8", letterSpacing: "0.1em", textTransform: "uppercase" }}>How it works</span>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: "6px 0 0", letterSpacing: "-0.02em" }}>Three steps to a shoppable catalog</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {steps.map((step) => (
            <div
              key={step.number}
              className="stepCard"
              style={{ background: "#fff", border: "1px solid #E8EDF2", borderRadius: 12, padding: "24px 22px", position: "relative", transition: "border-color 0.15s, box-shadow 0.15s" }}
            >
              <span style={{ position: "absolute", top: 18, right: 20, fontSize: 11, fontWeight: 600, color: "#CBD5E1", letterSpacing: "0.04em" }}>{step.number}</span>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: step.color, border: `1px solid ${step.border ?? step.color}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                {step.icon}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", margin: "0 0 6px" }}>{step.title}</h3>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.65, margin: 0 }}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div style={{ padding: "44px 48px 0", maxWidth: 1008, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1A73E8", letterSpacing: "0.1em", textTransform: "uppercase" }}>Features</span>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: "6px 0 0", letterSpacing: "-0.02em" }}>Everything you need</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {features.map((f) => (
            <div
              key={f.title}
              style={{ background: f.bg, border: `1px solid ${f.border}`, borderRadius: 12, padding: "22px 20px" }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: f.accent, marginBottom: 12 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", margin: "0 0 6px" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.65, margin: 0 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA BANNER ── */}
      <div style={{ padding: "44px 48px 60px", maxWidth: 1008, margin: "0 auto" }}>
        <div style={{ background: "#fff", border: "1px solid #E8EDF2", borderRadius: 14, padding: "32px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Ready to get started?</h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>Upload your first catalog and see it live in your store within minutes.</p>
          </div>
          <button
            className="heroBtn"
            onClick={() => navigate("/app/pdf-convert")}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#1A73E8", color: "#fff", border: "none", borderRadius: 9, padding: "11px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(26,115,232,0.28)", transition: "background 0.15s", letterSpacing: "-0.01em" }}
          >
            View my catalogs
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;