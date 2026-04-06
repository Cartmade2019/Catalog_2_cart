// ─────────────────────────────────────────────────────────────────────────────
// app.pdf-convert.tsx
// New flow: UploadModal now has a "Where to display?" step before upload.
// The chosen targetPage + targetPageHandle are stored in the metafield JSON.
// The details page reads them to build the Theme Customizer deep-link.
// ─────────────────────────────────────────────────────────────────────────────

import { Pagination } from "@shopify/polaris";
import { useState, useRef, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { pageInformation, PDFVALUES } from "../constants/types";
import { useDispatch, useSelector } from "react-redux";
import { addPlan } from "../store/slices/planSlice";
import DeleteModal from "../components/DeleteModal";
import { PLAN_LIMITS, getPlanLimits, getPlanName, bytesToMB } from "../constants/planLimits";

// ─── SERVER ───────────────────────────────────────────────────────────────────
let valueToFetch = 12;
const processingStatus: Record<string, number> = {};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { json } = await import("@remix-run/node");
  const { unstable_parseMultipartFormData, unstable_createFileUploadHandler } = await import("@remix-run/node");
  const path = await import("path");
  const fs = await import("fs");
  const axios = (await import("axios")).default;
  const { extractImagesFromPDF, generateRandomString, uploadImage, pollFileStatus } = await import("../utils/utils");
  const { apiVersion, authenticate } = await import("../shopify.server");

  const { session, admin } = await authenticate.admin(request);
  const { shop, accessToken } = session;
  if (!accessToken) return;

  if (request.method === "POST" || request.method === "post") {
    const { data: pricePlan } = await axios.get(
      `https://${shop}/admin/api/${apiVersion}/recurring_application_charges.json`,
      { headers: { "X-Shopify-Access-Token": accessToken } },
    );
    const activePlan = pricePlan?.recurring_application_charges?.find((charge: any) => charge.status === "active");

    const planName = activePlan?.name === "Basic" ? "Basic" : activePlan?.name === "Advance" ? "Advance" : "Free";
    
    const limits = PLAN_LIMITS[planName];
    const maxCatalogs = limits.catalogs;
    const maxUploadSizeBytes = limits.pdfSizeBytes;
    const maxUploadSizeMB = bytesToMB(maxUploadSizeBytes);

    const countQuery = `query GetPDFCount { shop { metafields(first: 250, namespace: "PDF") { edges { node { id } } } } }`;
    const countRes = await admin.graphql(countQuery);
    const countJson = await countRes.json();
    const existingCount = countJson?.data?.shop?.metafields?.edges?.length ?? 0;
    if (existingCount >= maxCatalogs) {
      return json({ error: `Your ${planName} plan allows only ${maxCatalogs} catalog uploads. Please upgrade to upload more PDFs.` }, { status: 403 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    let savedFilename = "";
    let savedCoverFilename = "";
    const { unstable_createMemoryUploadHandler, unstable_composeUploadHandlers } = await import("@remix-run/node");
    const fileUploadHandler = unstable_createFileUploadHandler({
      directory: uploadDir, maxPartSize: 50_000_000,
      file: ({ filename, name }) => {
        if (name === "pdf") { savedFilename = `${Date.now()}-${filename}`; return savedFilename; }
        if (name === "coverImage") { savedCoverFilename = `cover-${Date.now()}-${filename}`; return savedCoverFilename; }
        return filename;
      },
    });
    const uploadHandler = unstable_composeUploadHandlers(fileUploadHandler, unstable_createMemoryUploadHandler());
    const formData = await unstable_parseMultipartFormData(request, uploadHandler);
    const pdfFile = formData.get("pdf") as any;
    const coverImageFile = formData.get("coverImage") as any;

    if (pdfFile?.size && Number(pdfFile.size) > maxUploadSizeBytes) {
      return json({ error: `Your ${planName} plan allows PDF uploads up to ${maxUploadSizeMB} MB.` }, { status: 403 });
    }
    if (!pdfFile || !savedFilename) return json({ error: "No file uploaded" }, { status: 400 });

    const rawPdfName = formData.get("pdfName");
    const pdfName: string = (typeof rawPdfName === "string" && rawPdfName.trim())
      ? rawPdfName.trim()
      : (pdfFile.name || savedFilename || "Untitled PDF").replace(/^\d+-/, "").replace(/\.pdf$/i, "");

    // ── NEW: read targetPage fields from form ─────────────────────────────────
    const targetPage = (formData.get("targetPage") as string) || "none";
    const targetPageHandle = (formData.get("targetPageHandle") as string) || "";
    const targetPageLabel = (formData.get("targetPageLabel") as string) || "";

    const pdfPath = path.join(uploadDir, savedFilename);

    const pdfSizeInKB = (fs.statSync(pdfPath).size / 1024).toFixed(2);

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    processingStatus[jobId] = 0;

    (async () => {
      try {
        processingStatus[jobId] = 1;
        const imageUrls = await extractImagesFromPDF(pdfPath,{density: 300});
        const readedUrls = imageUrls.map((url: string) => fs.readFileSync(path.join(process.cwd(), "public", url)));
const sharp = (await import("sharp")).default;
const firstImageMeta = await sharp(readedUrls[0]).metadata();
const imgWidth = firstImageMeta.width ?? 0;
const imgHeight = firstImageMeta.height ?? 0;

console.log(imgWidth, imgHeight);

const longerSide = Math.max(imgWidth, imgHeight);
const DPI = 300;
const pageFormat = longerSide > (DPI * 11.7) ? "A3" : "A4"; 
console.log(pageFormat);

        processingStatus[jobId] = 2;
        const uploadedImages = [];

const processedImages = [];
for (const buf of readedUrls) {
  const optimized = await sharp(buf)
    .png({ compressionLevel: 6 })   // or .jpeg({ quality: 92 }) for smaller files
    .toBuffer();
  processedImages.push(optimized);
}
for (const buf of processedImages) uploadedImages.push(await uploadImage(buf, shop, accessToken, apiVersion));
        const createFileQuery = `mutation fileCreate($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { alt fileStatus id preview { image { url id height width } } } userErrors { field message } } }`;
        const r = await axios.post(`https://${shop}/admin/api/${apiVersion}/graphql.json`, { query: createFileQuery, variables: { files: uploadedImages.map((url) => ({ alt: "alt-tag", contentType: "IMAGE", originalSource: url })) } }, { headers: { "X-Shopify-Access-Token": `${accessToken}` } });
        const fileIds = r.data.data.fileCreate.files.map((f: any) => f.id);
        const previewUrls = await pollFileStatus(shop, accessToken, fileIds);

        // ── Upload cover image to Shopify if provided ─────────────────────────
        let coverImageUrl: string | null = null;
        if (savedCoverFilename) {
          const coverPath = path.join(uploadDir, savedCoverFilename);
          if (fs.existsSync(coverPath)) {
            try {
              const coverBuf = fs.readFileSync(coverPath);
              const coverUploadUrl = await uploadImage(coverBuf, shop, accessToken, apiVersion);
              const coverFileRes = await axios.post(
                `https://${shop}/admin/api/${apiVersion}/graphql.json`,
                { query: createFileQuery, variables: { files: [{ alt: "cover-image", contentType: "IMAGE", originalSource: coverUploadUrl }] } },
                { headers: { "X-Shopify-Access-Token": `${accessToken}` } }
              );
              const coverFileIds = coverFileRes.data.data.fileCreate.files.map((f: any) => f.id);
              const coverPreviewUrls = await pollFileStatus(shop, accessToken, coverFileIds);
              coverImageUrl = coverPreviewUrls?.[0]?.preview?.image?.url ?? null;
            } catch (err) {
              console.error("Cover image upload failed:", err);
            } finally {
              fs.unlink(coverPath, () => {});
            }
          }
        }

        processingStatus[jobId] = 3;
        const key = generateRandomString();
        const metafieldData = {
          namespace: "PDF", key,
          value: JSON.stringify({
            pdfName, pdfSizeInKB,
            date: new Date().toLocaleDateString(),
  
            // ── store the target page so details page can build the deep-link
            targetPage,
            targetPageHandle,
            targetPageLabel,
            pageFormat,
            ...(coverImageUrl ? { coverImage: coverImageUrl } : {}),
            images: previewUrls.map((d: any, i: number) => ({ id: i + 1, url: d.image.url, points: [] })),
          }),
          type: "json", owner_resource: "shop",
        };
        const { data: imageData } = await axios.post(`https://${shop}/admin/api/${apiVersion}/metafields.json`, { metafield: metafieldData }, { headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken } });
        if (!imageData) console.error("Failed to save metafield");

        processingStatus[jobId] = 4;
        imageUrls.forEach((url: string) => fs.unlink(path.join(process.cwd(), "public", url), () => {}));
        fs.unlink(pdfPath, () => {});
        setTimeout(() => { delete processingStatus[jobId]; }, 300000);
      } catch (err) {
        console.error("Background PDF processing failed:", err);
        delete processingStatus[jobId];
      }
    })();

    return json({ processing: true, pdfName, jobId });
  }

  if (request.method === "DELETE" || request.method === "delete") {
    const formData = await request.formData();
    const keysRaw: any = formData.get("keys");
    if (!keysRaw) return json({ error: "No keys provided" }, { status: 400 });
    const keysArray: string[] = JSON.parse(keysRaw);
    if (!Array.isArray(keysArray) || keysArray.length === 0) return json({ error: "Invalid keys" }, { status: 400 });
    try {
      for (const key of keysArray) {
        const lookupUrl = `https://${shop}/admin/api/${apiVersion}/metafields.json?namespace=PDF&key=${encodeURIComponent(key)}`;
        const lookupRes = await axios.get(lookupUrl, { headers: { "X-Shopify-Access-Token": accessToken } });
        const metafields = lookupRes.data?.metafields;
        if (metafields && metafields.length > 0) {
          await axios.delete(`https://${shop}/admin/api/${apiVersion}/metafields/${metafields[0].id}.json`, { headers: { "X-Shopify-Access-Token": accessToken } });
        }
      }
      const Q = `query GetPDFQuery { shop { metafields(first: ${valueToFetch}, namespace: "PDF", reverse: true) { pageInfo { hasPreviousPage hasNextPage startCursor endCursor } edges { node { id namespace key jsonValue type } } } } }`;
      const data = await admin.graphql(Q);
      const response = await data.json();
      const pageInfo = response.data.shop.metafields.pageInfo;
      const nodes = response.data.shop.metafields.edges.map((e: any) => e.node);
      if (!nodes.length) return json({ pdfData: [], pageInfo, query: Q });
      return json({ pdfData: nodes.map((pdf: any) => ({ id: pdf.id.split("/").pop(), pdfName: pdf.jsonValue?.pdfName ?? "Untitled Document", frontPage: pdf.jsonValue?.images?.[0]?.url ?? "", allImages: pdf.jsonValue?.images ?? [], pageCount: pdf.jsonValue?.images?.length ?? 0, hotspotCount: pdf.jsonValue?.images?.reduce((s: number, img: any) => s + (img.points?.length ?? 0), 0) ?? 0, size: pdf.jsonValue?.pdfSizeInKB ?? "", date: pdf.jsonValue?.date ?? "", key: pdf.key, namespace: pdf.namespace, targetPage: pdf.jsonValue?.targetPage ?? "none", targetPageLabel: pdf.jsonValue?.targetPageLabel ?? "" })), pageInfo, query: Q });
    } catch { return json({ error: "Something went wrong" }, { status: 500 }); }
  }

  if (request.method === "PUT" || request.method === "put") {
    const formData = await request.formData();
    const afterBefore = formData.get("afterBefore") as "after" | "before";
    const firstLast = formData.get("firstLast") as "last" | "first";
    const pageToken = formData.get("pageToken") as string;
    const { data: pricePlan } = await axios.get(`https://${shop}/admin/api/${apiVersion}/recurring_application_charges.json`, { headers: { "X-Shopify-Access-Token": accessToken } });
    const activePricePlan = pricePlan.recurring_application_charges.find((charge: any) => charge.status === "active") ?? null;
    const Q = `query GetPDFQuery { shop { metafields(${firstLast}: ${valueToFetch}, reverse: true, namespace: "PDF", ${afterBefore}: "${pageToken}") { pageInfo { hasPreviousPage hasNextPage startCursor endCursor } edges { node { id namespace key jsonValue type } } } } }`;
    try {
      const data = await admin.graphql(Q);
      const response = await data.json();
      const pageInfo = response.data.shop.metafields.pageInfo;
      const nodes = response.data.shop.metafields.edges.map((e: any) => e.node);
      if (!nodes.length) return { pdfData: [], pricePlan: activePricePlan, pageInfo, query: Q };
      return { pdfData: nodes.map((pdf: any) => ({ id: pdf.id.split("/").pop(), pdfName: pdf.jsonValue?.pdfName ?? "Untitled Document", frontPage: pdf.jsonValue?.images?.[0]?.url ?? "", allImages: pdf.jsonValue?.images ?? [], pageCount: pdf.jsonValue?.images?.length ?? 0, hotspotCount: pdf.jsonValue?.images?.reduce((s: number, img: any) => s + (img.points?.length ?? 0), 0) ?? 0, size: pdf.jsonValue?.pdfSizeInKB ?? "", date: pdf.jsonValue?.date ?? "", key: pdf.key, namespace: pdf.namespace, targetPage: pdf.jsonValue?.targetPage ?? "none", targetPageLabel: pdf.jsonValue?.targetPageLabel ?? "" })), pricePlan: activePricePlan, pageInfo, query: Q };
    } catch { return { error: "Unexpected error occurred while fetching metafields." }; }
  }

  if (request.method === "PATCH" || request.method === "patch") {
    const formData = await request.formData();
    const jobId = formData.get("jobId") as string | null;
    const currentStep = jobId && processingStatus[jobId] !== undefined ? processingStatus[jobId] : null;
    const Q = `query GetPDFQuery { shop { metafields(first: ${valueToFetch}, namespace: "PDF", reverse: true) { pageInfo { hasPreviousPage hasNextPage startCursor endCursor } edges { node { id namespace key jsonValue type } } } } }`;
    try {
      const data = await admin.graphql(Q);
      const response = await data.json();
      const pageInfo = response.data.shop.metafields.pageInfo;
      const nodes = response.data.shop.metafields.edges.map((e: any) => e.node);
      if (!nodes.length) return json({ pdfData: [], pageInfo, query: Q, currentStep });
      return json({ currentStep, pdfData: nodes.map((pdf: any) => ({ id: pdf.id.split("/").pop(), pdfName: pdf.jsonValue?.pdfName ?? "Untitled Document", frontPage: pdf.jsonValue?.images?.[0]?.url ?? "", allImages: pdf.jsonValue?.images ?? [], pageCount: pdf.jsonValue?.images?.length ?? 0, hotspotCount: pdf.jsonValue?.images?.reduce((s: number, img: any) => s + (img.points?.length ?? 0), 0) ?? 0, size: pdf.jsonValue?.pdfSizeInKB ?? "", date: pdf.jsonValue?.date ?? "", key: pdf.key, namespace: pdf.namespace, targetPage: pdf.jsonValue?.targetPage ?? "none", targetPageLabel: pdf.jsonValue?.targetPageLabel ?? "" })), pageInfo, query: Q });
    } catch { return json({ error: "Failed to fetch" }, { status: 500 }); }
  }

  return json({ error: "Unknown method" }, { status: 400 });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const axios = (await import("axios")).default;
  const { apiVersion, authenticate } = await import("../shopify.server");
  const { admin, session: { accessToken, shop } } = await authenticate.admin(request);
  const { data: pricePlan } = await axios.get(`https://${shop}/admin/api/${apiVersion}/recurring_application_charges.json`, { headers: { "X-Shopify-Access-Token": accessToken } });
  // Always find the active charge — null means free merchant (no active paid plan)
  const activePricePlan = pricePlan.recurring_application_charges.find((charge: any) => charge.status === "active") ?? null;
  console.log("Active plan:", activePricePlan?.name ?? "Free (no active charge)");
  const Q = `query GetPDFQuery { shop { metafields(first: ${valueToFetch}, namespace: "PDF", reverse: true) { pageInfo { hasPreviousPage hasNextPage startCursor endCursor } edges { node { id namespace key jsonValue type } } } } }`;
  try {
    const data = await admin.graphql(Q);
    const response = await data.json();
    const pageInfo = response.data.shop.metafields.pageInfo;
    const nodes = response.data.shop.metafields.edges.map((e: any) => e.node);
    if (!nodes.length) return { pdfData: [], pricePlan: activePricePlan, pageInfo, query: Q };
    return { pdfData: nodes.map((pdf: any) => ({ id: pdf.id.split("/").pop(), pdfName: pdf.jsonValue?.pdfName ?? "Untitled Document", frontPage: pdf.jsonValue?.images?.[0]?.url ?? "", allImages: pdf.jsonValue?.images ?? [], pageCount: pdf.jsonValue?.images?.length ?? 0, hotspotCount: pdf.jsonValue?.images?.reduce((s: number, img: any) => s + (img.points?.length ?? 0), 0) ?? 0, size: pdf.jsonValue?.pdfSizeInKB ?? "", date: pdf.jsonValue?.date ?? "", key: pdf.key, namespace: pdf.namespace, targetPage: pdf.jsonValue?.targetPage ?? "none", targetPageLabel: pdf.jsonValue?.targetPageLabel ?? "" })), pricePlan: activePricePlan, pageInfo, query: Q };
  } catch { return { error: "Unexpected error occurred while fetching metafields." }; }
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const UPLOAD_STEPS = ["Uploading file", "Extracting pages", "Uploading to Shopify CDN", "Saving catalog"];

// All Shopify template targets the merchant can choose from
const PAGE_TARGETS = [
  { value: "index",      label: "Home page",         icon: "🏠", template: "index" },
  { value: "collection", label: "Collections page",  icon: "📂", template: "collection" },
  { value: "product",    label: "Product page",      icon: "🛒", template: "product" },
  { value: "page",       label: "Custom page",        icon: "📄", template: "page" },
  { value: "blog",       label: "Blog page",          icon: "📝", template: "blog" },
  { value: "search",     label: "Search results",     icon: "🔍", template: "search" },
  { value: "cart",       label: "Cart page",          icon: "🛍", template: "cart" },
];

// ─── UPLOAD MODAL ─────────────────────────────────────────────────────────────
// Phase 1: "details" — name the catalog + pick the target page
// Phase 2: "progress" — processing
// Phase 3: "done" — redirect to editor
function UploadModal({
  file, onClose, onChangeFile, onUpload, phase, step, onEdit,
}: {
  file: File | null;
  onClose: () => void;
  onChangeFile: () => void;
  onUpload: (file: File, name: string, targetPage: string, targetPageHandle: string, targetPageLabel: string, coverImage: File | null) => void;
  phase: "preview" | "progress" | "done";
  step: number;
  onEdit: () => void;
}) {
  const [catalogName, setCatalogName] = useState(file ? file.name.replace(/\.pdf$/i, "") : "");
  const [modalStep, setModalStep] = useState<"name" | "page" | "cover">("name");
  const [targetPage, setTargetPage] = useState<string>("");
  const [customPageHandle, setCustomPageHandle] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [pdfPageThumbnails, setPdfPageThumbnails] = useState<string[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);
  const [coverSource, setCoverSource] = useState<"pdf" | "device">("pdf");
  const coverImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) setCatalogName(file.name.replace(/\.pdf$/i, ""));
  }, [file]);

  // Reset inner step when modal closes/reopens
  useEffect(() => {
    if (phase === "preview") { setModalStep("name"); setCoverImage(null); setCoverImagePreview(null); setPdfPageThumbnails([]); setSelectedPageIndex(0); setCoverSource("pdf"); }
  }, [phase]);

  // Generate PDF page thumbnails when user reaches the cover step
  useEffect(() => {
    if (modalStep !== "cover" || !file || pdfPageThumbnails.length > 0) return;
    let cancelled = false;
    (async () => {
      setThumbnailsLoading(true);
      try {
        let pdfjsLib: any = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load PDF.js"));
            document.head.appendChild(script);
          });
          pdfjsLib = (window as any).pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = Math.min(pdf.numPages, 5);
        const thumbs: string[] = [];
        for (let i = 1; i <= totalPages; i++) {
          if (cancelled) break;
          const page = await pdf.getPage(i);
          // Render at 2x scale for crisp quality — same effective resolution as the CDN images
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          thumbs.push(canvas.toDataURL("image/jpeg", 0.92));
        }
        if (!cancelled) setPdfPageThumbnails(thumbs);
      } catch (e) {
        console.error("PDF thumbnail generation failed:", e);
      } finally {
        if (!cancelled) setThumbnailsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [modalStep, file]);

  const handleCoverImageSelect = (f: File) => {
    if (!f.type.startsWith("image/")) return;
    setCoverImage(f);
    setCoverSource("device");
    const url = URL.createObjectURL(f);
    setCoverImagePreview(url);
  };

  // Convert a data-URL thumbnail to a File object
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  if (!file) return null;

  const title = phase === "preview"
    ? (modalStep === "name" ? "New Catalog" : modalStep === "page" ? "Where to display?" : "Cover Image")
    : phase === "progress" ? "Processing..." : "Catalog Ready!";

  const selectedTarget = PAGE_TARGETS.find((t) => t.value === targetPage);

  const handleConfirmUpload = (skipCover = false) => {
    const label = targetPage === "page"
      ? `Custom page${customPageHandle ? ` (/${customPageHandle})` : ""}`
      : selectedTarget?.label ?? "Not specified";
    const handle = targetPage === "page" ? customPageHandle : "";
    let finalCover: File | null = null;
    if (!skipCover) {
      if (coverSource === "device" && coverImage) {
        finalCover = coverImage;
      } else if (pdfPageThumbnails.length > 0) {
        finalCover = dataUrlToFile(pdfPageThumbnails[selectedPageIndex] ?? pdfPageThumbnails[0], `cover-page-${selectedPageIndex + 1}.jpg`);
      }
    }
    onUpload(file, catalogName.trim() || file.name.replace(/\.pdf$/i, ""), targetPage || "none", handle, label, finalCover);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 20px", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(15,23,42,0.18)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>

        {/* Header — fixed, never scrolls away */}
        <div style={{ padding: "16px 18px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {phase === "preview" && (modalStep === "page" || modalStep === "cover") && (
                <button onClick={() => setModalStep(modalStep === "cover" ? "page" : "name")} style={{ width: 26, height: 26, borderRadius: 7, background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{title}</span>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          {/* Step indicator */}
          {phase === "preview" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 0 0" }}>
              {["Name", "Page", "Cover"].map((s, i) => {
                const isActive = (i === 0 && modalStep === "name") || (i === 1 && modalStep === "page") || (i === 2 && modalStep === "cover");
                const isDone = (i === 0 && (modalStep === "page" || modalStep === "cover")) || (i === 1 && modalStep === "cover");
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: isDone ? "#22C55E" : isActive ? "#1A73E8" : "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isDone
                          ? <svg width="8" height="8" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          : <span style={{ fontSize: 8, fontWeight: 700, color: isActive ? "#fff" : "#94A3B8" }}>{i + 1}</span>
                        }
                      </div>
                      <span style={{ fontSize: 10, color: isActive ? "#0F172A" : isDone ? "#22C55E" : "#94A3B8", fontWeight: isActive ? 600 : 400 }}>{s}</span>
                    </div>
                    {i < 2 && <div style={{ width: 20, height: 1, background: "#E2E8F0", margin: "0 2px" }} />}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ height: 1, background: "#F1F5F9", margin: "12px -18px 0" }} />
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>

          {/* ── STEP 1: Name + file info ── */}
          {phase === "preview" && modalStep === "name" && (
            <div style={{ padding: "14px 18px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F8FAFC", border: "1px solid #E8EDF2", borderRadius: 9, padding: "10px 12px", marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="17" height="17" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#EF4444" strokeWidth="1.5" strokeLinejoin="round" /><path d="M14 2v6h6" stroke="#EF4444" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#0F172A", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                  <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={onChangeFile} style={{ marginLeft: "auto", fontSize: 11, color: "#1A73E8", background: "none", border: "none", cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" }}>Change</button>
              </div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "#374151", display: "block", marginBottom: 5 }}>Catalog name</label>
              <input
                value={catalogName}
                onChange={(e) => setCatalogName(e.target.value)}
                placeholder="e.g. Summer 2025 Lookbook"
                style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#0F172A", outline: "none", fontFamily: "inherit", background: "#fff", transition: "border-color 0.15s", boxSizing: "border-box" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#1A73E8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#E2E8F0")}
              />
              <button
                onClick={() => setModalStep("page")}
                disabled={!catalogName.trim()}
                style={{ width: "100%", marginTop: 14, background: catalogName.trim() ? "#1A73E8" : "#E2E8F0", color: catalogName.trim() ? "#fff" : "#94A3B8", border: "none", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 600, cursor: catalogName.trim() ? "pointer" : "not-allowed", transition: "background 0.15s" }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP 2: Choose target page ── */}
          {phase === "preview" && modalStep === "page" && (
            <div style={{ padding: "14px 18px 18px" }}>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 10px", lineHeight: 1.5 }}>
                Which page should show this catalog? Used for the Theme Editor deep-link.
              </p>
              {/* 2-column grid for page targets */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                {PAGE_TARGETS.map((t) => {
                  const isSelected = targetPage === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTargetPage(t.value)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: isSelected ? "#EFF6FF" : "#F8FAFC", border: `1.5px solid ${isSelected ? "#1A73E8" : "#E8EDF2"}`, borderRadius: 8, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                    >
                      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{t.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? "#1A73E8" : "#374151", lineHeight: 1.3 }}>{t.label}</span>
                      {isSelected && (
                        <div style={{ marginLeft: "auto", width: 14, height: 14, borderRadius: "50%", background: "#1A73E8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="7" height="7" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom page handle input */}
              {targetPage === "page" && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>
                    Page handle <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                    <span style={{ padding: "8px 8px 8px 11px", fontSize: 12, color: "#94A3B8", background: "#F8FAFC", borderRight: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>/pages/</span>
                    <input
                      value={customPageHandle}
                      onChange={(e) => setCustomPageHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="your-page-handle"
                      style={{ flex: 1, border: "none", outline: "none", padding: "8px 11px", fontSize: 12, color: "#0F172A", fontFamily: "inherit" }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setTargetPage("none"); setModalStep("cover"); }}
                  style={{ flex: 1, background: "#F1F5F9", color: "#374151", border: "none", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                >
                  Skip
                </button>
                <button
                  onClick={() => setModalStep("cover")}
                  disabled={!targetPage}
                  style={{ flex: 2, background: targetPage ? "#1A73E8" : "#E2E8F0", color: targetPage ? "#fff" : "#94A3B8", border: "none", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 600, cursor: targetPage ? "pointer" : "not-allowed", transition: "background 0.15s" }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Cover Image ── */}
          {phase === "preview" && modalStep === "cover" && (
            <div style={{ padding: "14px 18px 18px" }}>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 12px", lineHeight: 1.5 }}>
                Choose a cover from your PDF pages, or upload a custom image from your device.
              </p>

              {/* Two-column layout */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

                {/* LEFT: Upload from device */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>From device</p>
                  <div
                    onClick={() => coverImageRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCoverImageSelect(f); }}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "14px 10px", borderRadius: 10, border: `1.5px dashed ${coverSource === "device" && coverImagePreview ? "#1A73E8" : "#D1D5DB"}`, background: coverSource === "device" && coverImagePreview ? "#F0F6FF" : "#FAFAFA", cursor: "pointer", transition: "all 0.18s", minHeight: 110, textAlign: "center" }}
                  >
                    {coverSource === "device" && coverImagePreview ? (
                      <>
                        <div style={{ width: 46, height: 60, borderRadius: 5, overflow: "hidden", border: "1.5px solid #1A73E8", flexShrink: 0 }}>
                          <img src={coverImagePreview} alt="Cover preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 500, color: "#1A73E8", margin: 0 }}>Selected</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setCoverImage(null); setCoverImagePreview(null); setCoverSource("pdf"); }}
                          style={{ fontSize: 10, color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}
                        >Remove</button>
                      </>
                    ) : (
                      <>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#1A73E8" strokeWidth="1.75" /><circle cx="8.5" cy="8.5" r="1.5" stroke="#1A73E8" strokeWidth="1.5" /><path d="M21 15l-5-5L5 21" stroke="#1A73E8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 500, color: "#374151", margin: 0 }}>Upload image</p>
                        <p style={{ fontSize: 10, color: "#94A3B8", margin: 0 }}>JPG, PNG, WebP</p>
                      </>
                    )}
                  </div>
                </div>

                {/* RIGHT: Pick from PDF pages */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>From PDF pages</p>
                  {thumbnailsLoading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110, gap: 8, background: "#FAFAFA", borderRadius: 10, border: "1px solid #E8EDF2" }}>
                      <div style={{ width: 14, height: 14, border: "2px solid #1A73E8", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>Loading pages…</span>
                    </div>
                  ) : pdfPageThumbnails.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                      {pdfPageThumbnails.map((thumb, idx) => {
                        const isSelected = coverSource === "pdf" && selectedPageIndex === idx;
                        return (
                          <div
                            key={idx}
                            onClick={() => { setSelectedPageIndex(idx); setCoverSource("pdf"); setCoverImage(null); setCoverImagePreview(null); }}
                            style={{ position: "relative", cursor: "pointer", borderRadius: 5, overflow: "hidden", border: `2px solid ${isSelected ? "#1A73E8" : "#E2E8F0"}`, aspectRatio: "0.7", background: "#F1F5F9", transition: "border-color 0.15s", boxShadow: isSelected ? "0 0 0 2px rgba(26,115,232,0.2)" : "none" }}
                          >
                            <img src={thumb} alt={`Page ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            {isSelected && (
                              <div style={{ position: "absolute", top: 2, right: 2, width: 12, height: 12, borderRadius: "50%", background: "#1A73E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="7" height="7" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </div>
                            )}
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.35)", padding: "2px 0", textAlign: "center" }}>
                              <span style={{ fontSize: 8, color: "#fff", fontWeight: 500 }}>{idx === 0 ? "Cover" : `P.${idx + 1}`}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110, background: "#FAFAFA", borderRadius: 10, border: "1px solid #E8EDF2" }}>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>No pages found</span>
                    </div>
                  )}
                  {pdfPageThumbnails.length > 0 && coverSource === "pdf" && (
                    <p style={{ fontSize: 10, color: "#64748B", margin: "5px 0 0", textAlign: "center" }}>
                      {selectedPageIndex === 0 ? "Page 1 (default)" : `Page ${selectedPageIndex + 1} selected`}
                    </p>
                  )}
                </div>

              </div>

              <input ref={coverImageRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverImageSelect(f); e.target.value = ""; }} />

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleConfirmUpload(true)}
                  style={{ flex: 1, background: "#F1F5F9", color: "#374151", border: "none", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                >
                  No cover
                </button>
                <button
                  onClick={() => handleConfirmUpload(false)}
                  style={{ flex: 2, background: "#1A73E8", color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                >
                  {coverSource === "device" && coverImage ? "Upload with custom cover →" : pdfPageThumbnails.length > 0 ? `Upload with page ${selectedPageIndex + 1} cover →` : "Upload catalog →"}
                </button>
              </div>
            </div>
          )}

          {/* ── PROGRESS ── */}
          {phase === "progress" && (
            <div>
              <div style={{ margin: "14px 18px 0", height: 3, background: "#E8EDF2", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#F59E0B", borderRadius: 99, width: `${Math.min(((step + 1) / UPLOAD_STEPS.length) * 100, 95)}%`, transition: "width 0.7s ease" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 18px 10px" }}>
                {UPLOAD_STEPS.map((label, idx) => {
                  const isDone = idx < step;
                  const isActive = idx === step;
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, opacity: idx > step ? 0.4 : 1, transition: "opacity 0.3s" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isDone ? "#22C55E" : isActive ? "#F59E0B" : "#EFF6FF", transition: "background 0.3s" }}>
                        {isDone ? (
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "white" : "#1A73E8" }} />
                        )}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: isDone || isActive ? 500 : 400, color: isDone ? "#22C55E" : isActive ? "#92400E" : "#1A73E8", flex: 1 }}>{label}</span>
                      {isActive && <div style={{ width: 11, height: 11, border: "2px solid #F59E0B", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", margin: "0 18px 16px" }}>You can close this window — processing continues in the background.</p>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === "done" && (
            <div style={{ padding: "22px 18px", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#F0FDF4", border: "1px solid #DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", margin: "0 0 6px" }}>Catalog ready!</p>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 16px", lineHeight: 1.6 }}>Your catalog has been processed. Open the editor to add product hotspots, then use <strong>Add to Theme</strong> to go live.</p>
              <button onClick={onEdit} style={{ width: "100%", background: "#1A73E8", color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                Open catalog editor →
              </button>
            </div>
          )}

        </div>{/* end scrollable body */}
      </div>
    </div>
  );
}

// ─── SUCCESS TOAST ────────────────────────────────────────────────────────────
function SuccessToast() {
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1100, background: "#0F172A", color: "#fff", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", gap: 8, animation: "fadeIn 0.2s ease" }}>
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Catalog uploaded successfully!
    </div>
  );
}

// ─── UPLOAD ZONE ──────────────────────────────────────────────────────────────
function UploadZone({ onFileSelected, maxUploadSizeMB }: { onFileSelected: (file: File) => void; maxUploadSizeMB: number }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (f: File) => { if (f.type !== "application/pdf") return; onFileSelected(f); };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      onClick={() => fileRef.current?.click()}
      style={{ border: `1.5px dashed ${dragging ? "#1A73E8" : "#D1D5DB"}`, borderRadius: 10, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: dragging ? "#F0F6FF" : "#FAFAFA", transition: "all 0.18s" }}
    >
      <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <div style={{ width: 42, height: 42, borderRadius: 10, background: "#fff", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 15V4M12 4l-4 4M12 4l4 4" stroke="#1A73E8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "#0F172A", margin: "0 0 3px" }}>Drag and drop your PDF here</p>
      <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 14px" }}>or click to browse · max {maxUploadSizeMB} MB</p>
      <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} style={{ display: "inline-block", background: "#1A73E8", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
        Choose PDF file
      </button>
    </div>
  );
}

const Trash = () => (
  <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
    <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const PdfConvert = () => {
  const loaderData: any = useLoaderData();
  const fetcher = useFetcher<any>();
  const pollFetcher = useFetcher<any>();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [pdfList, setPdfList] = useState<PDFVALUES[]>(loaderData?.pdfData ?? []);
  const [pageInfo, setPageInfo] = useState<pageInformation>(loaderData?.pageInfo);
  const [query, setQuery] = useState<string>(loaderData?.query ?? "");
  const [convertStep, setConvertStep] = useState(0);
  const [convertedFileName, setConvertedFileName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newCatalogId, setNewCatalogId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadModalFile, setUploadModalFile] = useState<File | null>(null);
  const [uploadModalPhase, setUploadModalPhase] = useState<"preview" | "progress" | "done">("preview");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousCountRef = useRef<number>(loaderData?.pdfData?.length ?? 0);
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const jobIdRef = useRef<string | null>(null);

  const plan = useSelector((s: any) => s.plan.plan);
  // Derive plan name directly from loaderData on first render to avoid one-frame lag
  // where Redux still holds the previous value before useEffect fires
  const planName = getPlanName(loaderData?.pricePlan?.name ?? plan);
  console.log("Current plan:", planName, "| Loader pricePlan:", loaderData?.pricePlan?.name ?? "Free (no active charge)");
  const limits = getPlanLimits(planName);
  const maxCatalogs = limits.catalogs;
  const maxUploadSizeBytes = limits.pdfSizeBytes;
  const maxUploadSizeMB = bytesToMB(maxUploadSizeBytes);
  const atLimit = pdfList.length >= maxCatalogs;

  useEffect(() => {
    // Only dispatch if there is an active paid plan — otherwise Redux stays "Free" (correct default)
    if (loaderData?.pricePlan?.name) dispatch(addPlan(loaderData.pricePlan.name));
    if (loaderData?.pdfData) setPdfList(loaderData.pdfData);
    if (loaderData?.pageInfo) setPageInfo(loaderData.pageInfo);
    if (loaderData?.query) setQuery(loaderData.query);
  }, [loaderData]);

  useEffect(() => {
    if (!fetcher.data) return;
    if ((fetcher.data as any)?.processing === true) {
      setIsProcessing(true);
      jobIdRef.current = (fetcher.data as any)?.jobId ?? null;
      previousCountRef.current = pdfList.length;
      return;
    }
    if (fetcher.data.pdfData) {
      setPdfList(fetcher.data.pdfData);
      setPageInfo(fetcher.data.pageInfo);
      setQuery(fetcher.data.query ?? query);
      setIsDeleting(false);
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (isProcessing) {
      pollingRef.current = setInterval(() => {
        const fd = new FormData();
        if (jobIdRef.current) fd.append("jobId", jobIdRef.current);
        pollFetcher.submit(fd, { method: "PATCH" });
      }, 3000);
    } else {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [isProcessing]);

  useEffect(() => {
    if (!pollFetcher.data) return;
    if (pollFetcher.data.currentStep !== null && pollFetcher.data.currentStep !== undefined) {
      setConvertStep(Math.min(pollFetcher.data.currentStep, 3));
    }
    if (pollFetcher.data.pdfData && pollFetcher.data.pdfData.length > previousCountRef.current) {
      setPdfList(pollFetcher.data.pdfData);
      setPageInfo(pollFetcher.data.pageInfo);
      setQuery(pollFetcher.data.query ?? query);
      setIsProcessing(false);
      setConvertStep(4);
      jobIdRef.current = null;
      setTimeout(() => setUploadModalPhase("done"), 400);
      if (!showUploadModal) {
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 4000);
      }
      setNewCatalogId(pollFetcher.data.pdfData[0]?.id ?? null);
      previousCountRef.current = pollFetcher.data.pdfData.length;
    }
  }, [pollFetcher.data]);

  const handleFileSelected = (file: File) => {
    if (atLimit) { shopify.toast.show(`Your ${planName} plan allows only ${maxCatalogs} catalog uploads.`); return; }
    if (file.size > maxUploadSizeBytes) { shopify.toast.show(`Your ${planName} plan allows PDF uploads up to ${maxUploadSizeMB} MB.`); return; }
    setUploadModalFile(file);
    setUploadModalPhase("preview");
    setShowUploadModal(true);
    setConvertStep(0);
  };

  const handleUploadFromModal = (file: File, name: string, targetPage: string, targetPageHandle: string, targetPageLabel: string, coverImage: File | null) => {
    setUploadModalPhase("progress");
    setConvertedFileName(name);
    setConvertStep(0);
    const fd = new FormData();
    fd.append("pdf", file);
    fd.append("pdfName", name);
    fd.append("targetPage", targetPage);
    fd.append("targetPageHandle", targetPageHandle);
    fd.append("targetPageLabel", targetPageLabel);
    if (coverImage) fd.append("coverImage", coverImage);
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
  };

  const handleChangeFile = () => { uploadFileRef.current?.click(); };
  const handleCloseUploadModal = () => { setShowUploadModal(false); };

  const handleCopyKey = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    let keys: string[] = [];
    if (deleteTarget === "bulk") {
      keys = pdfList.filter((p) => selectedIds.has(p.id)).map((p) => p.key);
    } else {
      const targetPdf = pdfList.find((p) => p.id === deleteTarget);
      if (targetPdf) keys = [targetPdf.key];
    }
    if (keys.length === 0) { setDeleteTarget(null); return; }
    const fd = new FormData();
    fd.append("keys", JSON.stringify(keys));
    fetcher.submit(fd, { method: "delete" });
    setSelectedIds(new Set());
    setDeleteTarget(null);
    setIsDeleting(true);
  };

  const handlePaginate = (dir: "next" | "prev") => {
    const fd = new FormData();
    fd.append("afterBefore", dir === "next" ? "after" : "before");
    fd.append("firstLast", dir === "next" ? "first" : "last");
    fd.append("pageToken", dir === "next" ? pageInfo?.endCursor : pageInfo?.startCursor);
    fetcher.submit(fd, { method: "put" });
  };

  const filteredList = pdfList.filter((p) => p.pdfName?.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalHotspots = pdfList.reduce((s, p) => s + (p.hotspotCount ?? 0), 0);
  const totalPages = pdfList.reduce((s, p) => s + (p.pageCount ?? 0), 0);
  const allFilteredSelected = filteredList.length > 0 && filteredList.every((p) => selectedIds.has(p.id));

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => { if (allFilteredSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredList.map((p) => p.id))); };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; } }
        .cRow { transition: background 0.1s; cursor: pointer; }
        .cRow:hover { background: #F8FAFC !important; }
        .kPill:hover { background: #EFF6FF !important; border-color: #BFDBFE !important; color: #1A73E8 !important; }
        .dBtn:hover { background: #FEF2F2 !important; color: #DC2626 !important; border-color: #FECACA !important; }
        .eBtn:hover { background: #1557b0 !important; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8EDF2", padding: "16px 32px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 600, color: "#0F172A", margin: "0 0 2px", letterSpacing: "-0.02em" }}>My Catalogs</h1>
            <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>Upload PDFs, tag products, publish to your store</p>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {[
              { label: "Catalogs", value: `${pdfList.length}${maxCatalogs !== Infinity ? ` / ${maxCatalogs}` : ""}` },
              { label: "Pages", value: String(totalPages) },
              { label: "Hotspots", value: String(totalHotspots) },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: "0 18px", borderLeft: i > 0 ? "1px solid #E8EDF2" : "none", textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#0F172A", margin: "0 0 1px", letterSpacing: "-0.02em" }}>{s.value}</p>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "22px 32px" }}>

        {atLimit && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" stroke="#D97706" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <p style={{ fontSize: 13, color: "#92400E", margin: 0 }}>
              You've reached your {planName} plan limit of {maxCatalogs} catalogs.{" "}
              <Link to="/app/subscription" style={{ color: "#1A73E8", textDecoration: "none", fontWeight: 500 }}>Upgrade to add more →</Link>
            </p>
          </div>
        )}

        {!atLimit && (
          <div style={{ background: "#fff", border: "1px solid #E8EDF2", borderRadius: 12, padding: "18px 20px", marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#374151", margin: 0 }}>Upload a new catalog</p>
              {maxCatalogs !== Infinity && (
                <span style={{ fontSize: 11, color: "#94A3B8" }}>
                  {pdfList.length} of {maxCatalogs} slots used
                  <span style={{ display: "inline-block", marginLeft: 8, width: 64, height: 4, background: "#E8EDF2", borderRadius: 99, verticalAlign: "middle", position: "relative", overflow: "hidden" }}>
                    <span style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(pdfList.length / maxCatalogs) * 100}%`, background: "#1A73E8", borderRadius: 99 }} />
                  </span>
                </span>
              )}
            </div>
            <UploadZone onFileSelected={handleFileSelected} maxUploadSizeMB={maxUploadSizeMB} />
          </div>
        )}

        {pdfList.length === 0 && !isProcessing ? (
          <div style={{ padding: "56px 0", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#94A3B8", margin: 0 }}>No catalogs yet — upload your first PDF above to get started.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 13px" }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" stroke="#C4CDD6" strokeWidth="1.75" /><path d="M21 21l-4.35-4.35" stroke="#C4CDD6" strokeWidth="1.75" strokeLinecap="round" /></svg>
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search catalogs…" style={{ border: "none", outline: "none", fontSize: 13, color: "#0F172A", background: "transparent", flex: 1, fontFamily: "inherit" }} />
                {searchQuery && <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>}
              </div>
              {selectedIds.size > 0 && (
                <button className="dBtn" onClick={() => setDeleteTarget("bulk")} style={{ display: "flex", alignItems: "center", gap: 6, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                  <Trash /> Delete {selectedIds.size}
                </button>
              )}
              <span style={{ fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>{filteredList.length} catalog{filteredList.length !== 1 ? "s" : ""}</span>
            </div>

            <div style={{ background: "#fff", border: "1px solid #E8EDF2", borderRadius: 12, overflow: "hidden" }}>
              {/* Column header */}
              <div style={{ display: "grid", gridTemplateColumns: "28px 50px 1fr 90px 58px 60px 130px 90px 116px", alignItems: "center", padding: "9px 16px", gap: 10, background: "#F8FAFC", borderBottom: "1px solid #E8EDF2" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#1A73E8" }} />
                </div>
                {[
                  { label: "Cover", align: "left" },
                  { label: "Catalog name", align: "left" },
                  { label: "Uploaded", align: "left" },
                  { label: "Pages", align: "center" },
                  { label: "Hotspots", align: "center" },
                  { label: "Target page", align: "left" },
                  { label: "PDF Key", align: "left" },
                  { label: "", align: "left" },
                ].map((col) => (
                  <div key={col.label || "actions"} style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", textAlign: col.align as any }}>{col.label}</div>
                ))}
              </div>

              {/* Processing placeholder */}
              {isProcessing && (
                <div onClick={() => setShowUploadModal(true)} style={{ display: "grid", gridTemplateColumns: "28px 50px 1fr 90px 58px 60px 130px 90px 116px", alignItems: "center", padding: "12px 16px", gap: 10, background: "#FFFEF5", borderBottom: "1px solid #FDE68A", cursor: "pointer" }}>
                  <div /><div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 18, height: 18, border: "2px solid #1A73E8", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>
                  <div><p style={{ fontSize: 13, fontWeight: 500, color: "#0F172A", margin: "0 0 2px" }}>{convertedFileName || "New catalog"}</p><p style={{ fontSize: 11, color: "#F59E0B", margin: 0 }}>{UPLOAD_STEPS[convertStep] || "Processing…"}</p></div>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>—</span><div style={{ textAlign: "center" }}><span style={{ fontSize: 12, color: "#94A3B8" }}>—</span></div><div style={{ textAlign: "center" }}><span style={{ fontSize: 12, color: "#94A3B8" }}>—</span></div><span /><span /><span />
                </div>
              )}

              {/* Rows */}
              {filteredList.map((pdf: any, i) => {
                const isCopied = copiedKey === pdf.key;
                const targetInfo = PAGE_TARGETS.find((t) => t.value === pdf.targetPage);
                return (
                  <div key={pdf.id} className="cRow" onClick={() => navigate(`/app/details/${pdf.id}`)}
                    style={{ display: "grid", gridTemplateColumns: "28px 50px 1fr 90px 58px 60px 130px 90px 116px", alignItems: "center", padding: "12px 16px", gap: 10, borderTop: i === 0 && !isProcessing ? "none" : "1px solid #F1F5F9", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(pdf.id)} onChange={() => {}} onClick={(e) => toggleSelect(pdf.id, e)} style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#1A73E8" }} />
                    </div>
                    <div style={{ width: 42, height: 32, borderRadius: 5, overflow: "hidden", background: "#F1F5F9", border: "1px solid #E8EDF2", flexShrink: 0 }}>
                      {pdf.frontPage ? <img src={pdf.frontPage} alt={pdf.pdfName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#CBD5E1" strokeWidth="1.75" strokeLinejoin="round" /></svg></div>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#0F172A", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pdf.pdfName || "Untitled"}</p>
                      <p style={{ fontSize: 11, color: "#B0BAC9", margin: 0 }}>{pdf.size ? `${Number(pdf.size).toFixed(0)} KB` : "—"}</p>
                    </div>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>{pdf.date || "—"}</span>
                    <div style={{ textAlign: "center" }}><span style={{ fontSize: 12, color: "#374151" }}>{pdf.pageCount}</span></div>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: pdf.hotspotCount > 0 ? "#16A34A" : "#94A3B8", background: pdf.hotspotCount > 0 ? "#DCFCE7" : "#F1F5F9", borderRadius: 99, padding: "2px 9px", display: "inline-block" }}>
                        {pdf.hotspotCount} pts
                      </span>
                    </div>
                    {/* Target page badge */}
                    <div>
                      {targetInfo ? (
                        <span style={{ fontSize: 11, color: "#374151", background: "#F1F5F9", border: "1px solid #E8EDF2", borderRadius: 99, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span>{targetInfo.icon}</span> {targetInfo.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>
                      )}
                    </div>
                    <button className="kPill" onClick={(e) => handleCopyKey(pdf.key, e)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#F8FAFC", border: "1px solid #E8EDF2", borderRadius: 6, padding: "4px 9px", fontSize: 11, color: "#64748B", cursor: "pointer", fontFamily: "monospace", transition: "all 0.15s", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isCopied ? <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.75" /></svg>}
                      {isCopied ? "Copied!" : (pdf.key?.substring(0, 10) + "…")}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                      <button className="eBtn" onClick={() => navigate(`/app/details/${pdf.id}`)}
                        style={{ background: "#1A73E8", color: "#fff", border: "none", borderRadius: 7, padding: "6px 13px", fontSize: 12, fontWeight: 500, cursor: "pointer", letterSpacing: "-0.01em", transition: "background 0.15s", whiteSpace: "nowrap" }}>
                        Edit
                      </button>
                      <button className="dBtn" onClick={() => setDeleteTarget(pdf.id)} title="Delete this catalog"
                        style={{ width: 29, height: 29, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", color: "#94A3B8", border: "1px solid #E8EDF2", borderRadius: 7, cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }}>
                        <Trash />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {(pageInfo?.hasPreviousPage || pageInfo?.hasNextPage) && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
                <Pagination hasPrevious={pageInfo?.hasPreviousPage} hasNext={pageInfo?.hasNextPage} onPrevious={() => handlePaginate("prev")} onNext={() => handlePaginate("next")} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── OVERLAYS ── */}
      {/* ── DELETE LOADING OVERLAY ── */}
      {isDeleting && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, boxShadow: "0 24px 64px rgba(15,23,42,0.18)", minWidth: 220 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 22, height: 22, border: "2.5px solid #EF4444", borderTop: "2.5px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", margin: "0 0 4px" }}>Deleting…</p>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>Removing catalog{deleteTarget === "bulk" && selectedIds.size > 1 ? "s" : ""} from your store</p>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && uploadModalFile && (
        <UploadModal
          file={uploadModalFile}
          onClose={handleCloseUploadModal}
          onChangeFile={handleChangeFile}
          onUpload={handleUploadFromModal}
          phase={uploadModalPhase}
          step={convertStep}
          onEdit={() => { setShowUploadModal(false); if (newCatalogId) navigate(`/app/details/${newCatalogId}`); }}
        />
      )}
      {showSuccessToast && <SuccessToast />}
      <input ref={uploadFileRef} type="file" accept=".pdf" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f && f.type === "application/pdf") handleFileSelected(f); if (e.target) e.target.value = ""; }} />
      {deleteTarget && (
        <DeleteModal active={!!deleteTarget} onClose={() => setDeleteTarget(null)} onDelete={handleDeleteConfirm} count={deleteTarget === "bulk" ? selectedIds.size : 1} />
      )}
    </div>
  );
};

export default PdfConvert;