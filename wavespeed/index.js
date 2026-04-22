#!/usr/bin/env node

import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";

import { setupCLI } from "./cli.js";
import { getPromptFromFile } from "./utils.js";
import { getModelEndpoint, getModelInfo, constrainDimensions } from "./models.js";
import { image_size, API_BASE_URL } from "./config.js";
import { buildParameters } from "./parameter-builders.js";
import { handleResponse } from "./response-handlers.js";

let DEBUG = false;
let localOutputOverride = false;
const WAVESPEED_SMOKE_MODE = process.env.WAVESPEED_SMOKE_TEST === "1";
const VALID_OPTIMIZE_MODES = ["image", "video"];
const VALID_OPTIMIZE_STYLES = ["default", "artistic", "photographic", "technical", "realistic"];

const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${process.env.WAVESPEED_KEY}`,
  ...extra,
});

const uploadToAiwdm = (filePath, { prompt, rating, tags }) => {
  const args = ["upload", filePath];
  if (rating) args.push("--rating", rating);
  if (tags && tags.length) args.push("--tags", tags.join(","));
  if (prompt) args.push("--prompt", prompt);

  return new Promise((resolve) => {
    const proc = spawn("aiwdm", args, { stdio: "inherit" });
    proc.on("error", (err) => {
      console.error(`aiwdm upload failed: ${err.message}`);
      resolve();
    });
    proc.on("close", (code) => {
      if (code !== 0) console.error(`aiwdm exited with code ${code}`);
      resolve();
    });
  });
};

/**
 * Poll a prediction until it completes or fails.
 * @param {string} url - Polling URL
 * @param {Object} opts - { interval, maxAttempts, onTick }
 * @returns {Promise<Object>} - The completed prediction data
 */
const pollPrediction = async (url, { interval = 2000, maxAttempts = 60, onTick } = {}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();
    const data = responseData.data || responseData;

    if (DEBUG) console.log(`Polling attempt ${attempt + 1}:`, data.status);

    if (data.status === "completed" || data.status === "failed") {
      return data;
    }

    if (onTick) onTick(attempt + 1, data);

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("Polling timeout: Generation took too long");
};

const createMockResult = (modelEndpoint) => ({
  status: "completed",
  id: "mock-prediction-id",
  created_at: new Date().toISOString(),
  model: modelEndpoint,
  outputs: ["https://example.com/mock-wavespeed-output.png"],
  has_nsfw_contents: [false],
});

/**
 * Optimize a prompt using the Wavespeed prompt optimizer.
 * Falls back to the original prompt on any error.
 */
const optimizePrompt = async (promptText, mode = "image", style = "default", imageUrl = null) => {
  if (!VALID_OPTIMIZE_MODES.includes(mode)) {
    console.warn(`Invalid optimization mode '${mode}'. Using 'image'. Valid: ${VALID_OPTIMIZE_MODES.join(", ")}`);
    mode = "image";
  }

  if (style === "random") {
    style = VALID_OPTIMIZE_STYLES[Math.floor(Math.random() * VALID_OPTIMIZE_STYLES.length)];
    console.log(`🎲 Randomly selected style: ${style}`);
  } else if (!VALID_OPTIMIZE_STYLES.includes(style)) {
    console.warn(`Invalid optimization style '${style}'. Using 'default'. Valid: ${VALID_OPTIMIZE_STYLES.join(", ")}, random`);
    style = "default";
  }

  if (WAVESPEED_SMOKE_MODE) {
    console.log("🔧 Prompt optimization (mock)");
    return `Optimized: ${promptText}`;
  }

  console.log("__Optimizing prompt" + "_".repeat(60 - 18));
  console.log(`Mode: ${mode}`);
  console.log(`Style: ${style}`);
  if (imageUrl) console.log(`Reference Image: ${imageUrl}`);
  console.log("‾".repeat(60) + "\n");

  const url = `${API_BASE_URL}/wavespeed-ai/prompt-optimizer`;
  const payload = { enable_sync_mode: false, text: promptText, mode, style };
  if (imageUrl) payload.image = imageUrl;

  try {
    if (DEBUG) {
      console.log("Optimizer API URL:", url);
      console.log("Optimizer payload:", JSON.stringify(payload, null, 2));
    }

    const response = await fetch(url, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Optimizer API Error (${response.status}): ${await response.text()}`);
      console.log("Continuing with original prompt...\n");
      return promptText;
    }

    const initial = await response.json();
    const requestId = initial.data?.id;
    if (!requestId) {
      console.error("Failed to get request ID from optimizer");
      console.log("Continuing with original prompt...\n");
      return promptText;
    }

    if (DEBUG) console.log(`Optimizer task submitted. Request ID: ${requestId}`);
    process.stdout.write("🔧 Optimizing prompt...");

    const result = await pollPrediction(`${API_BASE_URL}/predictions/${requestId}/result`, {
      interval: 500,
    });

    if (result.status === "failed") {
      process.stdout.write("\r");
      console.error("Optimizer task failed:", result.error);
      console.log("Continuing with original prompt...\n");
      return promptText;
    }

    const optimized = result.outputs?.[0];
    process.stdout.write("\r✨ Prompt optimized!                                    \n\n");
    console.log("Original prompt:", promptText);
    console.log("Optimized prompt:", optimized);
    console.log("");
    return optimized || promptText;
  } catch (error) {
    process.stdout.write("\r");
    console.error("Optimizer error:", error.message);
    console.log("Continuing with original prompt...\n");
    return promptText;
  }
};

