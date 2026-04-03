// ─────────────────────────────────────────────────────────────────────────────
// app.details.$id.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { json } from "@remix-run/node";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import PageFlip from "../components/PageFlip";

// ── Loader ────────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { authenticate, apiVersion } = await import("../shopify.server");
  const axios = (await import("axios")).default;
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const { admin, session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  const metafieldId = `gid://shopify/Metafield/${id}`;

  const META_FIELD_QUERY = `
    query getMetafield($id: ID!) {
      node(id: $id) {
        ... on Metafield { id namespace key value jsonValue type }
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

  const [metaRes, buttonRes] = await Promise.all([
    admin.graphql(META_FIELD_QUERY, { variables: { id: metafieldId } }),
    admin.graphql(GET_BUTTON_SETTINGS_QUERY),
  ]);

  const buttonResponse = await buttonRes.json();
  const buttonSettings = buttonResponse?.data?.shop?.metafield;
  const hotspotColor = buttonSettings?.jsonValue?.hotspotColor;

  let activeThemeId: string | null = null;
  try {
    const themesRes = await axios.get(
      `https://${shop}/admin/api/${apiVersion}/themes.json?role=main`,
      { headers: { "X-Shopify-Access-Token": accessToken } },
    );
    activeThemeId = themesRes.data?.themes?.[0]?.id?.toString() ?? null;
  } catch {}

  const { data: pricePlan } = await axios.get(
    `https://${shop}/admin/api/${apiVersion}/recurring_application_charges.json`,
    { headers: { "X-Shopify-Access-Token": accessToken } },
  );
  const activePlan = pricePlan?.recurring_application_charges?.find((c: any) => c.status === "active");
  const planName = activePlan?.name ?? "Free";

  try {
    const { data } = await metaRes.json();
    if (!data) return json({ error: "Pdf not found." });

    const node = data.node;
    const pdfData = {
      id: node.id,
      pdfName: node.jsonValue.pdfName,
      images: node.jsonValue.images,
      targetPage: node.jsonValue?.targetPage ?? "none",
      targetPageHandle: node.jsonValue?.targetPageHandle ?? "",
      targetPageLabel: node.jsonValue?.targetPageLabel ?? "",
      key: node.key,
      coverImage: node.jsonValue?.coverImage ?? null,
      pageFormat: node.jsonValue?.pageFormat ?? "A4",
    };

    const appBlockHandle = process.env.SHOPIFY_APP_BLOCK_HANDLE ?? "bd4502bb29e6f7490f7fd7773bc0984c/pdf-converter";
    return json({ pdfData, shop, hotspotColor, planName, activeThemeId, appBlockHandle });
  } catch {
    return json({ error: "Unexpected error occurred while fetching metafield." });
  }
};

