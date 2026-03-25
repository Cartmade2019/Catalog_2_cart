import { json } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import PageFlip from "../components/PageFlip";

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
        id
        namespace
        key
        value
        jsonValue
        type
      }
    }
  }
`;

  const GET_BUTTON_SETTINGS_QUERY = `
  query GetButtonSettings {
    shop {
      metafield(namespace: "cartmade", key: "cod_button_settings") {
        id
        key
        value
        jsonValue
        type
        updatedAt
      }
    }
  }
`;

  const response = await admin.graphql(META_FIELD_QUERY, {
    variables: {
      id: metafieldId,
    },
  });
  const data = await admin.graphql(GET_BUTTON_SETTINGS_QUERY);
  if (!data) return { error: "No data found" };
  const buttonResponse = await data.json();
  if (!buttonResponse.data) {
    console.error("GraphQL errors:", "Failed to fetch settings");
    return { error: "Failed to fetch button settings metafield." };
  }
  const buttonSettings = buttonResponse?.data?.shop?.metafield;
  const hotspotColor = buttonSettings?.jsonValue?.hotspotColor;
  {
    try {
      const { data } = await response.json();
      if (!data) {
        console.warn("No PDF metafield found.");
        return { error: "Pdf not found." };
      }
      const pdfData = {
        id: data.node.id,
        pdfName: data.node.jsonValue.pdfName,
        images: data.node.jsonValue.images,
      };
      return json({ pdfData, shop, hotspotColor });
    } catch (error) {
      console.error("Error fetching PDF metafields:", error);
      return { error: "Unexpected error occurred while fetching metafield." };
    }
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "POST") {
    const { admin, session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const id = Number(url.pathname.split("/").pop());
    const formdata: any = await request.formData();
    const images = formdata.get("images");
    const pdfName = formdata.get("pdfName");

    if (typeof images !== "string") {
      return {
        error: "Invalid image data. Please upload valid images.",
        images,
        pdfName,
      };
    } else {
      const metafield = new admin.rest.resources.Metafield({
        session: session,
      });
      metafield.id = id;
      metafield.value = JSON.stringify({
        pdfName: pdfName || "Undefined",
        images: JSON.parse(images) || [],
      });
      metafield.type = "json";

      await metafield.save({
        update: true,
      });

      if (!metafield) {
        console.warn("Failed to save metafield");
        return { error: "Failed to save metafield" };
      }
      return {
        success: true,
        message: "metafield updated successfully",
        metafield,
      };
    }
  }
  return null;
};
const DetailPage = () => {
  const loaderData: any = useLoaderData();
  const { pdfData }: any = useLoaderData();
  return (
    <div>
      <PageFlip
        pdfName={pdfData.pdfName}
        images={pdfData.images}
        metaFieldId={pdfData.id}
        shopName={loaderData.shop}
        hotspotColor={loaderData.hotspotColor}
      />
    </div>
  );
};

export default DetailPage;
