import { promises as fs } from "fs";
import path from "path";

export const getVenicePath = (localOutputOverride = false) => {
  // use $VENICE_PATH if set, unless explicitly overridden via --out
  const defaultPath = path.resolve(process.cwd(), "images/venice/");
  const envPath = process.env.VENICE_PATH
    ? path.resolve(process.env.VENICE_PATH)
    : defaultPath;

  return localOutputOverride ? defaultPath : envPath;
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
