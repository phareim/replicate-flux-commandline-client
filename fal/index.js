#!/usr/bin/env node

import * as fal from "@fal-ai/serverless-client";
import path from "path";
import fs from "fs";
import { fileFromSync } from "fetch-blob/from.js";
import { fal as falUpload } from "@fal-ai/client";
import terminalImage from "terminal-image";
import sharp from "sharp";

import { setupCLI } from "./cli.js";
import { getPromptFromFile } from "./utils.js";
import {
  getModelEndpoint,
  getModelInfo,
  prepareLoras,
  loraNames,
  allModels,
  searchModels,
  getModelsByCategory,
  getShortCodesForEndpoint
} from "./models.js";
import {
  image_size,
  DEFAULT_FORMAT
} from "./config.js";
import { buildParameters, getRequiredParams } from "./parameter-builders.js";
import { applyModelOverrides, supportsLoras } from "./model-overrides.js";
import { handleResponse } from "./response-handlers.js";

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

const displayThumbnail = async (thumbnailUrl) => {
  if (!thumbnailUrl) return;

  try {
    const response = await fetch(thumbnailUrl);
    if (!response.ok) return;

    const buffer = await response.arrayBuffer();

    // Convert to PNG using sharp (terminal-image doesn't support WebP)
    // and resize to a reasonable size for terminal display
    const pngBuffer = await sharp(Buffer.from(buffer))
      .resize(40, 40, { fit: 'inside' })
      .png()
      .toBuffer();

    const image = await terminalImage.buffer(pngBuffer);
    console.log(image);
  } catch (error) {
    // Silently fail if thumbnail can't be displayed
    // (terminal might not support images)
    console.error("Failed to display thumbnail:", error);
  }
};

const extractProgressFromLogs = (logs) => {
  // Find the most recent progress bar in logs
  // Format: ' 64%|██████▍   | 18/28 [00:01<00:01,  9.49it/s]'
  const progressRegex = /(\d+)%\|([█▌▍▎▏ ]+)\|\s*(\d+)\/(\d+)/;

  for (let i = logs.length - 1; i >= 0; i--) {
    const match = logs[i].match(progressRegex);
    if (match) {
      return {
        percentage: parseInt(match[1]),
        bar: match[2],
        current: parseInt(match[3]),
        total: parseInt(match[4])
      };
    }
  }
  return null;
};

const run = async (prompt, modelEndpoint, format, loraObjects, seed, scale, imageUrl, duration, strength, numImages) => {
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
    numImages,
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
    // Display generation header with model info
    console.log('__Generating image' + '_'.repeat(60 - 18));
    console.log(`Model: ${modelInfo?.metadata?.display_name || modelEndpoint}`);
    console.log(`Category: ${category}`);
    if (modelInfo?.metadata?.duration_estimate) {
      console.log(`Estimated duration: ~${modelInfo.metadata.duration_estimate}s`);
    }
    console.log('‾'.repeat(60) + '\n');
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
          // Display logs for supported models
          if (showLogs && update.logs && update.logs.length > 0) {
            const messages = update.logs.map(log => log.message);
            const progress = extractProgressFromLogs(messages);

            if (progress) {
              // Display a clean progress bar
              process.stdout.write(
                `\r🎨 Generating... ${progress.bar} ${progress.percentage}% (${progress.current}/${progress.total} steps) | ${count++}s      `
              );
            } else {
              // Fallback to basic progress
              process.stdout.write(
                `\r🎨 Generating... ${count++}s      `
              );
            }
          } else {
            process.stdout.write(
              `\r${update.status}: ${count++} sec.           `
            );
          }
        } else if (update.status === "COMPLETED") {
          process.stdout.write(
            "\r✨ Generation complete!                                    \n"
          );
        }
      },
    });

    if (DEBUG) {
      console.log("## RESULT ##\n",result);
    }

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

  // Handle response based on model category
  const handled = await handleResponse(result, category, modelEndpoint, local_output_override);

  if (!handled) {
    console.error(`Failed to process response for category '${category}'`);
    console.error('Please check the API response format or report this issue.');
    return;
  }

  // Display generation metadata
  console.log('\n' + '__ Generation Summary ' + '_'.repeat(36) + '' +
  (result.has_nsfw_concepts && result.has_nsfw_concepts.some(x => x) ? ' 🤘🏻' : '__'));

  // Input parameters
  console.log(`Model: ${modelInfo?.metadata?.display_name || modelEndpoint}`);

  if (format && format.width && format.height) {
    console.log(`Size: ${format.width}x${format.height}`);
  }

  if (numImages > 1) {
    console.log(`Images: ${numImages}`);
  }

  if (scale) {
    console.log(`Guidance scale: ${scale}`);
  }

  if (strength) {
    console.log(`Strength: ${strength}`);
  }

  if (loraObjects && loraObjects.length > 0) {
    const loraNames = loraObjects.map(l => l.keyword || 'unnamed').join(', ');
    console.log(`LoRAs: ${loraNames}`);
  }

  if (imageUrl) {
    const displayUrl = imageUrl.length > 50 ? '...' + imageUrl.substring(imageUrl.length - 47) : imageUrl;
    console.log(`Input image: ${displayUrl}`);
  }

  if (duration && category.includes('video')) {
    console.log(`Duration: ${duration}s`);
  }

  // Output metadata
  if (result.seed) {
    console.log(`Seed: ${result.seed}`);
  }
  if (result.timings && result.timings.inference) {
    console.log(`Inference time: ${result.timings.inference.toFixed(2)}s`);
  }
  console.log('‾'.repeat(60) + '\n');
};

