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

const run = async (prompt, modelEndpoint, format, loraObjects, seed, scale, imageUrl, duration, strength) => {
  let count = 0;

  let result;
  const input = {
    prompt,
    image_size: format,
    num_inference_steps: DEFAULT_INFERENCE_STEPS,
    guidance_scale: DEFAULT_GUIDANCE_SCALE,
    num_images: 1,
    safety_tolerance: DEFAULT_SAFETY_TOLERANCE,
    enable_safety_checker: false
  };

  // Add model-specific parameters (fal ignores unused ones)
  
  // Video models that need image_url
  if (["fal-ai/minimax/video-01-live/image-to-video", "fal-ai/flux-pro/kontext", 
       "fal-ai/wan-i2v", "fal-ai/kling-video/v2.1/standard/image-to-video", 
       "fal-ai/flux/krea/image-to-image"].includes(modelEndpoint)) {
    input.image_url = imageUrl;
  }
  
  // Model-specific overrides
  if (modelEndpoint === "fal-ai/minimax/video-01-live/image-to-video") {
    input.prompt_optimizer = true;
  } else if (modelEndpoint === "fal-ai/kling-video/v2.1/standard/image-to-video") {
    input.duration = parseInt(duration, 10);
  } else if (modelEndpoint === "fal-ai/flux/krea/image-to-image") {
    // Krea has very specific parameter preferences
    input.strength = 0.9;
    input.num_inference_steps = 40;
    input.guidance_scale = 4.5;
    input.output_format = "jpeg";
    input.acceleration = "none";
  } else if (modelEndpoint === "fal-ai/flux/krea") {
    // Regular Krea text-to-image model - no LoRA support
    input.output_format = "jpeg";
    input.acceleration = "none";
  } else {
    // Standard flux models with LoRA support
    const loraData = prepareLoras(loraObjects, 1);
    if (loraData) {
      input.loras = loraData.loras;
      input.prompt = loraData.loraKeywords ?
        `${loraData.loraKeywords}. ${input.prompt}` :
        input.prompt;
    }
  }

  if (scale !== null && scale !== undefined) {
    input.guidance_scale = parseFloat(scale);
  }

  if (strength !== null && strength !== undefined) {
    input.strength = parseFloat(strength);
  }

  if (seed) {
    input.seed = seed;
  }

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

  // Validate that models requiring image_url have it provided
  const modelsRequiringImage = [
    "fal-ai/minimax/video-01-live/image-to-video",
    "fal-ai/flux-pro/kontext",
    "fal-ai/wan-i2v",
    "fal-ai/kling-video/v2.1/standard/image-to-video",
    "fal-ai/flux/krea/image-to-image"
  ];

  if (modelsRequiringImage.includes(modelEndpoint) && !imageUrl) {
    console.error(`Error: Model '${modelKey}' requires an input image.`);
    console.error(`Please provide an image using --image-url <url-or-path>`);
    console.error(`Example: falflux --model ${modelKey} --prompt "your prompt" --image-url ./path/to/image.jpg`);
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
