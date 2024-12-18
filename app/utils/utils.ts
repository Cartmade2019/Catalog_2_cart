import { fromPath } from "pdf2pic";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import { PDFDocument } from "pdf-lib";

async function countPdfPages(filePath: string) {
  const pdfBytes = await fs.readFile(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

export const extractImagesFromPDF = async (
  pdfPath: string,
): Promise<string[]> => {
  const outputDir = path.dirname(pdfPath);
  const outputPrefix = path.basename(pdfPath, path.extname(pdfPath));

  const options = {
    density: 100,
    saveFilename: outputPrefix,
    savePath: outputDir,
    format: "png",
    width: 1655,
    height: 2339,
  };
  const totalPages = await countPdfPages(pdfPath);
  const convert = fromPath(pdfPath, options);

  const imageUrls: string[] = [];
  for (let page = 1; page <= totalPages; page++) {
    try {
      const resolve = await convert(page, { responseType: "image" });
      const imagePath: any = resolve.path;
      const imageUrl = `/uploads/${path.basename(imagePath)}`;
      imageUrls.push(imageUrl);
    } catch (err) {
      console.error(`Error converting page to image:`, err);
    }
  }

  return imageUrls;
};
export const uploadToShopify = async (
  imagePaths: string[],
  shop: string,
  accessToken: string,
) => {
  const uploadPromises = imagePaths.map(async (imagePath: string) => {
    try {
      const imageBuffer = await fs.readFile(
        path.join(process.cwd(), "public", imagePath),
      );

      const base64Image = imageBuffer.toString("base64");

      const query = `
     mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            alt
            createdAt
          }
        }
}
      `;

      const variables = {
        files: [
          {
            alt: "PDF extracted image",
            contentType: "IMAGE",
            originalSource: `data:image/png;base64,${base64Image}`,
          },
        ],
      };

      await axios.post(
        `https://${shop}/admin/api/2024-10/graphql.json`,
        { query, variables },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
        },
      );

      return "11";
    } catch (error: any) {
      console.error(`Error uploading image at ${imagePath}:`, error.message);
      throw error;
    }
  });

  // Wait for all uploads to finish
  return Promise.all(uploadPromises);
};

export const uploadImage = async (
  imageBuffer: any,
  shop: string,
  accessToken: any,
  apiVersion: string,
) => {
  const stagedUploadsQuery = `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        resourceUrl
        url
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }`;

  const stagedUploadsVariables = {
    input: {
      filename: "image.jpg",
      httpMethod: "POST",
      mimeType: "image/jpeg",
      resource: "FILE",
    },
  };

  const stagedUploadsQueryResult = await axios.post(
    `https://${shop}/admin/api/${apiVersion}/graphql.json`,
    {
      query: stagedUploadsQuery,
      variables: stagedUploadsVariables,
    },
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
    },
  );

  const target =
    stagedUploadsQueryResult.data.data.stagedUploadsCreate.stagedTargets[0];
  const params = target.parameters;
  const url = target.url;
  const resourceUrl = target.resourceUrl;

  const form = new FormData();
  params.forEach(({ name, value }: any) => {
    form.append(name, value);
  });

  form.append("file", new Blob([imageBuffer]), `image-${Date.now()}.jpg`);

  await axios.post(url, form, {
    headers: {
      "Content-Type": "multipart/form-data",
      "X-Shopify-Access-Token": accessToken,
    },
  });

  return resourceUrl;
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateRandomString() {
  const characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 20; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
}

export const pollFileStatus = async (
  shop: string,
  accessToken: string,
  fileIds: string[],
) => {
  const GET_FILE_QUERY = `
    query GetFilePreviews($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on File {
          fileStatus
          preview {
            image {
              url
            }
          }
        }
      }
    }
  `;

  let status = "";
  let retries = 10;
  const interval = 3000;

  while (retries > 0) {
    try {
      const response = await axios.post(
        `https://${shop}/admin/api/2024-10/graphql.json`,
        {
          query: GET_FILE_QUERY,
          variables: { ids: fileIds },
        },
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
          },
        },
      );

      const data = response.data.data.nodes;

      const processedFiles = data.filter((file: any) => file.preview);
      if (processedFiles.length > 0) {
        status = processedFiles[0].fileStatus;
        console.log(status, "File Status");

        if (status === "READY") {
          console.log(processedFiles, "Processed Files");
          return processedFiles;
        }
      }
    } catch (error: any) {
      console.error("Error while polling file status:", error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    retries--;
  }

  throw new Error(
    "File status polling timed out or failed after maximum retries.",
  );
};
