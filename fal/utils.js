import { promises as fs } from "fs";
import path from "path";
import fetch from "node-fetch";

export const getFalPath = (localOutputOverride = false) => {
  let falPath = process.env.FAL_PATH || path.resolve(process.cwd(), "images");
  falPath = localOutputOverride
    ? path.resolve(process.cwd(), "images")
    : falPath;
  return falPath;
};

export const getFileNameFromUrl = (url) => {
  const parsedUrl = new URL(url);
  const fileName = parsedUrl.pathname.split("/").pop();
  return fileName;
};

export const getPromptFromFile = async (filePath, index = null) => {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    // Use the entire file content as a single prompt (trim to remove trailing newlines/whitespace)
    return data.trim();
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
};

export const getAllPrompts = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const lines = data
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
};

export const saveImage = async (buffer, fileName, localOutputOverride = false) => {
  const falPath = getFalPath(localOutputOverride);
  const filePath = path.join(falPath, fileName);
  await fs.mkdir(falPath, { recursive: true });

  try {
    await fs.writeFile(filePath, buffer);
    console.log(`Image saved: ${filePath}`);
  } catch (error) {
    console.error(`Failed to save image to ${filePath}:`, error);
  }
};

export const fetchImages = async (imageUrls) => {
  try {
    const imageFetches = imageUrls.map(async (urlObj) => {
      const url = urlObj.url;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = getFileNameFromUrl(url);
      await saveImage(buffer, fileName);
    });

    await Promise.all(imageFetches);
  } catch (error) {
    console.error("Error fetching and saving images:", error);
  }
}; 