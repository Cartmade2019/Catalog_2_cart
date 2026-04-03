// ─────────────────────────────────────────────────────────────────────────────
// app.installation.tsx — Setup Guide
// Palette: #1A73E8 blue · #0F172A dark · #22C55E green · #F8FAFC bg
// ─────────────────────────────────────────────────────────────────────────────



import { json, type ActionFunctionArgs } from "@remix-run/node";
import { useNavigate, useFetcher } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import { notifySupabaseEvent } from "app/utils/supabase-email-server";
import { getShopData } from "app/utils/shopify-shop-data.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  try {
  
    const formData = await request.formData();

    const subject = String(formData.get("subject") || "").trim();
    const priority = String(formData.get("priority") || "normal").trim();
    const attachment = String(formData.get("attachment_url") || "").trim();
    const message = String(formData.get("message") || "").trim();

    if (!subject) {
      return json({ success: false, error: "Subject is required" }, { status: 400 });
    }

    const shopData = await getShopData(admin, session.shop);

    if (!shopData.store_email || !shopData.store_name || !shopData.shopify_domain) {
      return json(
        { success: false, error: "Missing required shop data" },
        { status: 400 }
      );
    }

    await notifySupabaseEvent({
      event_type: "support",
      ...shopData,
      subject,
      message,
      priority,
      attachment_url: attachment ? [attachment] : [],
      pdf_app: true,
    });

    return json({ success: true, message: "Support request sent successfully" });
  } catch (error: any) {
    console.error("Failed to submit support request:", error);

    return json(
      {
        success: false,
        error: error?.message || "Failed to submit support request",
      },
      { status: 500 }
    );
  }
};
// ─── Icons ───────────────────────────────────────────────────────────────────
const CheckIcon = ({ color = "#22C55E", size = 16 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24">
    <path d="M5 12l5 5L19 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronDown = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowLeft = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
    <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Shared sub-components ────────────────────────────────────────────────────
const StepList = ({ items, dark = false }: { items: string[]; dark?: boolean }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {items.map((text, i) => (
      <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: dark ? "#0F172A" : "#1A73E8", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
          {i + 1}
        </div>
        <p style={{ margin: 0, fontSize: 15, color: "#475569", lineHeight: 1.65 }}>{text}</p>
      </div>
    ))}
  </div>
);

const TipBox = ({ children, variant = "amber" }: { children: React.ReactNode; variant?: "amber" | "blue" | "green" }) => {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    amber: { bg: "#FFFBEB", border: "#FDE68A", color: "#92400E" },
    blue:  { bg: "#EFF6FF", border: "#BFDBFE", color: "#1E3A5F" },
    green: { bg: "#F0FDF4", border: "#BBF7D0", color: "#166534" },
  };
  const s = styles[variant];
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "15px 18px" }}>
      <div style={{ fontSize: 14, color: s.color, lineHeight: 1.65 }}>{children}</div>
    </div>
  );
};

const FeatureGrid = ({ items }: { items: { label: string; desc: string }[] }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    {items.map((item) => (
      <div key={item.label} style={{ background: "#F8FAFC", border: "1px solid #E8EDF2", borderRadius: 9, padding: "14px 16px" }}>
        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{item.label}</p>
        <p style={{ margin: 0, fontSize: 13, color: "#94A3B8", lineHeight: 1.55 }}>{item.desc}</p>
      </div>
    ))}
  </div>
);

