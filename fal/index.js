#!/usr/bin/env node

import * as fal from "@fal-ai/serverless-client";
import path from "path";
import fetch from "node-fetch";

import { setupCLI } from "./cli.js";
import { 
  getPromptFromFile, 
  getAllPrompts, 
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

const run = async (prompt, modelEndpoint, format, loraObjects, seed, scale, imageUrl) => {
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
  } else if (modelEndpoint === "fal-ai/hunyuan-video") {
    // Hunyuan video only needs prompt, remove other parameters
    delete input.image_size;
    delete input.num_inference_steps;
    delete input.guidance_scale;
    delete input.num_images;
    delete input.safety_tolerance;
    delete input.enable_safety_checker;
  } else if (modelEndpoint === "fal-ai/wan-i2v") {
    // Wan-i2v needs prompt and image_url
    input.image_url = imageUrl;
    delete input.image_size;
    delete input.num_inference_steps;
    delete input.guidance_scale;
    delete input.num_images;
    delete input.safety_tolerance;
    delete input.enable_safety_checker;
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
  const showLogs = modelEndpoint === "fal-ai/hunyuan-video" || modelEndpoint === "fal-ai/wan-i2v";

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
  const index = options.index || null;
  const scale = options.scale || null;
  const imageUrl = options.imageUrl || null;

  // Get the model endpoint from the dictionary
  const pictureFormat = image_size[formatKey] || DEFAULT_FORMAT;

  const loraObjects = loraKeys.map((key) => loraNames[key]).filter(Boolean);
  const modelEndpoint = getModelEndpoint(modelKey, loraObjects);

  if (allPrompts) {
    // Handle the --all-prompts option
    const promptsFilePath = path.resolve(process.cwd(), "prompts.txt");
    getAllPrompts(promptsFilePath)
      .then(async (prompts) => {
        for (const [idx, promptText] of prompts.entries()) {
          console.log(
            `Generating image for prompt ${idx + 1}`
          );
          await run(
            promptText,
            modelEndpoint,
            pictureFormat,
            loraObjects,
            seed,
            scale,
            imageUrl
          );
        }
      })
      .catch((error) => {
        console.error("Failed to read prompts:", error);
      });
  } else {
    const promptPromise = userPrompt
      ? Promise.resolve(userPrompt)
      : getPromptFromFile(path.resolve(process.cwd(), "prompts.txt"), index);

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
          imageUrl
        );
      })
      .catch((error) => {
        console.error("Failed to get prompt:", error);
      });
  }
};

main();
