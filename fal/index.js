#!/usr/bin/env node

import * as fal from "@fal-ai/serverless-client";
import path from "path";
import fetch from "node-fetch";
import fs from "fs";
import { fileFromSync } from "fetch-blob/from.js";
import { fal as falUpload } from "@fal-ai/client";

import { setupCLI } from "./cli.js";
import {
  getPromptFromFile,
  saveImage,
  fetchImages,
  getFileNameFromUrl
} from "./utils.js";
import {
  getModelEndpoint,
  getModelInfo,
  prepareLoras,
  loraNames
} from "./models.js";
import {
  image_size,
  DEFAULT_FORMAT
} from "./config.js";
import { buildParameters, getRequiredParams } from "./parameter-builders.js";
import { applyModelOverrides, supportsLoras } from "./model-overrides.js";

let DEBUG = false;
let local_output_override = false;

fal.config({
  credentials: process.env.FAL_KEY,
});

falUpload.config({
  credentials: process.env.FAL_KEY,
});

const isWebUrl = (str) => /^https?:\/\//i.test(str);

const processImageInput = async (inputPathOrUrl) => {
  if (!inputPathOrUrl) return null;
  // If it looks like a web URL, return as-is
  if (isWebUrl(inputPathOrUrl)) {
    return inputPathOrUrl;
  }

  // Otherwise treat as local file path (relative or absolute)
  const resolvedPath = path.resolve(process.cwd(), inputPathOrUrl);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    return null;
  }

  try {
    const file = fileFromSync(resolvedPath);
    const uploadedUrl = await falUpload.storage.upload(file);
    console.log(`Uploaded local file to FAL storage: ${uploadedUrl}`);
    return uploadedUrl;
  } catch (error) {
    console.error("Failed to upload file to FAL storage:", error);
    return null;
  }
};

const run = async (prompt, modelEndpoint, format, loraObjects, seed, scale, imageUrl, duration, strength) => {
  let count = 0;

  // Get model metadata
  const modelInfo = getModelInfo(modelEndpoint);
  const category = modelInfo?.metadata?.category || 'text-to-image';

  if (DEBUG) {
    console.log(`Model: ${modelEndpoint}`);
    console.log(`Category: ${category}`);
  }

  // Build base parameters using category-based strategy
  const options = {
    prompt,
    format,
    seed,
    scale,
    strength,
    imageUrl,
    duration,
    steps: null, // Can be added to CLI if needed
  };

  let input = buildParameters(category, options);

  // Apply model-specific overrides
  input = applyModelOverrides(modelEndpoint, input, options);

  // Handle LoRAs if supported
  if (supportsLoras(modelEndpoint) && loraObjects.length > 0) {
    const loraData = prepareLoras(loraObjects, 1);
    if (loraData) {
      input.loras = loraData.loras;
      input.prompt = loraData.loraKeywords ?
        `${loraData.loraKeywords}. ${input.prompt}` :
        input.prompt;
    }
  }

  let result;

  const showLogs = true;

  try {
    console.log("## Model Endpoint ##\n",modelEndpoint);
    result = await fal.subscribe(modelEndpoint, {
      input,
      logs: showLogs,
      options: {},
      onQueueUpdate: (update) => {
        if (update.status === "IN_QUEUE") {
          process.stdout.write(
            `\r${update.status}: position ${update.queue_position}.`
          );
        } else if (update.status === "IN_PROGRESS") {
          process.stdout.write(
            `\r${update.status}: ${count++} sec.           `
          );
          
          // Display logs for supported models
          if (showLogs && update.logs && update.logs.length > 0) {
            console.log("\n--- Generation Logs ---");
            update.logs.map(log => log.message).forEach(console.log);
            console.log("----------------------");
          }
        } else if (update.status === "COMPLETED") {
          process.stdout.write(
            "\rDONE ✔                                    \n"
          );
        }
      },
    });
    console.log("## RESULT ##\n",result);
    // Check for error responses
    if (result && result.status === 400) {
      console.error(`API Error (400): ${result.detail || 'Unknown error'}`);
      return;
    }

    if (DEBUG) console.log(result);
  } catch (error) {
    // Handle network or API errors
    if (error.response) {
      console.error('API Error:', error.response.status);
      console.error('Error Details:', error.response.data);
    } else if (error.request) {
      console.error('No response received from the API');
    } else {
      console.error('Error setting up the API request:', error.message);
    }
    return;
  }

  // Handle video output for video-to-video model
  if (modelEndpoint === "fal-ai/minimax/video-01/image-to-video") {
    if (result && result.video && result.video.url) {
      const videoUrl = result.video.url;
      const fileName = getFileNameFromUrl(videoUrl);
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video from ${videoUrl}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await saveImage(buffer, fileName, local_output_override);
    } else {
      console.error("No video returned from the API.");
    }
  } else if (modelEndpoint === "fal-ai/hunyuan-video") {
    // Handle Hunyuan video output
    if (result && result.data && result.data.video_url) {
      const videoUrl = result.data.video_url;
      const fileName = getFileNameFromUrl(videoUrl);
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video from ${videoUrl}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await saveImage(buffer, fileName, local_output_override);
      console.log(`Request ID: ${result.requestId || 'N/A'}`);
      console.log(`Generation Data:`, result.data);
    } else {
      console.error("No video returned from the Hunyuan API.");
    }
  } else if (modelEndpoint === "fal-ai/wan-i2v") {
    // Handle Wan-i2v video output
    if (result && result.data && result.data.video_url) {
      const videoUrl = result.data.video_url;
      const fileName = getFileNameFromUrl(videoUrl);
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video from ${videoUrl}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await saveImage(buffer, fileName, local_output_override);
      console.log(`Request ID: ${result.requestId || 'N/A'}`);
      console.log(`Generation Data:`, result.data);
    } else {
      console.error("No video returned from the Wan-i2v API.");
    }
  } else if (modelEndpoint === "fal-ai/kling-video/v2.1/standard/image-to-video") {
    // Handle Kling video output
    if (result && result.data && result.data.video_url) {
      const videoUrl = result.data.video_url;
      const fileName = getFileNameFromUrl(videoUrl);
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video from ${videoUrl}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await saveImage(buffer, fileName, local_output_override);
      console.log(`Request ID: ${result.requestId || 'N/A'}`);
      console.log(`Generation Data:`, result.data);
    } else {
      console.error("No video returned from the Kling API.");
    }
  } else if (modelEndpoint === "fal-ai/flux-pro/kontext") {
    // Handle Kontext model output
    if (result && result.data) {
      console.log(`Request ID: ${result.requestId || 'N/A'}`);
      console.log(`Generation Data:`, result.data);
      if (result.data.image_url) {
        const imageUrl = result.data.image_url;
        const fileName = getFileNameFromUrl(imageUrl);
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image from ${imageUrl}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await saveImage(buffer, fileName, local_output_override);
      }
    } else {
      console.error("No data returned from the Kontext API.");
    }
  } else {
    // Existing image handling logic
    if (result && Array.isArray(result.images) && result.images.length > 0) {
      const imageUrls = result.images;
      await fetchImages(imageUrls, local_output_override);
    } else {
      console.error("No images returned from the API.");
    }
  }
};

