import { fetchImages } from "./utils.js";

/**
 * Handle Wavespeed API response
 * @param {Object} result - API response from Wavespeed
 * @param {string} category - Model category (e.g., 'text-to-image')
 * @param {string} modelEndpoint - Full model endpoint ID
 * @param {boolean} localOutputOverride - Save to current directory
 * @returns {Promise<{ok: boolean, savedPaths: string[]}>} - ok flag plus saved file paths
 */
export async function handleResponse(result, category, modelEndpoint, localOutputOverride = false) {
  try {
    if (result.status === "failed") {
      console.error("Generation failed:", result.error || "Unknown error");
      return { ok: false, savedPaths: [] };
    }

    if (result && Array.isArray(result.outputs) && result.outputs.length > 0) {
      const noun = category.endsWith("-to-video") ? "video" : "image";
      console.log(`Downloading ${result.outputs.length} ${noun}(s)...`);

      console.log("\n📎 Remote URL(s):");
      result.outputs.forEach((url, idx) => {
        console.log(`  [${idx + 1}] ${url}`);
      });
      console.log();

      const savedPaths = await fetchImages(result.outputs, localOutputOverride, result.id);
      return { ok: true, savedPaths };
    }

    if (result.status === "processing" || result.status === "created") {
      console.warn("Generation is still processing. Please check back later.");
      if (result.id) console.log(`Prediction ID: ${result.id}`);
      return { ok: true, savedPaths: [] };
    }

    console.error("No outputs found in response");
    return { ok: false, savedPaths: [] };
  } catch (error) {
    console.error(`Error handling response:`, error.message);
    return { ok: false, savedPaths: [] };
  }
}
