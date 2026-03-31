export async function getShopData(admin: any, fallbackShop: string) {
    const response = await admin.graphql(`
      #graphql
      query ShopInfo {
        shop {
          name
          email
          myshopifyDomain
          primaryDomain {
            url
          }
          billingAddress {
            firstName
            lastName
          }
        }
      }
    `);
  
    const result = await response.json();
    const shopData = result?.data?.shop;
  
    return {
      store_name: shopData?.name || fallbackShop,
      store_email: shopData?.email || "",
      shopify_domain: shopData?.myshopifyDomain || fallbackShop,
      configured_domain: shopData?.primaryDomain?.url || "",
      store_owner_name: [shopData?.billingAddress?.firstName, shopData?.billingAddress?.lastName]
        .filter(Boolean)
        .join(" "),
    };
  }