// ─── Step data ────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 1,
    label: "Complete",
    title: "Install the app",
    summary: "App installed and authenticated with your store.",
    done: true,
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, margin: 0 }}>
          You've already completed this step. The app is installed and your store credentials are securely stored.
        </p>
        <TipBox variant="green">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckIcon color="#16A34A" size={15} />
            <span>App connected · store credentials secured</span>
          </div>
        </TipBox>
      </div>
    ),
  },
  {
    id: 2,
    label: "Step 1",
    title: "Upload a catalog",
    summary: "Upload a PDF and choose which storefront page will display it.",
    done: false,
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, margin: 0 }}>
          Go to <strong style={{ color: "#0F172A", fontWeight: 600 }}>Catalog listing</strong> in the sidebar. Any PDF works — product lookbooks, seasonal catalogs, brochures.
        </p>
        <StepList items={[
          "Open Catalog listing and click the upload zone, or drag a PDF onto it",
          "Name your catalog, then click Continue",
          "Choose which page of your store should show this catalog — Home, Product, Collection, or a custom page",
          "Confirm the upload and wait for processing (roughly 30 seconds)",
        ]} />
        <TipBox variant="amber">
          <strong>Note:</strong> The page you choose here is used by the <strong>Add to Theme</strong> button — it opens the Theme Editor directly on that page with the block pre-inserted.
        </TipBox>
      </div>
    ),
  },
  {
    id: 3,
    label: "Step 2",
    title: "Add hotspot pins",
    summary: "Tag products directly on your catalog pages.",
    done: false,
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, margin: 0 }}>
          Open any catalog from the listing. The editor loads your PDF pages — click anywhere on a page to place a pin and link it to a product from your store.
        </p>
        <StepList items={[
          "Click any catalog row to open the editor",
          "Click anywhere on a catalog page to drop a hotspot pin",
          "Search for a product by name or SKU in the panel that appears",
          "Select the product — the pin saves automatically",
          "Repeat across as many pages and products as needed",
        ]} />
        <FeatureGrid items={[
          { label: "Move a pin",        desc: "Drag it to a new position on the page" },
          { label: "Remove a pin",      desc: "Double-click the pin, then press delete" },
          { label: "Multiple products", desc: "Each page can have unlimited pins" },
          { label: "Auto-save",         desc: "Changes save immediately — no button needed" },
        ]} />
      </div>
    ),
  },
  {
    id: 4,
    label: "Optional",
    title: "Customise appearance",
    summary: "Adjust pin colors, tooltip style, and button design from Global settings.",
    done: false,
    optional: true,
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, margin: 0 }}>
          Go to <strong style={{ color: "#0F172A", fontWeight: 600 }}>Global settings</strong> to change how pins and tooltips look across all your catalogs. Changes apply immediately — no re-publish needed.
        </p>
        <FeatureGrid items={[
          { label: "Pin color",     desc: "Match your brand palette" },
          { label: "Tooltip style", desc: "Dark, light, or custom background" },
          { label: "Button design", desc: "Label, size, and corner radius" },
          { label: "Animation",     desc: "Pulse, bounce, or none" },
        ]} />
      </div>
    ),
  },
  {
    id: 5,
    label: "Step 3",
    title: "Add to Theme",
    summary: "One click opens the Theme Editor with the catalog block pre-inserted.",
    done: false,
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, margin: 0 }}>
          Once you're done editing, click <strong style={{ color: "#0F172A", fontWeight: 600 }}>Add to Theme</strong> from the catalog editor. This opens the Shopify Theme Editor with the app block already inserted on the page you chose. All you need to do is save.
        </p>

        <StepList dark items={[
          "Open the catalog editor — go to Catalog listing and click any catalog row",
          'Click "Add to Theme" in the header or at the bottom of the editor',
          "The Theme Editor opens with the block already added to the right page — confirm placement",
          "Click Save in the Theme Editor — your catalog is now live",
        ]} />

        <TipBox variant="blue">
          <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: 14 }}>What if I skipped the target page during upload?</p>
          <p style={{ margin: 0, fontSize: 14 }}>
            No problem — clicking <strong>Add to Theme</strong> will show a page picker. Select the page, and the Theme Editor opens with the block already added.
          </p>
        </TipBox>

        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 12px" }}>Advanced — Liquid snippet</p>
          <p style={{ fontSize: 15, color: "#64748B", margin: "0 0 12px", lineHeight: 1.6 }}>
            Prefer manual control? Embed the viewer via a Liquid snippet using the catalog key shown in the Catalog listing.
          </p>
          <div style={{ background: "#0F172A", borderRadius: 9, padding: "16px 20px" }}>
            <code style={{ fontSize: 13, color: "#94A3B8", fontFamily: "'Fira Code', 'Cascadia Code', monospace", lineHeight: 1.7 }}>
              {"{% render 'pdf-catalog', catalog_key: 'YOUR_CATALOG_KEY' %}"}
            </code>
          </div>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: "10px 0 0", lineHeight: 1.5 }}>
            Requires the theme extension to be enabled: Online Store → Themes → Extensions.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 6,
    label: "Final",
    title: "Verify on your storefront",
    summary: "Preview the catalog on your live store before going public.",
    done: false,
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, margin: 0 }}>
          Open your store's live URL and navigate to the page where the catalog is embedded. Run through this checklist before announcing to customers.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "The page-flip viewer loads and pages turn correctly",
            "Hotspot pins are visible and positioned accurately",
            "Clicking a pin shows the product tooltip with price and Add to Cart",
            "Adding a product to cart from the tooltip works",
            "The layout is correct on a mobile screen",
          ].map((text, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 16px", background: "#fff", border: "1px solid #E8EDF2", borderRadius: 9 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#CBD5E1" }} />
              </div>
              <p style={{ margin: 0, fontSize: 15, color: "#475569", lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: "How many catalogs can I upload?",
    a: "The Free plan supports 1 catalog. Basic allows up to 5, and Advanced is unlimited. Manage your plan from the Plans link in the sidebar.",
  },
  {
    q: "What PDF file size is supported?",
    a: "Up to 50 MB per upload on all plans. For best performance, we recommend compressing PDFs above 20 MB before uploading.",
  },
  {
    q: "Does the catalog work on mobile?",
    a: "Yes — the page-flip viewer is fully responsive. On smaller screens, pages switch from a two-page spread to single-page view automatically.",
  },
  {
    q: "Can I change the target page after uploading?",
    a: "Yes. Open the catalog editor and click Add to Theme — a page picker will appear if no target is set, and the selection is saved back to the catalog.",
  },
  {
    q: "Can I edit a catalog after it's live?",
    a: "Hotspot changes are reflected live immediately. To replace the PDF itself, delete the catalog and re-upload.",
  },
  {
    q: "What happens if a linked product is deleted from Shopify?",
    a: "The pin remains visible, but the tooltip will show a 'product unavailable' state. We recommend auditing pins when you remove products.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
const Installation = () => {
  const navigate = useNavigate();
  const [openStep, setOpenStep] = useState<number | null>(2);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportPriority, setSupportPriority] = useState("normal");
  const [supportAttachment, setSupportAttachment] = useState("");
  const [formErrors, setFormErrors] = useState<{ subject?: string; message?: string }>({});

  const SUBJECT_MAX = 60;
  const MESSAGE_MIN = 20;
  const MESSAGE_MAX = 1000;

  const supportFetcher = useFetcher<{ success: boolean; error?: string }>();
  const isSubmitting = supportFetcher.state === "submitting";
  const submitResult = supportFetcher.data;

  // After successful submission: clear fields and auto-dismiss the banner
  const prevStateRef = useRef<string>("idle");
  useEffect(() => {
    if (prevStateRef.current === "submitting" && supportFetcher.state === "idle" && supportFetcher.data?.success) {
      setSupportSubject("");
      setSupportMessage("");
      setSupportPriority("normal");
      setSupportAttachment("");
      setFormErrors({});
      const timer = setTimeout(() => {
        setShowSupportForm(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
    prevStateRef.current = supportFetcher.state;
  }, [supportFetcher.state, supportFetcher.data]);

  const handleSupportSubmit = () => {
    const errors: { subject?: string; message?: string } = {};

    if (!supportSubject.trim()) {
      errors.subject = "Subject is required.";
    } else if (supportSubject.trim().length > SUBJECT_MAX) {
      errors.subject = `Subject must be ${SUBJECT_MAX} characters or fewer.`;
    }

    if (!supportMessage.trim()) {
      errors.message = "Message is required.";
    } else if (supportMessage.trim().length < MESSAGE_MIN) {
      errors.message = `Message must be at least ${MESSAGE_MIN} characters.`;
    } else if (supportMessage.trim().length > MESSAGE_MAX) {
      errors.message = `Message must be ${MESSAGE_MAX} characters or fewer.`;
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const formData = new FormData();
    formData.append("subject", supportSubject);
    formData.append("message", supportMessage);
    formData.append("priority", supportPriority);
    formData.append("attachment_url", supportAttachment);
    supportFetcher.submit(formData, { method: "post" });
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
       @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .accBtn:hover  { background: #F8FAFC !important; }
        .faqBtn:hover  { background: #F8FAFC !important; }
        .ctaBtn:hover  { background: #1557b0 !important; }
        .ghostBtn:hover { border-color: #9CA3AF !important; color: #0F172A !important; }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8EDF2", padding: "32px 48px 36px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          <button
            onClick={() => navigate("/app")}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, padding: 0, marginBottom: 26 }}
          >
            <ArrowLeft />
            Back to Home
          </button>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#1A73E8", letterSpacing: "0.09em", textTransform: "uppercase", margin: "0 0 12px" }}>
                Setup guide
              </p>
              <h1 style={{ fontSize: 30, fontWeight: 700, color: "#0F172A", lineHeight: 1.2, margin: "0 0 12px", letterSpacing: "-0.025em" }}>
                From upload to live in minutes
              </h1>
              <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, margin: 0 }}>
                Upload a PDF, tag products with hotspot pins, and publish directly to your storefront — no manual theme editing required.
              </p>
            </div>

            {/* Progress track */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingTop: 4 }}>
              {[
                { label: "Install app",      done: true  },
                { label: "Upload catalog",   done: false },
                { label: "Add hotspots",     done: false },
                { label: "Add to Theme",     done: false },
                { label: "Verify & go live", done: false },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: s.done ? "#22C55E" : "#E8EDF2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {s.done
                      ? <CheckIcon color="#fff" size={10} />
                      : <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#CBD5E1" }} />
                    }
                  </div>
                  <span style={{ fontSize: 14, color: s.done ? "#16A34A" : "#64748B", fontWeight: s.done ? 600 : 400 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 48px 72px" }}>

        {/* Steps accordion */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STEPS.map((step) => {
            const isOpen = openStep === step.id;
            return (
              <div
                key={step.id}
                style={{
                  background: "#fff",
                  border: `1px solid ${isOpen ? "#BFDBFE" : "#E8EDF2"}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  transition: "border-color 0.18s",
                  boxShadow: isOpen ? "0 2px 20px rgba(15,23,42,0.07)" : "none",
                }}
              >
                <button
                  className="accBtn"
                  onClick={() => setOpenStep(isOpen ? null : step.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", background: "none", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: step.done ? "#F0FDF4" : isOpen ? "#EFF6FF" : "#F8FAFC", border: `1px solid ${step.done ? "#BBF7D0" : isOpen ? "#BFDBFE" : "#E8EDF2"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.18s" }}>
                    {step.done
                      ? <CheckIcon color="#22C55E" size={18} />
                      : <div style={{ width: 9, height: 9, borderRadius: "50%", background: isOpen ? "#1A73E8" : "#CBD5E1" }} />
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>{step.title}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                        color: step.done ? "#16A34A" : (step as any).optional ? "#94A3B8" : "#1A73E8",
                        background: step.done ? "#F0FDF4" : (step as any).optional ? "#F1F5F9" : "#EFF6FF",
                        border: `1px solid ${step.done ? "#BBF7D0" : (step as any).optional ? "#E2E8F0" : "#BFDBFE"}`,
                        borderRadius: 99, padding: "3px 9px",
                      }}>
                        {step.label}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: "#94A3B8" }}>{step.summary}</p>
                  </div>

                  <div style={{ color: "#CBD5E1", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                    <ChevronDown />
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: "4px 24px 28px 82px", animation: "slideDown 0.18s ease both" }}>
                    {step.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── DIVIDER ── */}
        <div style={{ height: 1, background: "#E8EDF2", margin: "40px 0" }} />

        {/* ── SUPPORT STRIP ── */}
        <div style={{ background: "#fff", border: "1px solid #E8EDF2", borderRadius: 12, padding: "22px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Need a hand?</p>
              <p style={{ margin: 0, fontSize: 14, color: "#64748B" }}>Check the FAQ below, or reach out — we typically respond within a few hours.</p>
            </div>
            <button
              className="ghostBtn"
              onClick={() => setShowSupportForm(!showSupportForm)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 9, padding: "10px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", transition: "border-color 0.15s, color 0.15s" }}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              Contact support
            </button>
          </div>

          {showSupportForm && (
            <div style={{ marginTop: 22, paddingTop: 22, borderTop: "1px solid #E8EDF2", display: "flex", flexDirection: "column", gap: 16, animation: "slideDown 0.18s ease both" }}>
              {/* Subject */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    Subject <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <span style={{ fontSize: 12, color: supportSubject.length > SUBJECT_MAX ? "#EF4444" : "#94A3B8" }}>
                    {supportSubject.length}/{SUBJECT_MAX}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Hotspot pins not saving"
                  value={supportSubject}
                  onChange={(e) => {
                    setSupportSubject(e.target.value);
                    if (formErrors.subject) setFormErrors((prev) => ({ ...prev, subject: undefined }));
                  }}
                  style={{
                    fontSize: 14, color: "#0F172A", background: "#F8FAFC",
                    border: `1px solid ${formErrors.subject ? "#EF4444" : "#E2E8F0"}`,
                    borderRadius: 8, padding: "10px 14px", outline: "none", transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = formErrors.subject ? "#EF4444" : "#1A73E8")}
                  onBlur={(e) => (e.target.style.borderColor = formErrors.subject ? "#EF4444" : "#E2E8F0")}
                />
                {formErrors.subject && (
                  <span style={{ fontSize: 12, color: "#EF4444" }}>{formErrors.subject}</span>
                )}
              </div>
<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
      Message <span style={{ color: "#EF4444" }}>*</span>
    </label>
    <span style={{ fontSize: 12, color: supportMessage.length > MESSAGE_MAX ? "#EF4444" : supportMessage.length < MESSAGE_MIN && supportMessage.length > 0 ? "#F59E0B" : "#94A3B8" }}>
      {supportMessage.length}/{MESSAGE_MAX}
      {supportMessage.length > 0 && supportMessage.length < MESSAGE_MIN && (
        <span style={{ marginLeft: 4, color: "#F59E0B" }}>(min {MESSAGE_MIN})</span>
      )}
    </span>
  </div>
  <textarea
    placeholder="Describe the issue you're facing..."
    value={supportMessage}
    onChange={(e) => {
      setSupportMessage(e.target.value);
      if (formErrors.message) setFormErrors((prev) => ({ ...prev, message: undefined }));
    }}
    rows={5}
    style={{
      fontSize: 14,
      color: "#0F172A",
      background: "#F8FAFC",
      border: `1px solid ${formErrors.message ? "#EF4444" : "#E2E8F0"}`,
      borderRadius: 8,
      padding: "10px 14px",
      outline: "none",
      resize: "vertical",
      transition: "border-color 0.15s",
    }}
    onFocus={(e) => (e.target.style.borderColor = formErrors.message ? "#EF4444" : "#1A73E8")}
    onBlur={(e) => (e.target.style.borderColor = formErrors.message ? "#EF4444" : "#E2E8F0")}
  />
  {formErrors.message && (
    <span style={{ fontSize: 12, color: "#EF4444" }}>{formErrors.message}</span>
  )}
</div>
              {/* Priority */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Priority</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["low", "normal", "high", "urgent"] as const).map((level) => {
                    const colors: Record<string, { active: string; border: string; text: string }> = {
                      low:    { active: "#F0FDF4", border: "#22C55E", text: "#16A34A" },
                      normal: { active: "#EFF6FF", border: "#1A73E8", text: "#1A73E8" },
                      high:   { active: "#FFFBEB", border: "#F59E0B", text: "#92400E" },
                      urgent: { active: "#FEF2F2", border: "#EF4444", text: "#B91C1C" },
                    };
                    const c = colors[level];
                    const selected = supportPriority === level;
                    return (
                      <button
                        key={level}
                        onClick={() => setSupportPriority(level)}
                        style={{
                          fontSize: 13, fontWeight: 500, textTransform: "capitalize",
                          padding: "7px 14px", borderRadius: 7, cursor: "pointer",
                          border: `1px solid ${selected ? c.border : "#E2E8F0"}`,
                          background: selected ? c.active : "#fff",
                          color: selected ? c.text : "#64748B",
                          transition: "all 0.15s",
                        }}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Attachment URL */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Attachment URL <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={supportAttachment}
                  onChange={(e) => setSupportAttachment(e.target.value)}
                  style={{ fontSize: 14, color: "#0F172A", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 14px", outline: "none", transition: "border-color 0.15s" }}
                  onFocus={(e) => (e.target.style.borderColor = "#1A73E8")}
                  onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                />
              </div>
{/* Feedback banner */}
{submitResult && (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    padding: "11px 14px", borderRadius: 8,
    background: submitResult.success ? "#F0FDF4" : "#FEF2F2",
    border: `1px solid ${submitResult.success ? "#BBF7D0" : "#FECACA"}`,
    animation: "slideDown 0.18s ease both",
  }}>
    {submitResult.success
      ? <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      : <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#DC2626" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
    }
    <span style={{ fontSize: 13, color: submitResult.success ? "#166534" : "#B91C1C" }}>
      {submitResult.success ? "Support ticket submitted! We'll be in touch shortly." : (submitResult.error ?? "Something went wrong. Please try again.")}
    </span>
  </div>
)}
              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  className="ghostBtn"
                  onClick={() => setShowSupportForm(false)}
                  style={{ fontSize: 14, fontWeight: 500, color: "#64748B", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "9px 18px", cursor: "pointer", transition: "border-color 0.15s" }}
                >
                  Cancel
                </button>
                <button
                  className="ctaBtn"
                  onClick={handleSupportSubmit}
                style={{ fontSize: 14, fontWeight: 500, color: "#fff", background: isSubmitting ? "#6BA8F0" : "#1A73E8", border: "none", borderRadius: 8, padding: "9px 18px", cursor: isSubmitting ? "not-allowed" : "pointer", boxShadow: "0 2px 8px rgba(26,115,232,0.28)", transition: "background 0.15s", display: "inline-flex", alignItems: "center", gap: 7 }}
 >{isSubmitting && (
     <div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
   )}
  {isSubmitting ? "Sending…" : "Submit ticket"}
 </button>
              </div>
            </div>
          )}
        </div>

        {/* ── FAQ ── */}
        <div style={{ marginTop: 44 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#1A73E8", letterSpacing: "0.09em", textTransform: "uppercase", margin: "0 0 8px" }}>FAQ</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: "0 0 20px", letterSpacing: "-0.02em" }}>Common questions</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FAQ.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} style={{ background: "#fff", border: "1px solid #E8EDF2", borderRadius: 11, overflow: "hidden" }}>
                  <button
                    className="faqBtn"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 22px", background: "none", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 500, color: "#0F172A" }}>{item.q}</span>
                    <div style={{ color: "#CBD5E1", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                      <ChevronDown size={16} />
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "0 22px 18px", animation: "slideDown 0.15s ease both" }}>
                      <p style={{ margin: 0, fontSize: 15, color: "#64748B", lineHeight: 1.7 }}>{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ marginTop: 44, background: "#fff", border: "1px solid #E8EDF2", borderRadius: 14, padding: "30px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 5px", letterSpacing: "-0.02em" }}>Ready to get started?</h3>
            <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>Upload your first catalog and go live in under five minutes.</p>
          </div>
          <button
            className="ctaBtn"
            onClick={() => navigate("/app/pdf-convert")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1A73E8", color: "#fff", border: "none", borderRadius: 9, padding: "12px 22px", fontSize: 14, fontWeight: 500, cursor: "pointer", boxShadow: "0 2px 8px rgba(26,115,232,0.28)", transition: "background 0.15s", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
            Upload a catalog
          </button>
        </div>

      </div>
    </div>
  );
};

export default Installation;