import { execFile, execSync } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import axios from "axios";
import { PDFDocument } from "pdf-lib";

const execFileAsync = promisify(execFile);

async function countPdfPages(filePath: string) {
  const pdfBytes = await fs.readFile(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

function findGhostscript(): string {
  // 1. Check GS_PATH env var
  if (process.env.GS_PATH) {
    return process.env.GS_PATH;
  }

  const isWindows = process.platform === "win32";

  if (isWindows) {
    // 2. Try to find via 'where' command
    for (const bin of ["gswin32c", "gswin64c"]) {
      try {
        const result = execSync(`where ${bin}`, { encoding: "utf8", timeout: 5000 }).trim();
        if (result) {
          // 'where' can return multiple lines; take the first one
          const firstLine = result.split("\n")[0].trim();
          console.log(`Found Ghostscript at: ${firstLine}`);
          return firstLine;
        }
      } catch {
        // not found, try next
      }
    }

    // 3. Search common install directories
    const programFiles = ["C:\\Program Files (x86)", "C:\\Program Files"];
    for (const pf of programFiles) {
      const gsDir = path.join(pf, "gs");
      try {
        const versions = fsSync.readdirSync(gsDir);
        for (const ver of versions.reverse()) { // reverse to get latest version first
          for (const bin of ["gswin32c.exe", "gswin64c.exe"]) {
            const candidate = path.join(gsDir, ver, "bin", bin);
            if (fsSync.existsSync(candidate)) {
              console.log(`Found Ghostscript at: ${candidate}`);
              return candidate;
            }
          }
        }
      } catch {
        // directory doesn't exist, skip
      }
    }

    throw new Error(
      "Ghostscript not found. Please install Ghostscript and set the GS_PATH environment variable to the full path of gswin32c.exe or gswin64c.exe."
    );
  }

  // Non-Windows: just use 'gs'
  return "gs";
}

export const extractImagesFromPDF = async (
  pdfPath: string,
): Promise<string[]> => {
  const outputDir = path.dirname(pdfPath);
  const outputPrefix = path.basename(pdfPath, path.extname(pdfPath));
  const totalPages = await countPdfPages(pdfPath);
  const gsBinary = findGhostscript();
  console.log(`Using Ghostscript binary: ${gsBinary}`);

  const imageUrls: string[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const outputFile = path.join(outputDir, `${outputPrefix}_page_${page}.png`);
    try {
      await execFileAsync(gsBinary, [
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=png16m",
        "-r150",
        `-dFirstPage=${page}`,
        `-dLastPage=${page}`,
        `-sOutputFile=${outputFile}`,
        pdfPath,
      ]);
      imageUrls.push(`/uploads/${path.basename(outputFile)}`);
    } catch (err) {
      console.error(`Error converting page ${page} to image:`, err);
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