const main = async () => {
  const options = setupCLI();

  DEBUG = options.debug || false;
  local_output_override = options.out || false;

  const userPrompt = options.prompt;
  const modelKey = options.model;
  const formatKey = options.format;
  const loraKeys = options.lora || [];
  const allPrompts = options.allPrompts || false;
  const seed = options.seed || null;
  const scale = options.scale || null;
  const strength = options.strength || null;
  // Replace direct assignment with processed upload logic
  let imageUrl = null;
  if (options.imageUrl) {
    imageUrl = await processImageInput(options.imageUrl);
  }
  const duration = options.duration || 5;

  // Get the model endpoint from the dictionary
  const pictureFormat = image_size[formatKey] || DEFAULT_FORMAT;

  const loraObjects = loraKeys.map((key) => loraNames[key]).filter(Boolean);
  const modelEndpoint = getModelEndpoint(modelKey, loraObjects);

  // Validate required parameters based on category
  const modelInfo = getModelInfo(modelEndpoint);
  const category = modelInfo?.metadata?.category || 'text-to-image';
  const requiredParams = getRequiredParams(category);

  // Check if required parameters are provided
  const missingParams = [];
  if (requiredParams.includes('imageUrl') && !imageUrl) {
    missingParams.push('--image-url');
  }
  if (requiredParams.includes('videoUrl') && !imageUrl) {
    missingParams.push('--video-url (use --image-url)');
  }
  if (requiredParams.includes('audioUrl') && !imageUrl) {
    missingParams.push('--audio-url (use --image-url)');
  }

  if (missingParams.length > 0) {
    console.error(`Error: Model '${modelKey}' (category: ${category}) requires: ${missingParams.join(', ')}`);
    console.error(`Example: falflux --model ${modelKey} --prompt "your prompt" --image-url ./path/to/file`);
    process.exit(1);
  }

  if (allPrompts) {
    // With the new single-prompt file approach, --all-prompts simply triggers
    // a single generation using the entire content of "prompt.txt".
    const promptFilePath = path.resolve(process.cwd(), "prompt.txt");
    getPromptFromFile(promptFilePath)
      .then(async (promptText) => {
        console.log("Generating image for prompt.txt");
        await run(
          promptText,
          modelEndpoint,
          pictureFormat,
          loraObjects,
          seed,
          scale,
          imageUrl,
          duration,
          strength
        );
      })
      .catch((error) => {
        console.error("Failed to read prompt:", error);
      });
  } else {
    const promptPromise = userPrompt
      ? Promise.resolve(userPrompt)
      : getPromptFromFile(path.resolve(process.cwd(), "prompt.txt"));

    promptPromise
      .then((promptText) => {
        console.log(`Generating image...`);
        run(
          promptText, 
          modelEndpoint, 
          pictureFormat, 
          loraObjects, 
          seed, 
          scale, 
          imageUrl,
          duration,
          strength
        );
      })
      .catch((error) => {
        console.error("Failed to get prompt:", error);
      });
  }
};

main();