// ── Action ────────────────────────────────────────────────────────────────────
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "POST") {
    const { authenticate, apiVersion } = await import("../shopify.server");
    const { admin, session } = await authenticate.admin(request);
    const { shop, accessToken } = session;
    const url = new URL(request.url);
    const id = Number(url.pathname.split("/").pop());

    const contentType = request.headers.get("content-type") ?? "";

    // ── Cover image upload (multipart) ──────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const { unstable_parseMultipartFormData, unstable_createFileUploadHandler, unstable_createMemoryUploadHandler, unstable_composeUploadHandlers } = await import("@remix-run/node");
      const path = await import("path");
      const fs = await import("fs");
      const axios = (await import("axios")).default;
      const { uploadImage, pollFileStatus } = await import("../utils/utils");

      const uploadDir = path.join(process.cwd(), "public", "uploads");
      fs.mkdirSync(uploadDir, { recursive: true });
      let savedFilename = "";
      const fileUploadHandler = unstable_createFileUploadHandler({
        directory: uploadDir,
        maxPartSize: 10_000_000,
        file: ({ filename }) => { savedFilename = `cover-${Date.now()}-${filename}`; return savedFilename; },
      });
      const uploadHandler = unstable_composeUploadHandlers(fileUploadHandler, unstable_createMemoryUploadHandler());
      const formdata = await unstable_parseMultipartFormData(request, uploadHandler);

      if (!savedFilename) return json({ error: "No image uploaded" }, { status: 400 });
      const coverPath = path.join(uploadDir, savedFilename);

      try {
        const coverBuf = fs.readFileSync(coverPath);
        const coverUploadUrl = await uploadImage(coverBuf, shop, accessToken, apiVersion);
        const createFileQuery = `mutation fileCreate($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { alt fileStatus id preview { image { url } } } userErrors { field message } } }`;
        const coverFileRes = await axios.post(
          `https://${shop}/admin/api/${apiVersion}/graphql.json`,
          { query: createFileQuery, variables: { files: [{ alt: "cover-image", contentType: "IMAGE", originalSource: coverUploadUrl }] } },
          { headers: { "X-Shopify-Access-Token": accessToken } }
        );
        const coverFileIds = coverFileRes.data.data.fileCreate.files.map((f: any) => f.id);
        const coverPreviewUrls = await pollFileStatus(shop, accessToken, coverFileIds);
        const coverImageUrl = coverPreviewUrls?.[0]?.preview?.image?.url ?? null;

        if (!coverImageUrl) return json({ error: "Failed to get image URL from Shopify" }, { status: 500 });

        const existingMetafield = await admin.rest.resources.Metafield.find({ session, id });
        const existingValue = typeof existingMetafield.value === "string" ? JSON.parse(existingMetafield.value) : existingMetafield.value || {};
        const metafield = new admin.rest.resources.Metafield({ session });
        metafield.id = id;
        metafield.value = JSON.stringify({ ...existingValue, coverImage: coverImageUrl });
        metafield.type = "json";
        await metafield.save({ update: true });

        return json({ success: true, intent: "updateCoverImage", coverImageUrl });
      } catch (err) {
        console.error("Cover image upload failed:", err);
        return json({ error: "Failed to upload cover image" }, { status: 500 });
      } finally {
        try { (await import("fs")).unlinkSync(coverPath); } catch {}
      }
    }

    const formdata: any = await request.formData();

    const intent = formdata.get("_intent");
    if (intent === "updateTargetPage") {
      const targetPage = formdata.get("targetPage") as string;
      const targetPageHandle = formdata.get("targetPageHandle") as string;
      const targetPageLabel = formdata.get("targetPageLabel") as string;

      const existingMetafield = await admin.rest.resources.Metafield.find({ session, id });
      const existingValue = typeof existingMetafield.value === "string"
        ? JSON.parse(existingMetafield.value)
        : existingMetafield.value || {};

      const metafield = new admin.rest.resources.Metafield({ session });
      metafield.id = id;
      metafield.value = JSON.stringify({ ...existingValue, targetPage, targetPageHandle, targetPageLabel });
      metafield.type = "json";
      await metafield.save({ update: true });
      return json({ success: true, intent: "updateTargetPage" });
    }

    const images = formdata.get("images");
    const pdfName = formdata.get("pdfName");
    if (typeof images !== "string") {
      return json({ error: "Invalid image data. Please upload valid images." });
    }

    const existingMetafield = await admin.rest.resources.Metafield.find({ session, id });
    const existingValue = typeof existingMetafield.value === "string"
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

    if (!metafield) return json({ error: "Failed to save metafield" });
    return json({ success: true, message: "metafield updated successfully" });
  }
  return json(null);
};

// ── Page target options ───────────────────────────────────────────────────────
const PAGE_TARGETS = [
  { value: "index",      label: "Home page",        icon: "🏠", template: "index" },
  { value: "collection", label: "Collections page", icon: "📂", template: "collection" },
  { value: "product",    label: "Product page",     icon: "🛒", template: "product" },
  { value: "page",       label: "Custom page",      icon: "📄", template: "page" },
  { value: "blog",       label: "Blog page",        icon: "📝", template: "blog" },
  { value: "search",     label: "Search results",   icon: "🔍", template: "search" },
  { value: "cart",       label: "Cart page",        icon: "🛍", template: "cart" },
];

