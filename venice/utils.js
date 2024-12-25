import { promises as fs } from "fs";
import path from "path";
import fetch from "node-fetch";

export const getVenicePath = (localOutputOverride = false) => {
  let venicePath = path.resolve(process.cwd(), "images/venice");
  venicePath = localOutputOverride
    ? path.resolve(process.cwd(), "images/venice")
    : venicePath;
  return venicePath;
};

export const getFileNameFromUrl = (url) => {
  const parsedUrl = new URL(url);
  const fileName = parsedUrl.pathname.split("/").pop();
  return fileName || `venice_image_${Date.now()}.png`;
};

export const saveImage = async (buffer, fileName, localOutputOverride = false) => {
  const venicePath = getVenicePath(localOutputOverride);
  const filePath = path.join(venicePath, fileName);
  await fs.mkdir(venicePath, { recursive: true });

  try {
    await fs.writeFile(filePath, buffer);
    console.log(`Image saved: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Failed to save image to ${filePath}:`, error);
    throw error;
  }
};

export const fetchImage = async (imageUrl, fileName, localOutputOverride = false) => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${imageUrl}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return await saveImage(buffer, fileName, localOutputOverride);
  } catch (error) {
    console.error("Error fetching and saving image:", error);
    throw error;
  }
}; 