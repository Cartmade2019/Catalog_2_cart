import {
  AppsFilledIcon,
  ClipboardIcon,
  MenuIcon,
  MenuVerticalIcon,
} from "@shopify/polaris-icons";
import { ListBulletedIcon } from "@shopify/polaris-icons";
import { LayoutColumns3Icon } from "@shopify/polaris-icons";
import {
  Text,
  Page,
  LegacyCard,
  EmptyState,
  IndexTable,
  useIndexResourceState,
  Thumbnail,
  Box,
  Grid,
  Icon,
  Button,
  Spinner,
  Pagination,
} from "@shopify/polaris";
import { useState, useRef, useEffect } from "react";
import {
  json,
  unstable_parseMultipartFormData,
  unstable_createFileUploadHandler,
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import path from "path";
import {
  extractImagesFromPDF,
  generateRandomString,
  sleep,
  uploadImage,
} from "../utils/utils";
import { apiVersion, authenticate } from "../shopify.server";
import axios from "axios";
import fs from "fs";
import { pageInformation, PDFVALUES } from "../constants/types";
import { useDispatch, useSelector } from "react-redux";
import { addPlan } from "../store/slices/planSlice";
import DeleteModal from "../components/DeleteModal";
import { pollFileStatus } from "../utils/utils";

let valueToFetch = 2;
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop, accessToken } = session;
  if (!accessToken) return;

  if (request.method === "POST" || request.method === "post") {
    const uploadHandler = unstable_createFileUploadHandler({
      directory: path.join(process.cwd(), "public", "uploads"),
      maxPartSize: 5_000_000,
      file: ({ filename }) => filename,
    });

    const formData = await unstable_parseMultipartFormData(
      request,
      uploadHandler,
    );

    const pdf = formData.get("pdf") as File;
    const pdfName: any = formData.get("pdfName") || pdf?.name || "Untitled PDF";
    const view = (formData.get("view") as string) || "list";
    if (!pdf) return json({ error: "No file uploaded" }, { status: 400 });

    const pdfPath = path.join(process.cwd(), "public", "uploads", pdf.name);

    const pdfStats = fs.statSync(pdfPath);
    const pdfSizeInBytes = pdfStats.size;

    const pdfSizeInKB = (pdfSizeInBytes / 1024).toFixed(2);
    const imageUrls = await extractImagesFromPDF(pdfPath);
    const readedUrls = [];

    for (let url of imageUrls) {
      const imagePath = path.join(process.cwd(), "public", url);
      const imageBuffer = fs.readFileSync(imagePath);
      readedUrls.push(imageBuffer);
    }

    const uploadedImages = [];

    for (const imageBuffer of readedUrls) {
      const resourceUrl = await uploadImage(
        imageBuffer,
        shop,
        accessToken,
        apiVersion,
      );
      uploadedImages.push(resourceUrl);
    }

    const createFileQuery = `mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        alt
         fileStatus
        id
        preview{
        image{
            url
            id
            height
            width
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }`;

    const createFileVariables = {
      files: uploadedImages.map((url) => ({
        alt: "alt-tag",
        contentType: "IMAGE",
        originalSource: url,
      })),
    };

    const createFileQueryResult = await axios.post(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        query: createFileQuery,
        variables: createFileVariables,
      },
      {
        headers: {
          "X-Shopify-Access-Token": `${accessToken}`,
        },
      },
    );

    const fileIds = createFileQueryResult.data.data.fileCreate.files.map(
      (file: any) => file.id,
    );
    const previewUrls = await pollFileStatus(shop, accessToken, fileIds);

    const key = generateRandomString();

    const metafieldData = {
      namespace: "PDF",
      key: key,

      value: JSON.stringify({
        pdfName: pdfName,
        pdfSizeInKB,
        view,
        date: new Date().toLocaleDateString(),
        images: previewUrls.map((data: any, index: number) => ({
          id: index + 1,
          url: data.preview.image.url,
          points: [],
        })),
      }),
      type: "json",
      owner_resource: "shop",
    };

    const { data: imageData } = await axios.post(
      `https://${shop}/admin/api/${apiVersion}/metafields.json`,
      { metafield: metafieldData },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      },
    );

    if (!imageData) {
      return json({ error: "Failed to save metafield" }, { status: 400 });
    }
    // Delete temporary uploaded images

    imageUrls.forEach((url) => {
      const imagePath = path.join(process.cwd(), "public", url);
      fs.unlink(imagePath, (err) => {
        if (err) console.error(`Error deleting file ${imagePath}:`, err);
      });
    });

    fs.unlink(pdfPath, (err) => {
      if (err) console.error(`Error deleting file ${pdfPath}:`, err);
    });

    return json({
      success: true,
      message: "PDF uploaded successfully",
      imageData,
    });
  } else if (request.method === "DELETE" || request.method === "delete") {
    const formData = await request.formData();
    const metafieldIds: any = formData.get("metafieldIds");
    const query = formData.get("query") as string;
    if (!metafieldIds) {
      return json({ error: "No metafieldId provided" }, { status: 400 });
    }
    const idsArray = JSON.parse(metafieldIds);

    if (!Array.isArray(idsArray) || idsArray.length === 0) {
      return json({ error: "Invalid metafieldIds provided" }, { status: 400 });
    }

    const DELETE_META_FIELD = `
      mutation DeleteMetafield($id: ID!) {
        metafieldDelete(input: { id: $id }) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const deletePromises = idsArray.map((id) => {
        const formattedId = `gid://shopify/Metafield/${id}`;

        return admin.graphql(DELETE_META_FIELD, {
          variables: {
            id: formattedId,
          },
        });
      });
      const results = await Promise.all(deletePromises);

      results.forEach(async (response) => {
        const data = await response.json();
        if (!data) {
          return json({ error: "Unable to remove metafield" }, { status: 400 });
        }
      });
      const data = await admin.graphql(query);

      if (!data) {
        console.error("Failed to fetch PDF metafield");
        return { error: "Failed to fetch PDF metafield." };
      }
      const response = await data.json();
      const pageInfo = response.data.shop.metafields.pageInfo;
      const pdfMetafields = response.data.shop.metafields.edges.map(
        (edge: any) => edge.node,
      );
      if (!pdfMetafields.length) {
        console.warn("No PDF metafields found.");
        return {
          pdfData: [],

          pageInfo,
          query: query,
        };
      }

      const actualResponse = pdfMetafields.map((pdf: any) => ({
        id: pdf.id.split("/")[pdf.id.split("/").length - 1],
        pdfName:
          pdf.jsonValue.pdfName !== null
            ? pdf.jsonValue?.pdfName
            : "Untitled Document",
        frontPage:
          pdf.jsonValue.images !== null ? pdf.jsonValue?.images[0]?.url : "",
        allImages: pdf.jsonValue.images !== null ? pdf.jsonValue?.images : [],
        size: pdf.jsonValue.pdfSizeInKB || "",
        date: pdf.jsonValue.date || "",
        key: pdf.key,
        namespace: pdf.namespace,
        view: pdf.jsonValue.view,
      }));

      return {
        pdfData: actualResponse,
        pageInfo,
        query: query,
      };
    } catch (error: any) {
      console.error(error, "Errors");
      console.error(error?.body.errors, "Errorsssssssssssss");
      return { message: "something went wrong" };
    }
  } else if (request.method === "put" || request.method === "PUT") {
    const formData = await request.formData();
    const afterBefore = formData.get("afterBefore") as "after" | "before";
    const firstLast = formData.get("firstLast") as "last" | "first";
    const pageToken = formData.get("pageToken") as string | "";
    const { data: pricePlan } = await axios.get(
      `https://${shop}/admin/api/${apiVersion}/recurring_application_charges.json        `,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
        },
      },
    );

    const GET_PDF_QUERY = `
    query GetPDFQuery {
      shop {
        metafields(${firstLast}: ${valueToFetch} , reverse:true namespace: "PDF" ${afterBefore}:"${pageToken}") {
            pageInfo {
            hasPreviousPage
            hasNextPage
            startCursor
            endCursor
        }
          edges {
            node {
              id
              namespace
              key
              jsonValue
              type
            }
          }
        }
      }
    }
  `;

    try {
      const data = await admin.graphql(GET_PDF_QUERY);

      if (!data) {
        console.error("Failed to fetch PDF metafield");
        return { error: "Failed to fetch PDF metafield." };
      }
      const response = await data.json();
      const pageInfo = response.data.shop.metafields.pageInfo;
      const pdfMetafields = response.data.shop.metafields.edges.map(
        (edge: any) => edge.node,
      );
      if (!pdfMetafields.length) {
        console.warn("No PDF metafields found.");
        return {
          pdfData: [],
          pricePlan: pricePlan.recurring_application_charges[0],
          pageInfo,
          query: GET_PDF_QUERY,
        };
      }

      const actualResponse = pdfMetafields.map((pdf: any) => ({
        id: pdf.id.split("/")[pdf.id.split("/").length - 1],
        pdfName:
          pdf.jsonValue.pdfName !== null
            ? pdf.jsonValue?.pdfName
            : "Untitled Document",
        frontPage:
          pdf.jsonValue.images !== null ? pdf.jsonValue?.images[0]?.url : "",
        allImages: pdf.jsonValue.images !== null ? pdf.jsonValue?.images : [],
        size: pdf.jsonValue.pdfSizeInKB || "",
        date: pdf.jsonValue.date || "",
        key: pdf.key,
        namespace: pdf.namespace,
        view: pdf.jsonValue.view,
      }));

      return {
        pdfData: actualResponse,
        pricePlan: pricePlan.recurring_application_charges[0],
        pageInfo,
        query: GET_PDF_QUERY,
      };
    } catch (error) {
      console.error("Error fetching PDF metafields:", error);
      return { error: "Unexpected error occurred while fetching metafields." };
    }
  }
  return json({ error: "Unknown method" }, { status: 400 });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    admin,
    session: { accessToken, shop },
  } = await authenticate.admin(request);
  const { data: pricePlan } = await axios.get(
    `https://${shop}/admin/api/${apiVersion}/recurring_application_charges.json        `,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
    },
  );

  const GET_PDF_QUERY = `
      query GetPDFQuery {
        shop {
          metafields(first: ${valueToFetch}, namespace: "PDF" reverse:true) {
              pageInfo {
              hasPreviousPage
              hasNextPage
              startCursor
              endCursor
          }
            edges {
              node {
                id
                namespace
                key
                jsonValue
                type
              }
            }
          }
        }
      }
    `;

  try {
    const data = await admin.graphql(GET_PDF_QUERY);

    if (!data) {
      console.error("Failed to fetch PDF metafield");
      return { error: "Failed to fetch PDF metafield." };
    }
    const response = await data.json();
    const pageInfo = response.data.shop.metafields.pageInfo;
    const pdfMetafields = response.data.shop.metafields.edges.map(
      (edge: any) => edge.node,
    );
    if (!pdfMetafields.length) {
      console.warn("No PDF metafields found.");
      return {
        pdfData: [],
        pricePlan: pricePlan.recurring_application_charges[0],
        pageInfo,
        query: GET_PDF_QUERY,
      };
    }

    const actualResponse = pdfMetafields.map((pdf: any) => ({
      id: pdf.id.split("/")[pdf.id.split("/").length - 1],
      pdfName:
        pdf.jsonValue.pdfName !== null
          ? pdf.jsonValue?.pdfName
          : "Untitled Document",
      frontPage:
        pdf.jsonValue.images !== null ? pdf.jsonValue?.images[0]?.url : "",
      allImages: pdf.jsonValue.images !== null ? pdf.jsonValue?.images : [],
      size: pdf.jsonValue.pdfSizeInKB || "",
      date: pdf.jsonValue.date || "",
      key: pdf.key,
      namespace: pdf.namespace,
      view: pdf.jsonValue.view,
    }));

    return {
      pdfData: actualResponse,
      pricePlan: pricePlan.recurring_application_charges[0],
      pageInfo,
      query: GET_PDF_QUERY,
    };
  } catch (error) {
    console.error("Error fetching PDF metafields:", error);
    return { error: "Unexpected error occurred while fetching metafields." };
  }
};

