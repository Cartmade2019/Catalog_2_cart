const NAMESPACE = "custom";
const KEY = "app_install_state";

export async function getInstallState(admin: any) {
  const response = await admin.graphql(`
    #graphql
    query GetInstallState {
      shop {
        id
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
          id
          value
        }
      }
    }
  `);

  const result = await response.json();
  const metafield = result?.data?.shop?.metafield;

  if (!metafield?.value) return null;

  try {
    return JSON.parse(metafield.value);
  } catch {
    return null;
  }
}

export async function setInstallState(
  admin: any,
  state: {
    installed_once: boolean;
    last_event: "install" | "uninstall" | "reinstall";
    last_installed_at?: string;
    store_email?: string;
    store_name?: string;
    shopify_domain?: string;
    configured_domain?: string;
    store_owner_name?: string;
  }
) {
  const shopResponse = await admin.graphql(`
    #graphql
    query GetShopId {
      shop {
        id
      }
    }
  `);

  const shopResult = await shopResponse.json();
  const shopId = shopResult?.data?.shop?.id;

  const response = await admin.graphql(
    `#graphql
    mutation SetInstallState($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: NAMESPACE,
            key: KEY,
            type: "json",
            value: JSON.stringify(state),
          },
        ],
      },
    }
  );

  const result = await response.json();
  const errors = result?.data?.metafieldsSet?.userErrors;

  if (errors?.length) {
    throw new Error(`Failed to save install state: ${JSON.stringify(errors)}`);
  }
}