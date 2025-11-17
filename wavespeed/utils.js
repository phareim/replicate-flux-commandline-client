import { promises as fs } from "fs";
import path from "path";
import fetch from "node-fetch";

const WAVESPEED_SMOKE_MODE = process.env.WAVESPEED_SMOKE_TEST === "1";

export const getWavespeedPath = (localOutputOverride = false) => {
  let wavespeedPath = process.env.WAVESPEED_PATH || path.resolve(process.cwd(), "images");
  wavespeedPath = localOutputOverride
    ? path.resolve(process.cwd(), "images")
    : wavespeedPath;
  return wavespeedPath;
};

export const getFileNameFromUrl = (url, predictionId = null) => {
  const parsedUrl = new URL(url);

  // If predictionId is provided, use it with the original extension
  if (predictionId) {
    const fileName = parsedUrl.pathname.split("/").pop();
    const extension = fileName.split('.').pop() || 'jpeg';
    return `${predictionId}.${extension}`;
  }

  // Fallback to original behavior
  const fileName = parsedUrl.pathname.split("/").pop();
  return fileName || `wavespeed_${Date.now()}.png`;
};

export const getPromptFromFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return data.trim();
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
};

export const saveImage = async (buffer, fileName, localOutputOverride = false) => {
  const wavespeedPath = getWavespeedPath(localOutputOverride);
  const filePath = path.join(wavespeedPath, fileName);
  await fs.mkdir(wavespeedPath, { recursive: true });

  try {
    await fs.writeFile(filePath, buffer);
    console.log(`Image saved: ${filePath}`);
  } catch (error) {
    console.error(`Failed to save image to ${filePath}:`, error);
  }
};

export const fetchImages = async (imageUrls, localOutputOverride = false, predictionId = null) => {
  try {
    const imageFetches = imageUrls.map(async (url, index) => {
      // If multiple images and predictionId exists, append index (e.g., predictionId_0.jpeg, predictionId_1.jpeg)
      const baseFileName = getFileNameFromUrl(url, predictionId);
      const fileName = imageUrls.length > 1 && predictionId
        ? baseFileName.replace(/\.(\w+)$/, `_${index}.$1`)
        : baseFileName;

      if (WAVESPEED_SMOKE_MODE) {
        const buffer = Buffer.from("mock wavespeed image");
        await saveImage(buffer, fileName, localOutputOverride);
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await saveImage(buffer, fileName, localOutputOverride);
    });

    await Promise.all(imageFetches);
  } catch (error) {
    console.error("Error fetching and saving images:", error);
  }
};
