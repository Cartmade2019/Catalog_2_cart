import { Button, ButtonGroup, Page } from "@shopify/polaris";
import { useCallback, useState } from "react";
import { buttonsName } from "../config/config";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { apiVersion, authenticate } from "../shopify.server";

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
          buttonText,
          fontSize: parseInt(fontSize),
          borderRadius: parseInt(borderRadius),
          borderWidth: parseInt(borderWidth),
          paddingX: parseInt(paddingX),
          paddingY: parseInt(paddingY),
          shadow: parseInt(shadow),
          shadowColor,
          borderColor,
          hotspotColor,
          backgroundColor,
          textColor,
        }),
        type: "json",
        owner_resource: "shop",
      };

      const response = await fetch(
        `https://${shop}/admin/api/${apiVersion}/metafields.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({ metafield: metafieldData }),
        },
      );

      const responseData = await response.json();
      if (!response.ok) {
        return json(
          { error: responseData.errors || "Failed to save metafield" },
          { status: response.status },
        );
      }
      return json({
        message: "Public metafield saved successfully",
        data: responseData,
      });
    } else if (source === "TooltipSettings") {
      const backgroundColor = formData.get("backgroundColor");
      const fontColor = formData.get("fontColor");
      const priceColor = formData.get("priceColor");
      const metafieldData = {
        namespace: "cartmade",
        key: "cod_tooltip_settings",
        value: JSON.stringify({
          backgroundColor,
          fontColor,
          priceColor,
        }),
        type: "json",
        owner_resource: "shop",
      };

      const response = await fetch(
        `https://${shop}/admin/api/${apiVersion}/metafields.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({ metafield: metafieldData }),
        },
      );

      const responseData = await response.json();
      if (!response.ok) {
        return json(
          { error: responseData.errors || "Failed to save metafield" },
          { status: response.status },
        );
      }
      return json({
        message: "Public metafield saved successfully",
        data: responseData,
      });
    }
    return 1;
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const fetchMetafield = async (namespace: string, key: string) => {
    const query = `
      query GetMetafield {
        shop {
          metafield(namespace: "${namespace}", key: "${key}") {
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
    const [buttonSettings, tooltipSettings] = await Promise.all([
      fetchMetafield("cartmade", "cod_button_settings"),
      fetchMetafield("cartmade", "cod_tooltip_settings"),
    ]);

    if (!buttonSettings && !tooltipSettings) {
      return { error: "No metafield data found." };
    }

    return {
      buttonSettings,
      tooltipSettings,
    };
  } catch (error) {
    console.error("Error fetching metafields:", error);
    return { error: "Unexpected error occurred while fetching metafields." };
  }
};

const GlobalSettings = () => {
  const [activeButton, setActiveButton] = useState<string>("app");
  const loaderData = useLoaderData<any>();
  const handleButtonClick = useCallback(
    (link: string) => {
      if (activeButton === link) return;
      setActiveButton(link);
    },
    [activeButton],
  );

  const buttonSettings = loaderData?.buttonSettings || {};
  const tooltipSettings = loaderData?.tooltipSettings || {};

  const ActiveComponent = buttonsName.find(
    ({ link }) => link === activeButton,
  )?.component;

  return (
    <Page title="Global Settings">
      <ButtonGroup variant="segmented" gap="loose">
        {buttonsName &&
          buttonsName.length &&
          buttonsName.map(({ index, name, link }) => (
            <Button
              key={index}
              onClick={() => handleButtonClick(link)}
              pressed={link === activeButton}
            >
              {name}
            </Button>
          ))}
      </ButtonGroup>

      <div className="mt-6">
        {ActiveComponent && (
          <ActiveComponent
            {...(activeButton === "buttonDesign" ||
            activeButton === "tooltipDesign"
              ? { buttonSettings, tooltipSettings }
              : {})}
          />
        )}
      </div>
    </Page>
  );
};

export default GlobalSettings;