const PDFConverter = () => {
  const loader = useLoaderData<PDFVALUES>();
  const fetcher = useFetcher<PDFVALUES>();
  const dispatch = useDispatch();
  const { pageInfo } = fetcher.data?.pageInfo ? fetcher.data : loader;

  const { pdfData } =
    fetcher.data?.pdfData && fetcher.data.pdfData.length
      ? fetcher.data
      : loader;
  const { query } = fetcher.data?.query ? fetcher.data : loader;

  const [pageInformation, setPageInformation] = useState<pageInformation>({
    endCursor: "",
    startCursor: "",
    hasNextPage: true,
    hasPreviousPage: false,
  });
  const plan = useSelector((state: any) => state.plan.plan);
  const planType = plan || "Free";
  const maxUploads =
    planType === "Free" ? 1 : planType === "Basic" ? 5 : Infinity;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(pdfData ? pdfData.length : 0);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<string>("list");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaginationLoading, setIsPaginationLoading] =
    useState<boolean>(false);
  const [modalActive, setModalActive] = useState(false);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(key);
      shopify.toast.show("Copied to clipboard");
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    });
  };

  const handleNextPagination = async () => {
    setIsPaginationLoading(true);

    const formData = new FormData();
    formData.append("afterBefore", "after");
    formData.append("firstLast", "first");
    formData.append("pageToken", pageInformation.endCursor);
    fetcher.submit(formData, { method: "put" });
  };

  const handlePrevPagination = async () => {
    setIsPaginationLoading(true);
    const formData = new FormData();
    formData.append("afterBefore", "before");
    formData.append("firstLast", "last");
    formData.append("pageToken", pageInformation.startCursor);
    fetcher.submit(formData, { method: "put" });
  };

  const handlePdfDelete = () => {
    const formData = new FormData();
    formData.append("metafieldIds", JSON.stringify(selectedResources));
    formData.append("query", query);
    fetcher.submit(formData, { method: "delete" });
    selectedResources.splice(0, selectedResources.length);
  };

  useEffect(() => {
    setUploadCount(pdfData ? pdfData.length : 0);
    setPageInformation(pageInfo);
    setIsPaginationLoading(false);
    setIsLoading(false);
    dispatch(addPlan(loader.pricePlan && loader?.pricePlan?.name));
  }, [loader.pricePlan && loader?.pricePlan.name, pdfData, pageInfo]);

  const handleFileChange = () => {
    if (uploadCount >= maxUploads) {
      alert(
        `You can only upload up to ${maxUploads} PDFs based on your current plan.`,
      );
      return;
    }
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("buttonView", view);
      fetcher.submit(formData, {
        method: "post",
        encType: "multipart/form-data",
      });
      setUploadCount(uploadCount + 1);
      fileInputRef.current.value = "";
    }
  };

  if (isPaginationLoading) {
    shopify.loading(isPaginationLoading);
  }

  // typeof shopify != "undefined" && shopify.loading(isPaginationLoading);

  const handleModalOpen = () => {
    setModalActive(true);
  };

  const handleModalClose = () => {
    setModalActive(false);
  };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(pdfData, {
      selectedResources: [],
      resourceIDResolver: (resource) => resource.id,
    });
  const rowMarkup =
    pdfData?.length &&
    pdfData?.map(({ id, pdfName, frontPage, key, date, size }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            <div className="flex items-center text-xs font-normal text-gray-700 font- gap-2">
              <Thumbnail alt={pdfName} source={frontPage} size="medium" />
              <span
                onClick={() => navigate(`/app/details/${id}`)}
                className="hover:underline"
              >
                {pdfName}
              </span>
            </div>
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell> {date}</IndexTable.Cell>
        <IndexTable.Cell>{size} KB</IndexTable.Cell>
        <IndexTable.Cell>
          <p
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleCopyKey(key)}
          >
            <span className="p-1 relative px-2 shadow-md text-xs text-black rounded-md cursor-pointer hover:bg-black hover:text-white capitalize transition-colors">
              {copiedKey === key ? "copied" : "copy key "}
            </span>
          </p>
        </IndexTable.Cell>
      </IndexTable.Row>
    ));

  const promotedBulkActions = [
    {
      destructive: true,
      content: "Delete PDF",
      onAction: handleModalOpen,
    },
  ];

  const resourceName = {
    singular: "PDF",
    plural: "PDFs",
  };
  return (
    <Page
      backAction={{ content: "Settings", url: "/app" }}
      actionGroups={[
        {
          title: view.toUpperCase(),
          icon: AppsFilledIcon,
          actions: [
            {
              content: "List",
              icon: LayoutColumns3Icon,
              onAction: () => setView("list"),
              active: view === "list",
            },
            {
              content: "Grid",
              icon: ListBulletedIcon,
              onAction: () => setView("grid"),
              active: view === "grid",
            },
          ],
        },
      ]}
      primaryAction={{
        loading: isLoading,
        content: "Upload PDF",
        onAction: () => {
          if (uploadCount >= maxUploads) {
            shopify.toast.show(
              `You can only upload up to ${maxUploads} PDFs based on your current plan.`,
            );
          } else {
            fileInputRef.current?.click();
          }
        },
      }}
      title="PDFs"
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
        name="pdf"
        id="pdfupload"
      />

      {/* Main section  */}
      <DeleteModal
        active={modalActive}
        onClose={handleModalClose}
        onDelete={handlePdfDelete}
      />

      {!pdfData || !pdfData.length ? (
        <LegacyCard sectioned>
          <EmptyState
            heading="Manage your Pdfs"
            action={{
              content: "Upload PDF",
              onAction: () => {
                if (uploadCount >= maxUploads) {
                  shopify.toast.show(
                    `You can only upload up to ${maxUploads} PDFs based on your current plan.`,
                  );
                } else {
                  fileInputRef.current?.click();
                }
              },
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Manage and organize your PDF documents with ease, ensuring quick
              access and efficient storage.
            </p>
          </EmptyState>
        </LegacyCard>
      ) : view === "list" ? (
        <div className="relative">
          <Box paddingBlockEnd="400">
            {isPaginationLoading ? (
              <div className=" absolute z-[999] right-2 top-2">
                <Spinner size="small" />
              </div>
            ) : null}
            <LegacyCard>
              <IndexTable
                resourceName={resourceName}
                itemCount={pdfData?.length || 0}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources?.length
                }
                promotedBulkActions={promotedBulkActions}
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: "File Name" },
                  { title: "Date" },
                  { title: "Size" },
                  { title: "PDF key" },
                ]}
                pagination={{
                  hasNext: pageInformation?.hasNextPage && !isPaginationLoading,
                  hasPrevious:
                    pageInformation?.hasPreviousPage && !isPaginationLoading,
                  onNext: () => handleNextPagination(),
                  onPrevious: () => handlePrevPagination(),
                }}
              >
                {rowMarkup}
              </IndexTable>
            </LegacyCard>
          </Box>
        </div>
      ) : (
        <>
          <Grid>
            {pdfData?.map(({ id, pdfName, frontPage, key }, index) => (
              <Grid.Cell
                columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}
                key={id}
              >
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
                  <LegacyCard sectioned>
                    {/* Card Header */}
                    <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200">
                      <p className="text-lg font-semibold text-gray-700">
                        PDF Details {index + 1}
                      </p>
                    </div>

                    {/* Card Body */}
                    <div className="px-6 py-4">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="flex-shrink-0">
                          <Thumbnail
                            alt={pdfName}
                            source={frontPage}
                            size="large"
                          />
                        </div>
                        <div className="flex flex-col justify-between w-full">
                          <span
                            onClick={() => navigate(`/app/details/${id}`)}
                            className="text-xl font-semibold text-gray-800 hover:text-blue-600 cursor-pointer truncate"
                          >
                            {pdfName.slice(0, 15)}.pdf
                          </span>
                          <span className="text-sm text-gray-500">
                            Uploaded on Jul 20 at 3:46pm
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center space-x-4">
                        {/* File Size */}
                        <div className="text-sm text-gray-500">
                          Size: 647 KB
                        </div>

                        <div
                          onClick={() => handleCopyKey(key)}
                          className="flex  items-center text-sm text-blue-500 w-28 hover:bg-blue-50 px-3 py-1 rounded-md  cursor-pointer"
                        >
                          <p className="flex items-center ">
                            <Icon source={ClipboardIcon} tone="base" />
                            <span className="font-medium">
                              {copiedKey === key ? "Copied" : "Copy Key"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </LegacyCard>
                </div>
              </Grid.Cell>
            ))}
          </Grid>
          <div className="mt-2">
            <Pagination
              hasNext={pageInformation?.hasNextPage && !isPaginationLoading}
              hasPrevious={
                pageInformation?.hasPreviousPage && !isPaginationLoading
              }
              onNext={handleNextPagination}
              onPrevious={handlePrevPagination}
            />
          </div>
        </>
      )}
    </Page>
  );
};

export default PDFConverter;