const main = async () => {
  const options = setupCLI();

  DEBUG = options.debug || false;
  local_output_override = options.out || false;

  // Handle model discovery commands
  if (options.listCategories) {
    const categories = [...new Set(allModels.map(m => m.metadata.category))].sort();
    console.log('\n=== Available Model Categories ===\n');
    categories.forEach(cat => {
      const count = allModels.filter(m => m.metadata.category === cat).length;
      console.log(`  ${cat.padEnd(20)} (${count} models)`);
    });
    console.log('\nUse --list-models --category <name> to see models in a category\n');
    process.exit(0);
  }

  if (options.search) {
    const results = searchModels(options.search);
    console.log(`\n=== Search Results for "${options.search}" ===\n`);
    if (results.length === 0) {
      console.log('No models found.\n');
    } else {
      console.log(`Found ${results.length} model(s):\n`);
      results.forEach(model => {
        const shortCodes = getShortCodesForEndpoint(model.endpoint_id);
        console.log(`  ${model.metadata.display_name}`);
        console.log(`    ID: ${model.endpoint_id}`);
        if (shortCodes.length > 0) {
          console.log(`    CLI: ${shortCodes.join(', ')}`);
        }
        console.log(`    Category: ${model.metadata.category}`);
        console.log(`    ${model.metadata.description.substring(0, 100)}...`);
        console.log();
      });
    }
    process.exit(0);
  }

  if (options.modelInfo) {
    const model = getModelInfo(options.modelInfo);
    if (!model) {
      console.error(`Model '${options.modelInfo}' not found.`);
      console.error('Use --list-models or --search to find available models.');
      process.exit(1);
    }

    console.log('\n=== Model Information ===\n');

    // Display thumbnail if available
    if (model.metadata.thumbnail_url) {
      await displayThumbnail(model.metadata.thumbnail_url);
      console.log(); // Extra newline for spacing
    }

    console.log(`Name: ${model.metadata.display_name}`);
    console.log(`ID: ${model.endpoint_id}`);

    const shortCodes = getShortCodesForEndpoint(model.endpoint_id);
    if (shortCodes.length > 0) {
      console.log(`CLI short-codes: ${shortCodes.join(', ')}`);
    }

    console.log(`Category: ${model.metadata.category}`);
    console.log(`Status: ${model.metadata.status}`);
    console.log(`License: ${model.metadata.license_type || 'N/A'}`);
    console.log(`\nDescription:`);
    console.log(`  ${model.metadata.description}`);

    if (model.metadata.tags && model.metadata.tags.length > 0) {
      console.log(`\nTags: ${model.metadata.tags.join(', ')}`);
    }

    if (model.metadata.duration_estimate) {
      console.log(`\nEstimated duration: ~${model.metadata.duration_estimate}s`);
    }

    console.log(`\nModel URL: ${model.metadata.model_url}`);

    // Show required parameters
    const { getRequiredParams } = await import('./parameter-builders.js');
    const required = getRequiredParams(model.metadata.category);
    if (required.length > 0) {
      console.log(`\nRequired parameters: ${required.map(p => `--${p.replace(/([A-Z])/g, '-$1').toLowerCase()}`).join(', ')}`);
    }

    console.log('\nExample usage:');
    if (model.metadata.category === 'image-to-video' || model.metadata.category === 'image-to-image') {
      console.log(`  falflux --model ${options.modelInfo} --prompt "your prompt" --image-url ./image.jpg\n`);
    } else {
      console.log(`  falflux --model ${options.modelInfo} --prompt "your prompt"\n`);
    }

    process.exit(0);
  }

  if (options.listModels) {
    let modelsToShow = allModels;

    if (options.category) {
      modelsToShow = getModelsByCategory(options.category);
      console.log(`\n=== Models in category: ${options.category} ===\n`);
      if (modelsToShow.length === 0) {
        console.log('No models found in this category.');
        console.log('Use --list-categories to see available categories.\n');
        process.exit(1);
      }
    } else {
      console.log('\n=== All Available Models ===\n');
    }

    console.log(`Total: ${modelsToShow.length} model(s)\n`);

    // Group by category if showing all
    if (!options.category) {
      const byCategory = {};
      modelsToShow.forEach(m => {
        const cat = m.metadata.category;
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(m);
      });

      Object.keys(byCategory).sort().forEach(cat => {
        console.log(`\n${cat.toUpperCase()} (${byCategory[cat].length})`);
        console.log('─'.repeat(50));
        byCategory[cat].forEach(m => {
          const shortCodes = getShortCodesForEndpoint(m.endpoint_id);
          console.log(`  ${m.metadata.display_name}`);
          console.log(`    ID: ${m.endpoint_id}`);
          if (shortCodes.length > 0) {
            console.log(`    CLI: ${shortCodes.join(', ')}`);
          }
        });
      });
    } else {
      modelsToShow.forEach(m => {
        const shortCodes = getShortCodesForEndpoint(m.endpoint_id);
        console.log(`  ${m.metadata.display_name}`);
        console.log(`    ID: ${m.endpoint_id}`);
        if (shortCodes.length > 0) {
          console.log(`    CLI: ${shortCodes.join(', ')}`);
        }
        console.log(`    ${m.metadata.description.substring(0, 80)}...`);
        console.log();
      });
    }

    console.log('\nUse --model-info <id> to see detailed information about a model\n');
    process.exit(0);
  }

  const userPrompt = options.prompt;
  const promptFile = options.promptFile || "prompt.txt";
  const modelKey = options.model;
  const formatKey = options.format;
  let loraKeys = options.lora || [];

  // Handle random LoRA selection
  if (options.randomLora) {
    const availableLoraKeys = Object.keys(loraNames);
    const randomKey = availableLoraKeys[Math.floor(Math.random() * availableLoraKeys.length)];
    loraKeys = [randomKey];
    console.log(`\n🎲 Randomly selected LoRA: ${randomKey}\n`);
  }

  const allPrompts = options.allPrompts || false;
  const seed = options.seed || null;
  const scale = options.scale || null;
  const strength = options.strength || null;
  const numImages = options.numImages || 1;
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
    // a single generation using the entire content of the prompt file.
    const promptFilePath = path.resolve(process.cwd(), promptFile);
    getPromptFromFile(promptFilePath)
      .then(async (promptText) => {
        console.log(`Generating image for ${promptFile}`);
        await run(
          promptText,
          modelEndpoint,
          pictureFormat,
          loraObjects,
          seed,
          scale,
          imageUrl,
          duration,
          strength,
          numImages
        );
      })
      .catch((error) => {
        console.error("Failed to read prompt:", error);
      });
  } else {
    const promptPromise = userPrompt
      ? Promise.resolve(userPrompt)
      : getPromptFromFile(path.resolve(process.cwd(), promptFile));

    promptPromise
      .then((promptText) => {
        run(
          promptText,
          modelEndpoint,
          pictureFormat,
          loraObjects,
          seed,
          scale,
          imageUrl,
          duration,
          strength,
          numImages
        );
      })
      .catch((error) => {
        console.error("Failed to get prompt:", error);
      });
  }
};

main();
