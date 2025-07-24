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
  prepareLoras, 
  loraNames 
} from "./models.js";
import { 
  image_size, 
  DEFAULT_FORMAT, 
  DEFAULT_GUIDANCE_SCALE, 
  DEFAULT_INFERENCE_STEPS, 
  DEFAULT_SAFETY_TOLERANCE 
} from "./config.js";

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

const run = async (prompt, modelEndpoint, format, loraObjects, seed, scale, imageUrl, duration) => {
  let count = 0;

  let result;
  const input = {
    prompt,
    image_size: format,
    num_inference_steps: DEFAULT_INFERENCE_STEPS,
    guidance_scale: DEFAULT_GUIDANCE_SCALE,
    num_images: 1,
    safety_tolerance: DEFAULT_SAFETY_TOLERANCE,
    enable_safety_checker: false,
    inference_steps: 50
  };

  // Special handling for different model types
  if (modelEndpoint === "fal-ai/minimax/video-01-live/image-to-video") {
    input.image_url = imageUrl;
    input.prompt_optimizer = true;
    delete input.image_size;
    delete input.num_images;
  } else if (modelEndpoint === "fal-ai/flux-pro/kontext") {
    // Kontext model needs prompt and image_url
    input.image_url = imageUrl;
    input.safety_tolerance = 5;
    delete input.image_size;
  } else if (modelEndpoint === "fal-ai/flux-pro/kontext/max/text-to-image") {
    input.safety_tolerance = 5;
    // Kontext text-to-image model only needs prompt
  } else if (modelEndpoint === "fal-ai/hunyuan-video") {
    // Hunyuan video only needs prompt, remove other parameters
    delete input.image_size;
  } else if (modelEndpoint === "fal-ai/wan-i2v") {
    // Wan-i2v needs prompt and image_url
    input.image_url = imageUrl;
  } else if (modelEndpoint === "fal-ai/kling-video/v2.1/standard/image-to-video") {
    // Kling image-to-video model needs prompt and image_url
    input.image_url = imageUrl;
    input.duration = parseInt(duration, 10);
  } else {
    const loraData = prepareLoras(loraObjects, scale);
    if (loraData) {
      input.loras = loraData.loras;
      input.prompt = loraData.loraKeywords ? 
        `${loraData.loraKeywords}. ${input.prompt}` : 
        input.prompt;
    }
  }

  if (seed) {
    input.seed = seed;
  }

  // Check if this is a model that should show logs (video models)
  const showLogs = modelEndpoint === "fal-ai/hunyuan-video" || modelEndpoint === "fal-ai/wan-i2v" || modelEndpoint === "fal-ai/kling-video/v2.1/standard/image-to-video";

  try {
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
  if (modelEndpoint === "fal-ai/minimax/video-01-live/image-to-video") {
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
      await fetchImages(imageUrls);
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
          duration
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
          duration
        );
      })
      .catch((error) => {
        console.error("Failed to get prompt:", error);
      });
  }
};

main();
