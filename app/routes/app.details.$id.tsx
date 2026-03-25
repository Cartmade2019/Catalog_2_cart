import { json } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import PageFlip from "../components/PageFlip";
import { Page, Badge, InlineStack, BlockStack, Text } from "@shopify/polaris";

// ── Loader ────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const {
    admin,
    session: { shop },
  } = await authenticate.admin(request);

  const metafieldId = `gid://shopify/Metafield/${id}`;

  const META_FIELD_QUERY = `
  query getMetafield($id: ID!) {
    node(id: $id) {
      ... on Metafield {
        id namespace key value jsonValue type
      }
    }
  }
`;

  const GET_BUTTON_SETTINGS_QUERY = `
  query GetButtonSettings {
    shop {
      metafield(namespace: "cartmade", key: "cod_button_settings") {
        id key value jsonValue type updatedAt
      }
    }
  }
`;

  const response = await admin.graphql(META_FIELD_QUERY, { variables: { id: metafieldId } });
  const data = await admin.graphql(GET_BUTTON_SETTINGS_QUERY);
  if (!data) return { error: "No data found" };

  const buttonResponse = await data.json();
  if (!buttonResponse.data) return { error: "Failed to fetch button settings metafield." };

  const buttonSettings = buttonResponse?.data?.shop?.metafield;
  const hotspotColor = buttonSettings?.jsonValue?.hotspotColor;

  try {
    const { data } = await response.json();
    if (!data) return { error: "Pdf not found." };

    const pdfData = {
      id: data.node.id,
      pdfName: data.node.jsonValue.pdfName,
      images: data.node.jsonValue.images,
    };
    return json({ pdfData, shop, hotspotColor });
  } catch (error) {
    return { error: "Unexpected error occurred while fetching metafield." };
  }
};

// ── Action ────────────────────────────────────────────────────────────────
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "POST") {
    const { admin, session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const id = Number(url.pathname.split("/").pop());
    const formdata: any = await request.formData();
    const images = formdata.get("images");
    const pdfName = formdata.get("pdfName");

    if (typeof images !== "string") {
      return { error: "Invalid image data. Please upload valid images.", images, pdfName };
    }

    const metafield = new admin.rest.resources.Metafield({ session });
    metafield.id = id;
    metafield.value = JSON.stringify({
      pdfName: pdfName || "Undefined",
      images: JSON.parse(images) || [],
    });
    metafield.type = "json";
    await metafield.save({ update: true });

    if (!metafield) return { error: "Failed to save metafield" };
    return { success: true, message: "metafield updated successfully", metafield };
  }
  return null;
};

// ── UI Component ──────────────────────────────────────────────────────────
const DetailPage = () => {
  const loaderData: any = useLoaderData();
  const { pdfData }: any = useLoaderData();

  if (loaderData?.error) {
    return (
      <Page backAction={{ content: "PDF Catalogs", url: "/app/pdf-convert" }} title="Catalog not found">
        <div style={{ padding: "40px 0", display: "flex", justifyContent: "center" }}>
          <p-banner title="Error loading catalog" tone="critical">
            {loaderData.error}
          </p-banner>
        </div>
      </Page>
    );
  }

  const pageCount = pdfData?.images?.length ?? 0;
  const hotspotTotal = pdfData?.images?.reduce(
    (sum: number, img: any) => sum + (img.points?.length ?? 0),
    0,
  );

  return (
    <Page
      backAction={{ content: "PDF Catalogs", url: "/app/pdf-convert" }}
      title={pdfData?.pdfName || "Catalog Editor"}
      titleMetadata={
        <InlineStack gap="200">
          <Badge tone="info">{pageCount} {pageCount === 1 ? "page" : "pages"}</Badge>
          {hotspotTotal > 0 && (
            <Badge tone="success">{hotspotTotal} hotspot{hotspotTotal !== 1 ? "s" : ""}</Badge>
          )}
        </InlineStack>
      }
      subtitle="Click any spot on a catalog page to add a product hotspot"
      secondaryActions={[
        {
          content: "Global settings",
          url: "/app/global-settings",
          accessibilityLabel: "Go to global settings",
        },
      ]}
    >
      {/* ── Usage tip ── */}
      <div style={{ marginBottom: 16 }}>
        <p-banner tone="info" dismissible>
          <strong>Tip:</strong> Click anywhere on a page to drop a hotspot pin.
          Search for a product, save — and your catalog is instantly shoppable.
        </p-banner>
      </div>

      {/* ── PageFlip editor ── */}
      <div
        style={{
          background: "var(--p-color-bg-surface, #ffffff)",
          border: "1px solid var(--p-color-border, #e3e3e3)",
          borderRadius: "var(--p-border-radius-300, 12px)",
          overflow: "hidden",
        }}
      >
        <PageFlip
          pdfName={pdfData.pdfName}
          images={pdfData.images}
          metaFieldId={pdfData.id}
          shopName={loaderData.shop}
          hotspotColor={loaderData.hotspotColor}
        />
      </div>

      {/* ── Bottom help strip ── */}
      <div
        style={{
          marginTop: 16,
          padding: "14px 20px",
          background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
          borderRadius: "var(--p-border-radius-200, 8px)",
          border: "1px solid var(--p-color-border, #e3e3e3)",
        }}
      >
        <BlockStack gap="100">
          <Text as="p" variant="bodySm" tone="subdued">
            <strong>Keyboard shortcut:</strong> Press <kbd style={{ background: "#e3e3e3", padding: "1px 5px", borderRadius: 3, fontFamily: "monospace" }}>Esc</kbd> to deselect a hotspot.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Changes are saved automatically when you link a product to a hotspot.
          </Text>
        </BlockStack>
      </div>
    </Page>
  );
};

export default DetailPage;