/**
 * Generate one image (or batch) using the Wavespeed API.
 */
const run = async ({ prompt, modelEndpoint, size, options }) => {
  const modelInfo = getModelInfo(modelEndpoint);
  const category = modelInfo?.metadata?.category || "text-to-image";

  if (DEBUG) {
    console.log(`Model: ${modelEndpoint}`);
    console.log(`Category: ${category}`);
  }

  const input = buildParameters(category, {
    prompt,
    size,
    enableBase64: options.enableBase64,
    sync: options.sync,
    images: options.images,
    negativePrompt: options.negativePrompt,
    seed: options.seed,
    aspectRatio: options.aspectRatio,
    resolution: options.resolution,
    outputFormat: options.outputFormat,
    quality: options.quality,
    numImages: options.numImages,
    duration: options.duration,
    audio: options.audio,
    promptExpansion: options.promptExpansion,
  });

  if (DEBUG) console.log("Request parameters:", JSON.stringify(input, null, 2));

  const isVideoCategory = category.endsWith("-to-video");
  const header = isVideoCategory ? "__Generating video" : "__Generating image";
  console.log(header + "_".repeat(60 - header.length));
  console.log(`Model: ${modelInfo?.metadata?.display_name || modelEndpoint}`);
  console.log(`Category: ${category}`);
  if (!isVideoCategory) console.log(`Size: ${size}`);
  if (isVideoCategory && input.duration) console.log(`Duration: ${input.duration}s`);
  if (isVideoCategory && input.resolution) console.log(`Resolution: ${input.resolution}`);
  if (isVideoCategory && input.aspect_ratio) console.log(`Aspect: ${input.aspect_ratio}`);
  console.log("‾".repeat(60) + "\n");

  let result;

  try {
    if (WAVESPEED_SMOKE_MODE) {
      result = createMockResult(modelEndpoint);
      process.stdout.write("\r✨ Generation complete! (mock)                               \n");
    } else {
      const apiUrl = `${API_BASE_URL}/${modelEndpoint}`;
      if (DEBUG) console.log(`API URL: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        console.error(`API Error (${response.status}): ${await response.text()}`);
        return;
      }

      const initial = await response.json();
      if (DEBUG) console.log("Initial response:", JSON.stringify(initial, null, 2));

      const predictionData = initial.data || initial;

      if (options.sync || predictionData.status === "completed") {
        result = predictionData;
        if (predictionData.status === "completed") {
          process.stdout.write("\r✨ Generation complete!                                    \n");
        }
      } else {
        const pollUrl = predictionData.urls?.get
          || (predictionData.id ? `${API_BASE_URL}/${modelEndpoint}/${predictionData.id}` : null);

        if (!pollUrl) {
          console.error("Unable to poll for result: no polling URL available");
          result = predictionData;
        } else {
          const isVideo = category.endsWith("-to-video");
          const pollInterval = isVideo ? 5000 : 2000;
          const pollMaxAttempts = isVideo ? 360 : 60;
          const icon = isVideo ? "🎬" : "🎨";
          result = await pollPrediction(pollUrl, {
            interval: pollInterval,
            maxAttempts: pollMaxAttempts,
            onTick: (attempt) => process.stdout.write(`\r${icon} Generating... ${attempt * (pollInterval / 1000)}s      `),
          });
          if (result.status === "completed") {
            process.stdout.write("\r✨ Generation complete!                                    \n");
          }
        }
      }
    }

    if (DEBUG) console.log("## RESULT ##\n", JSON.stringify(result, null, 2));

    if (result?.status === "failed") {
      console.error(`Generation failed: ${result.error || "Unknown error"}`);
      return;
    }
  } catch (error) {
    console.error("Error:", error.message || "Unknown error occurred");
    return;
  }

  const { ok: handled, savedPaths } = await handleResponse(result, category, modelEndpoint, localOutputOverride);
  if (!handled) {
    console.error(`Failed to process response for category '${category}'`);
    console.error("Please check the API response format or report this issue.");
    return;
  }

  if (options.aiwdm && !WAVESPEED_SMOKE_MODE && savedPaths.length > 0) {
    const extraTags = options.aiwdmTags
      ? options.aiwdmTags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const tags = ["wavespeed", ...extraTags];
    for (const savedPath of savedPaths) {
      await uploadToAiwdm(savedPath, {
        prompt,
        rating: options.aiwdmRating,
        tags,
      });
    }
  }

  const nsfwFlag = result.has_nsfw_contents?.some((x) => x) ? " 🔞" : "__";
  console.log("\n__ Generation Summary " + "_".repeat(36) + nsfwFlag);
  console.log(`Model: ${modelInfo?.metadata?.display_name || modelEndpoint}`);
  if (!isVideoCategory) console.log(`Size: ${size}`);
  if (isVideoCategory && input.duration) console.log(`Duration: ${input.duration}s`);
  if (result.id) console.log(`Prediction ID: ${result.id}`);
  if (result.created_at) console.log(`Created: ${result.created_at}`);
  console.log("‾".repeat(60) + "\n");
};

const generateBatch = async (promptText, modelEndpoint, size, options) => {
  const count = parseInt(options.count, 10) || 1;
  for (let i = 0; i < count; i++) {
    if (count > 1) {
      console.log(`\n${"=".repeat(60)}\nGeneration ${i + 1} of ${count}\n${"=".repeat(60)}\n`);
    }

    const finalPrompt = options.optimize
      ? await optimizePrompt(promptText, options.optimizeMode, options.optimizeStyle, options.optimizeImage)
      : promptText;

    await run({ prompt: finalPrompt, modelEndpoint, size, options });
  }
};

const main = async () => {
  const options = setupCLI();

  DEBUG = options.debug || false;
  localOutputOverride = options.out || false;

  if (!process.env.WAVESPEED_KEY && !WAVESPEED_SMOKE_MODE) {
    console.error("Error: WAVESPEED_KEY environment variable is not set.");
    console.error("Please set your Wavespeed API key:");
    console.error("  export WAVESPEED_KEY='your-api-key'");
    process.exit(1);
  }

  const modelEndpoint = getModelEndpoint(options.model);
  const sizeFromFormat = image_size[options.format] || options.format || "4096*4096";
  const size = constrainDimensions(sizeFromFormat, modelEndpoint);

  if (options.allPrompts) {
    const currentDir = process.cwd();
    let txtFiles;
    try {
      const files = await fs.readdir(currentDir);
      txtFiles = files.filter((file) => file.endsWith(".txt")).sort();
    } catch (error) {
      console.error("Failed to read directory:", error);
      process.exit(1);
    }

    if (txtFiles.length === 0) {
      console.error("No .txt files found in the current directory.");
      process.exit(1);
    }

    console.log(`Found ${txtFiles.length} prompt file(s): ${txtFiles.join(", ")}\n`);

    for (const txtFile of txtFiles) {
      const promptFilePath = path.resolve(currentDir, txtFile);
      try {
        const promptText = await getPromptFromFile(promptFilePath);
        console.log(`\n${"#".repeat(60)}\n# Processing: ${txtFile}\n${"#".repeat(60)}\n`);
        await generateBatch(promptText, modelEndpoint, size, options);
      } catch (error) {
        console.error(`Failed to read prompt from ${txtFile}:`, error.message);
        console.log(`Skipping ${txtFile}...\n`);
      }
    }
    return;
  }

  const promptFile = options.file || "prompt.txt";
  let promptText;
  try {
    promptText = options.prompt
      ? options.prompt
      : await getPromptFromFile(path.resolve(process.cwd(), promptFile));
  } catch (error) {
    console.error("Failed to get prompt:", error);
    return;
  }

  await generateBatch(promptText, modelEndpoint, size, options);
};

main();