// ── Copy Key Button ───────────────────────────────────────────────────────────
function CopyKeyButton({ pdfKey, onCopied }: { pdfKey: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(pdfKey).then(() => {
          setCopied(true);
          onCopied?.();
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
      }}
      style={{
        background: copied ? "#DCFCE7" : "#E2E8F0",
        border: "none", borderRadius: 5, padding: "3px 8px",
        fontSize: 11, fontWeight: 600,
        color: copied ? "#15803D" : "#374151",
        cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ Copied!" : "Copy"}
    </button>
  );
}

// ── Onboarding Tooltip ────────────────────────────────────────────────────────
// Shows only on first visit per catalog, tracked in localStorage.
function OnboardingTooltip({
  pdfKey, step, onNext, onFinish, anchorRef,
}: {
  pdfKey: string;
  step: 1 | 2;
  onNext: () => void;
  onFinish: () => void;
  anchorRef: React.RefObject<HTMLDivElement>;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const update = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 12, left: rect.left + window.scrollX });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [step, anchorRef]);

  if (!pos) return null;

  return (
    <>
      {/* invisible backdrop to dismiss on outside click */}
      <div onClick={onFinish} style={{ position: "fixed", inset: 0, zIndex: 998 }} />

      <div style={{
        position: "absolute", top: pos.top, left: pos.left,
        zIndex: 999, width: 272,
        background: "#0F172A", borderRadius: 12,
        padding: "16px", boxShadow: "0 12px 40px rgba(15,23,42,0.32)",
        animation: "tooltipIn 0.18s ease",
      }}>
        {/* arrow */}
        <div style={{
          position: "absolute", top: -5, left: 22,
          width: 10, height: 10, background: "#0F172A",
          transform: "rotate(45deg)", borderRadius: 2,
        }} />

        {/* progress dots */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
          {[1, 2].map((s) => (
            <div key={s} style={{
              height: 3, width: s === step ? 20 : 10, borderRadius: 2,
              background: s === step ? "#3B82F6" : "rgba(255,255,255,0.2)",
              transition: "all 0.2s",
            }} />
          ))}
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: "auto" }}>{step} of 2</span>
        </div>

        {step === 1 ? (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "0 0 5px" }}>
              👆 Copy your PDF Key
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "0 0 12px", lineHeight: 1.6 }}>
              This key links the block to your catalog. You'll paste it in the Theme Editor after adding the block.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.07)", borderRadius: 7, padding: "8px 10px", marginBottom: 14 }}>
              <code style={{ fontSize: 11, fontFamily: "monospace", color: "#93C5FD", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pdfKey}
              </code>
              <CopyKeyButton pdfKey={pdfKey} onCopied={onNext} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={onFinish} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", padding: 0 }}>
                Skip
              </button>
              <button onClick={onNext} style={{ background: "#2563EB", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "0 0 5px" }}>
              🎨 Add to your theme
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "0 0 14px", lineHeight: 1.6 }}>
              Click <strong style={{ color: "#fff" }}>Add to Theme</strong>, pick a page, then paste your copied key into the <strong style={{ color: "#93C5FD" }}>PDF KEY</strong> field and hit Save.
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={onFinish} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", padding: 0 }}>
                Skip
              </button>
              <button onClick={onFinish} style={{ background: "#16A34A", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                ✓ Got it
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes tooltipIn {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ── Add to Theme button + modal ───────────────────────────────────────────────
function AddToThemeButton({
  shop, activeThemeId, appBlockHandle, pdfKey,
  targetPage, targetPageHandle, targetPageLabel, catalogId,
}: {
  shop: string;
  activeThemeId: string | null;
  appBlockHandle: string;
  pdfKey: string;
  targetPage: string;
  targetPageHandle: string;
  targetPageLabel: string;
  catalogId: number;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickedPage, setPickedPage] = useState(targetPage || "");
  const [pickedHandle, setPickedHandle] = useState(targetPageHandle || "");
  const fetcher = useFetcher();

  const openCustomizer = (page: string, handle: string) => {
    if (!activeThemeId) return;
    if (pdfKey && navigator.clipboard) navigator.clipboard.writeText(pdfKey).catch(() => {});
    const target = PAGE_TARGETS.find((t) => t.value === page);
    const template = target?.template ?? "index";
    const params = new URLSearchParams();
    if (template === "page" && handle) {
      params.set("template", `page.${handle}`);
    } else {
      params.set("template", template);
    }
    params.set("addAppBlockId", appBlockHandle);
    params.set("target", "newAppsSection");
    window.open(`https://${shop}/admin/themes/${activeThemeId}/editor?${params.toString()}`, "_blank");
  };

  const handleClick = () => {
    if (targetPage && targetPage !== "none") {
      openCustomizer(targetPage, targetPageHandle);
    } else {
      setShowPicker(true);
    }
  };

  const handlePickerConfirm = () => {
    if (!pickedPage) return;
    const label = PAGE_TARGETS.find((t) => t.value === pickedPage)?.label ?? pickedPage;
    const fd = new FormData();
    fd.append("_intent", "updateTargetPage");
    fd.append("targetPage", pickedPage);
    fd.append("targetPageHandle", pickedPage === "page" ? pickedHandle : "");
    fd.append("targetPageLabel", label);
    fetcher.submit(fd, { method: "post" });
    setShowPicker(false);
    openCustomizer(pickedPage, pickedPage === "page" ? pickedHandle : "");
  };

  return (
    <>
      <button
        onClick={handleClick}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0F172A", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(15,23,42,0.25)", letterSpacing: "-0.01em", transition: "background 0.15s" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1e293b")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0F172A")}
      >
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" stroke="white" strokeWidth="1.75" />
          <path d="M8 21h8M12 17v4" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        Add to Theme
        {targetPage && targetPage !== "none" && (
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", borderRadius: 99, padding: "2px 7px", fontWeight: 500 }}>
            {PAGE_TARGETS.find((t) => t.value === targetPage)?.icon} {PAGE_TARGETS.find((t) => t.value === targetPage)?.label ?? targetPageLabel}
          </span>
        )}
      </button>

      {showPicker && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(15,23,42,0.18)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Choose a page to embed</span>
              <button onClick={() => setShowPicker(false)} style={{ width: 30, height: 30, borderRadius: 8, background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <div style={{ padding: "14px 22px" }}>
              <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px", lineHeight: 1.6 }}>
                Which page should show this catalog? We'll open the Theme Editor and add the block automatically.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
                {PAGE_TARGETS.map((t) => {
                  const isSel = pickedPage === t.value;
                  return (
                    <button key={t.value} onClick={() => setPickedPage(t.value)}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 13px", background: isSel ? "#EFF6FF" : "#F8FAFC", border: `1.5px solid ${isSel ? "#1A73E8" : "#E8EDF2"}`, borderRadius: 9, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                      <span style={{ fontSize: 16 }}>{t.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? "#1A73E8" : "#374151" }}>{t.label}</span>
                      {isSel && <div style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "#1A73E8", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="9" height="9" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
                    </button>
                  );
                })}
              </div>
              {pickedPage === "page" && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Page handle <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span></label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
                    <span style={{ padding: "9px 10px 9px 13px", fontSize: 13, color: "#94A3B8", background: "#F8FAFC", borderRight: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>/pages/</span>
                    <input value={pickedHandle} onChange={(e) => setPickedHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="your-page-handle" style={{ flex: 1, border: "none", outline: "none", padding: "9px 13px", fontSize: 13, color: "#0F172A", fontFamily: "inherit" }} />
                  </div>
                </div>
              )}
              {/* inline PDF key reminder */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 9, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" stroke="#94A3B8" strokeWidth="1.75" /><path d="M12 16v-4M12 8h.01" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" /></svg>
                <span style={{ fontSize: 12, color: "#64748B" }}>Paste <code style={{ fontFamily: "monospace", background: "#EFF6FF", color: "#1A73E8", borderRadius: 3, padding: "0 4px", fontSize: 11 }}>{pdfKey}</code> into the <strong>PDF KEY</strong> field after the editor opens.</span>
                <CopyKeyButton pdfKey={pdfKey} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowPicker(false)} style={{ flex: 1, background: "#F1F5F9", color: "#374151", border: "none", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
                <button onClick={handlePickerConfirm} disabled={!pickedPage}
                  style={{ flex: 2, background: pickedPage ? "#0F172A" : "#E2E8F0", color: pickedPage ? "#fff" : "#94A3B8", border: "none", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 600, cursor: pickedPage ? "pointer" : "not-allowed", transition: "background 0.15s" }}>
                  Open Theme Editor →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Cover Image Card ──────────────────────────────────────────────────────────
function CoverImageCard({ coverImage, catalogNumericId }: { coverImage: string | null; catalogNumericId: number }) {
  const fetcher = useFetcher<any>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(coverImage);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  useEffect(() => {
    if (fetcher.data?.coverImageUrl) {
      setPreview(fetcher.data.coverImageUrl);
      setUploading(false);
      setShowModal(false);
    }
    if (fetcher.data?.error) {
      setUploading(false);
    }
  }, [fetcher.data]);

  const handleFileSelect = (f: File) => {
    if (!f.type.startsWith("image/")) return;
    setPendingFile(f);
    setPendingPreview(URL.createObjectURL(f));
    setShowModal(true);
  };

  const handleConfirmUpload = () => {
    if (!pendingFile) return;
    setUploading(true);
    setShowModal(false);
    const fd = new FormData();
    fd.append("coverImage", pendingFile);
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
    setPendingFile(null);
    setPendingPreview(null);
  };

  return (
    <>
      <div style={{ background: "#fff", border: "1px solid #E8EDF2", borderRadius: 12, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cover Image</p>

        {preview ? (
          /* ── Has cover image ── */
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 52, height: 74, borderRadius: 7, overflow: "hidden", border: "1px solid #E8EDF2", background: "#F8FAFC" }}>
                <img src={preview} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", margin: "0 0 4px" }}>Cover Image</p>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 10px" }}>A4 portrait format</p>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ fontSize: 12, fontWeight: 500, color: "#1A73E8", background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M12 15V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Replace image
              </button>
            </div>
          </div>
        ) : (
          /* ── No cover image — upload prompt ── */
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: "1.5px dashed #D1D5DB", borderRadius: 9, padding: "16px 14px", textAlign: "center", cursor: "pointer", background: "#FAFAFA", transition: "all 0.18s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1A73E8"; (e.currentTarget as HTMLDivElement).style.background = "#F0F6FF"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#D1D5DB"; (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
          >
            {uploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 22, height: 22, border: "2.5px solid #1A73E8", borderTop: "2.5px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>Uploading to Shopify…</p>
              </div>
            ) : (
              <>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fff", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#1A73E8" strokeWidth="1.75" /><circle cx="8.5" cy="8.5" r="1.5" stroke="#1A73E8" strokeWidth="1.5" /><path d="M21 15l-5-5L5 21" stroke="#1A73E8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>Add cover image</p>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>A4 portrait · JPG, PNG, WebP</p>
              </>
            )}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />

      {/* ── Confirm modal ── */}
      {showModal && pendingPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(15,23,42,0.18)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Confirm cover image</span>
              <button onClick={() => { setShowModal(false); setPendingFile(null); setPendingPreview(null); }} style={{ width: 28, height: 28, borderRadius: 7, background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <div style={{ padding: "16px 20px 20px" }}>
              {/* A4-ratio preview */}
              <div style={{ position: "relative", width: "100%", paddingTop: "141.4%", borderRadius: 10, overflow: "hidden", border: "1px solid #E8EDF2", marginBottom: 16, background: "#F8FAFC" }}>
                <img src={pendingPreview} alt="Preview" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 14px", textAlign: "center" }}>This image will be uploaded to your Shopify CDN and saved as the catalog cover.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowModal(false); setPendingFile(null); setPendingPreview(null); }} style={{ flex: 1, background: "#F1F5F9", color: "#374151", border: "none", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleConfirmUpload} style={{ flex: 2, background: "#1A73E8", color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Upload cover →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── UI Component ───────────────────────────────────────────────────────────────
const DetailPage = () => {
  const loaderData: any = useLoaderData();

  // ── First-visit onboarding (localStorage per catalog) ──────────────────────
  const [onboardStep, setOnboardStep] = useState<0 | 1 | 2>(0);
  const keyRef = useRef<HTMLDivElement>(null);
  const addThemeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const catalogId = loaderData?.pdfData?.id;
    if (!catalogId) return;
    const done = localStorage.getItem(`catalog_onboarded_${catalogId}`);
    if (!done) setOnboardStep(1);
  }, [loaderData?.pdfData?.id]);

  const finishOnboarding = () => {
    setOnboardStep(0);
    const catalogId = loaderData?.pdfData?.id;
    if (catalogId) localStorage.setItem(`catalog_onboarded_${catalogId}`, "1");
  };

  if (loaderData?.error) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", border: "1px solid #FCA5A5", borderRadius: 16, padding: "40px 48px", textAlign: "center", maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.75" /><path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Catalog not found</h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 20px", lineHeight: 1.6 }}>{loaderData.error}</p>
          <Link to="/app/pdf-convert" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1A73E8", color: "#fff", borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
            ← Back to catalogs
          </Link>
        </div>
      </div>
    );
  }

  const { pdfData, shop, hotspotColor, planName, activeThemeId, appBlockHandle } = loaderData;
  const pageCount = pdfData?.images?.length ?? 0;
  const hotspotTotal = pdfData?.images?.reduce((sum: number, img: any) => sum + (img.points?.length ?? 0), 0);
  const catalogNumericId = Number(pdfData?.id?.split("/").pop());
  const targetInfo = PAGE_TARGETS.find((t) => t.value === pdfData?.targetPage);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", position: "relative" }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #E8EDF2", padding: "16px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Link to="/app/pdf-convert"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748B", textDecoration: "none", fontWeight: 500 }}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
                  {targetInfo && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: "#374151", background: "#F1F5F9", borderRadius: 20, padding: "2px 10px", border: "1px solid #E2E8F0" }}>
                      {targetInfo.icon} {targetInfo.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Link to="/app/global-settings"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F8FAFC", color: "#374151", border: "1px solid #E2E8F0", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 500, textDecoration: "none", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "#9CA3AF")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "#E2E8F0")}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.75" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.75" /></svg>
                Global settings
              </Link>

              {/* PDF KEY — step 1 anchor */}
              <div
                ref={keyRef}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: onboardStep === 1 ? "#EFF6FF" : "#F8FAFC",
                  border: `1px solid ${onboardStep === 1 ? "#93C5FD" : "#E2E8F0"}`,
                  borderRadius: 9, padding: "8px 12px", transition: "all 0.2s",
                }}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <path d="M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 002 2h4a2 2 0 002-2M8 4a2 2 0 012-2h4a2 2 0 012 2" stroke="#64748B" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 12, color: "#64748B" }}>PDF Key:</span>
                <code style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", fontFamily: "monospace", background: "#EFF6FF", borderRadius: 4, padding: "1px 6px" }}>{pdfData?.key}</code>
                <CopyKeyButton pdfKey={pdfData?.key ?? ""} />
              </div>

              {/* ADD TO THEME — step 2 anchor */}
              <div ref={addThemeRef}>
                <AddToThemeButton
                  shop={shop}
                  activeThemeId={activeThemeId}
                  appBlockHandle={appBlockHandle}
                  pdfKey={pdfData?.key ?? ""}
                  targetPage={pdfData?.targetPage ?? "none"}
                  targetPageHandle={pdfData?.targetPageHandle ?? ""}
                  targetPageLabel={pdfData?.targetPageLabel ?? ""}
                  catalogId={catalogNumericId}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ONBOARDING TOOLTIPS (first visit only) ── */}
      {onboardStep === 1 && (
        <OnboardingTooltip
          pdfKey={pdfData?.key ?? ""}
          step={1}
          onNext={() => setOnboardStep(2)}
          onFinish={finishOnboarding}
          anchorRef={keyRef}
        />
      )}
      {onboardStep === 2 && (
        <OnboardingTooltip
          pdfKey={pdfData?.key ?? ""}
          step={2}
          onNext={finishOnboarding}
          onFinish={finishOnboarding}
          anchorRef={addThemeRef}
        />
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>

        {/* ── QUICK STATS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total pages", value: pageCount },
            { label: "Tagged hotspots", value: hotspotTotal },
            { label: "Untagged pages", value: Math.max(0, pageCount - (pdfData?.images?.filter((img: any) => img.points?.length > 0).length ?? 0)) },
          ].map((s) => (
            <div key={s.label} style={{ background: "#fff", border: "1px solid #E8EDF2", borderRadius: 12, padding: "14px 18px" }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 500, color: "#0F172A", margin: 0, letterSpacing: "-0.04em" }}>{s.value}</p>
            </div>
          ))}
          <CoverImageCard coverImage={pdfData?.coverImage ?? null} catalogNumericId={catalogNumericId} />
        </div>

        {/* ── PAGEFLIP EDITOR ── */}
        <div style={{ background: "#ffffff", border: "1px solid #E8EDF2", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(15,23,42,0.06)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Interactive Catalog Editor</span>
            </div>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Click any page to add a hotspot </span>
          </div>
          <PageFlip
            pdfName={pdfData.pdfName}
            images={pdfData.images}
            metaFieldId={pdfData.id}
            shopName={loaderData.shop}
            hotspotColor={loaderData.hotspotColor}
            planName={loaderData.planName}
            pageFormat={pdfData.pageFormat}
          />
        </div>

        {/* ── BOTTOM BAR ── */}
        <div style={{ marginTop: 16, padding: "14px 20px", background: "#ffffff", borderRadius: 12, border: "1px solid #E8EDF2", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <kbd style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 5, padding: "2px 7px", fontFamily: "monospace", fontSize: 11, color: "#374151", boxShadow: "0 1px 0 #D1D5DB" }}>Esc</kbd>
              <span style={{ fontSize: 12, color: "#64748B" }}>Deselect hotspot</span>
            </div>
            <div style={{ width: 1, height: 16, background: "#E2E8F0" }} />
            <span style={{ fontSize: 12, color: "#64748B" }}>Click on any page to add a hotspot pin</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link to="/app/pdf-convert"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B", textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#1A73E8")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#64748B")}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back to all catalogs
            </Link>
            <AddToThemeButton
              shop={shop} activeThemeId={activeThemeId} appBlockHandle={appBlockHandle}
              pdfKey={pdfData?.key ?? ""} targetPage={pdfData?.targetPage ?? "none"}
              targetPageHandle={pdfData?.targetPageHandle ?? ""} targetPageLabel={pdfData?.targetPageLabel ?? ""}
              catalogId={catalogNumericId}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailPage;