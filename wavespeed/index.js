#!/usr/bin/env node

import path from "path";
import fs from "fs/promises";
import fetch from "node-fetch";

import { setupCLI } from "./cli.js";
import { getPromptFromFile } from "./utils.js";
import { getModelEndpoint, getModelInfo, constrainDimensions } from "./models.js";
import { image_size, API_BASE_URL } from "./config.js";
import { buildParameters } from "./parameter-builders.js";
import { handleResponse } from "./response-handlers.js";

let DEBUG = false;
let local_output_override = false;
const WAVESPEED_SMOKE_MODE = process.env.WAVESPEED_SMOKE_TEST === "1";

/**
 * Poll for prediction result
 */
const pollForResult = async (predictionUrl, maxAttempts = 60, interval = 2000) => {
  let attempts = 0;
  let lastProgress = -1;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(predictionUrl, {
        headers: {
          "Authorization": `Bearer ${process.env.WAVESPEED_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();

      // Extract data object from response (API wraps result in data object)
      const result = responseData.data || responseData;

      if (DEBUG) {
        console.log(`Polling attempt ${attempts + 1}:`, result.status);
      }

      // Show progress
      if (result.status === 'processing') {
        process.stdout.write(`\r🎨 Generating... ${attempts + 1}s      `);
      } else if (result.status === 'completed') {
        process.stdout.write("\r✨ Generation complete!                                    \n");
        return result;
      } else if (result.status === 'failed') {
        console.error('\nGeneration failed:', result.error || 'Unknown error');
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
      attempts++;
    } catch (error) {
      console.error(`Error polling for result:`, error.message);
      throw error;
    }
  }

  throw new Error('Polling timeout: Generation took too long');
};

/**
 * Create a mock result for smoke testing
 */
const createMockResult = (modelEndpoint) => ({
  status: "completed",
  id: "mock-prediction-id",
  created_at: new Date().toISOString(),
  model: modelEndpoint,
  outputs: ["https://example.com/mock-wavespeed-output.png"],
  has_nsfw_contents: [false],
});

/**
 * Optimize a prompt using the Wavespeed prompt optimizer
 */
const optimizePrompt = async (promptText, mode = "image", style = "default", imageUrl = null) => {
  // Validate mode parameter
  const validModes = ["image", "video"];
  if (!validModes.includes(mode)) {
    console.warn(`Invalid optimization mode '${mode}'. Using default 'image'. Valid options: ${validModes.join(", ")}`);
    mode = "image";
  }

  // Validate and handle style parameter
  const validStyles = ["default", "artistic", "photographic", "technical", "realistic"];

  // Handle "random" style by randomly selecting from valid styles
  if (style === "random") {
    style = validStyles[Math.floor(Math.random() * validStyles.length)];
    console.log(`🎲 Randomly selected style: ${style}`);
  } else if (!validStyles.includes(style)) {
    console.warn(`Invalid optimization style '${style}'. Using default 'default'. Valid options: ${validStyles.join(", ")}, random`);
    style = "default";
  }

  if (WAVESPEED_SMOKE_MODE) {
    console.log("🔧 Prompt optimization (mock)");
    return `Optimized: ${promptText}`;
  }

  const url = `${API_BASE_URL}/wavespeed-ai/prompt-optimizer`;

  console.log('__Optimizing prompt' + '_'.repeat(60 - 18));
  console.log(`Mode: ${mode}`);
  console.log(`Style: ${style}`);
  if (imageUrl) {
    console.log(`Reference Image: ${imageUrl}`);
  }
  console.log('‾'.repeat(60) + '\n');

  const payload = {
    enable_sync_mode: false,
    text: promptText,
    mode,
    style,
  };

  if (imageUrl) {
    payload.image = imageUrl;
  }

  try {
    if (DEBUG) {
      console.log('Optimizer API URL:', url);
      console.log('Optimizer payload:', JSON.stringify(payload, null, 2));
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.WAVESPEED_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Optimizer API Error (${response.status}): ${errorText}`);
      console.log("Continuing with original prompt...\n");
      return promptText;
    }

    const initialResult = await response.json();
    const requestId = initialResult.data?.id;

    if (!requestId) {
      console.error('Failed to get request ID from optimizer');
      console.log("Continuing with original prompt...\n");
      return promptText;
    }

    if (DEBUG) {
      console.log(`Optimizer task submitted. Request ID: ${requestId}`);
    }

    process.stdout.write('🔧 Optimizing prompt...');

    // Poll for result
    let attempts = 0;
    const maxAttempts = 60;
    const interval = 500; // 0.5 seconds

    while (attempts < maxAttempts) {
      const pollResponse = await fetch(
        `${API_BASE_URL}/predictions/${requestId}/result`,
        {
          headers: {
            "Authorization": `Bearer ${process.env.WAVESPEED_KEY}`,
          },
        }
      );

      if (pollResponse.ok) {
        const result = await pollResponse.json();
        const data = result.data;
        const status = data.status;

        if (status === "completed") {
          const optimizedPrompt = data.outputs?.[0];
          process.stdout.write('\r✨ Prompt optimized!                                    \n\n');

          console.log('Original prompt:', promptText);
          console.log('Optimized prompt:', optimizedPrompt);
          console.log('');

          return optimizedPrompt || promptText;
        } else if (status === "failed") {
          process.stdout.write('\r');
          console.error("Optimizer task failed:", data.error);
          console.log("Continuing with original prompt...\n");
          return promptText;
        }
        // Still processing, continue polling
      } else {
        const errorData = await pollResponse.json();
        console.error(`\nOptimizer polling error: ${pollResponse.status}`, errorData);
        console.log("Continuing with original prompt...\n");
        return promptText;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
      attempts++;
    }

    // Timeout
    process.stdout.write('\r');
    console.error('Optimizer timeout: took too long');
    console.log("Continuing with original prompt...\n");
    return promptText;

  } catch (error) {
    console.error('Optimizer error:', error.message);
    console.log("Continuing with original prompt...\n");
    return promptText;
  }
};

/**
 * Main generation function
 */
const run = async (prompt, modelEndpoint, size, enableBase64, enableSync, images = null) => {
  const modelInfo = getModelInfo(modelEndpoint);
  const category = modelInfo?.metadata?.category || 'text-to-image';

  if (DEBUG) {
    console.log(`Model: ${modelEndpoint}`);
    console.log(`Category: ${category}`);
  }

  // Build parameters
  const options = {
    prompt,
    size,
    enableBase64,
    sync: enableSync,
    images,
  };

  const input = buildParameters(category, options);

  if (DEBUG) {
    console.log('Request parameters:', JSON.stringify(input, null, 2));
  }

  let result;

  try {
    // Display generation header
    console.log('__Generating image' + '_'.repeat(60 - 18));
    console.log(`Model: ${modelInfo?.metadata?.display_name || modelEndpoint}`);
    console.log(`Category: ${category}`);
    console.log(`Size: ${size}`);
    console.log('‾'.repeat(60) + '\n');

    if (WAVESPEED_SMOKE_MODE) {
      result = createMockResult(modelEndpoint);
      process.stdout.write("\r✨ Generation complete! (mock)                               \n");
    } else {
      // Make API request
      const apiUrl = `${API_BASE_URL}/${modelEndpoint}`;

      if (DEBUG) {
        console.log(`API URL: ${apiUrl}`);
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.WAVESPEED_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}): ${errorText}`);
        return;
      }

      const initialResult = await response.json();

      if (DEBUG) {
        console.log("Initial response:", JSON.stringify(initialResult, null, 2));
      }

      // Extract data object from response
      const predictionData = initialResult.data || initialResult;

      // If sync mode or already completed, use the result directly
      if (enableSync || predictionData.status === 'completed') {
        result = predictionData;
        if (predictionData.status === 'completed') {
          process.stdout.write("\r✨ Generation complete!                                    \n");
        }
      } else {
        // Poll for result using the prediction URL
        if (predictionData.urls && predictionData.urls.get) {
          result = await pollForResult(predictionData.urls.get);
        } else if (predictionData.id) {
          // Construct polling URL from prediction ID
          const pollUrl = `${API_BASE_URL}/${modelEndpoint}/${predictionData.id}`;
          result = await pollForResult(pollUrl);
        } else {
          console.error('Unable to poll for result: no polling URL available');
          result = predictionData;
        }
      }
    }

    if (DEBUG) {
      console.log("## RESULT ##\n", JSON.stringify(result, null, 2));
    }

    // Check for error responses
    if (result && result.status === 'failed') {
      console.error(`Generation failed: ${result.error || 'Unknown error'}`);
      return;
    }

  } catch (error) {
    // Handle network or API errors
    if (error.response) {
      console.error('API Error:', error.response.status);
      console.error('Error Details:', error.response.data);
    } else if (error.message) {
      console.error('Error:', error.message);
    } else {
      console.error('Unknown error occurred');
    }
    return;
  }

  // Handle response
  const handled = await handleResponse(result, category, modelEndpoint, local_output_override);

  if (!handled) {
    console.error(`Failed to process response for category '${category}'`);
    console.error('Please check the API response format or report this issue.');
    return;
  }

  // Display generation metadata
  console.log('\n' + '__ Generation Summary ' + '_'.repeat(36) + '' +
    (result.has_nsfw_contents && result.has_nsfw_contents.some(x => x) ? ' 🔞' : '__'));

  console.log(`Model: ${modelInfo?.metadata?.display_name || modelEndpoint}`);
  console.log(`Size: ${size}`);

  if (result.id) {
    console.log(`Prediction ID: ${result.id}`);
  }

  if (result.created_at) {
    console.log(`Created: ${result.created_at}`);
  }

  console.log('‾'.repeat(60) + '\n');
};

const main = async () => {
  const options = setupCLI();

  DEBUG = options.debug || false;
  local_output_override = options.out || false;

  // Check for API key
  if (!process.env.WAVESPEED_KEY && !WAVESPEED_SMOKE_MODE) {
    console.error("Error: WAVESPEED_KEY environment variable is not set.");
    console.error("Please set your Wavespeed API key:");
    console.error("  export WAVESPEED_KEY='your-api-key'");
    process.exit(1);
  }

  const userPrompt = options.prompt;
  const promptFile = options.file || "prompt.txt";
  const modelKey = options.model;
  const formatKey = options.format;
  const allPrompts = options.allPrompts || false;
  const enableBase64 = options.enableBase64 || false;
  const enableSync = options.sync || false;
  const count = parseInt(options.count, 10) || 1;
  const optimize = options.optimize || false;
  const optimizeMode = options.optimizeMode || "image";
  const optimizeStyle = options.optimizeStyle || "default";
  const optimizeImage = options.optimizeImage || null;
  const images = options.images || null;

  // Get the model endpoint
  const modelEndpoint = getModelEndpoint(modelKey);

  // Get size - either from format map or use raw value
  let size = image_size[formatKey] || formatKey || "4096*4096";

  // Constrain size to model's maximum dimensions
  size = constrainDimensions(size, modelEndpoint);

  if (allPrompts) {
    // Find all .txt files in current directory
    const currentDir = process.cwd();

    try {
      const files = await fs.readdir(currentDir);
      const txtFiles = files.filter(file => file.endsWith('.txt')).sort();

      if (txtFiles.length === 0) {
        console.error("No .txt files found in the current directory.");
        process.exit(1);
      }

      console.log(`Found ${txtFiles.length} prompt file(s): ${txtFiles.join(', ')}\n`);

      // Process each .txt file
      for (const txtFile of txtFiles) {
        const promptFilePath = path.resolve(currentDir, txtFile);

        try {
          const promptText = await getPromptFromFile(promptFilePath);

          console.log(`\n${'#'.repeat(60)}\n# Processing: ${txtFile}\n${'#'.repeat(60)}\n`);

          for (let i = 0; i < count; i++) {
            if (count > 1) {
              console.log(`\n${'='.repeat(60)}\nGeneration ${i + 1} of ${count}\n${'='.repeat(60)}\n`);
            }

            // Optimize prompt if requested (once per generation)
            let finalPrompt = promptText;
            if (optimize) {
              finalPrompt = await optimizePrompt(promptText, optimizeMode, optimizeStyle, optimizeImage);
            }

            await run(finalPrompt, modelEndpoint, size, enableBase64, enableSync, images);
          }
        } catch (error) {
          console.error(`Failed to read prompt from ${txtFile}:`, error.message);
          console.log(`Skipping ${txtFile}...\n`);
        }
      }
    } catch (error) {
      console.error("Failed to read directory:", error);
      process.exit(1);
    }
  } else {
    const promptPromise = userPrompt
      ? Promise.resolve(userPrompt)
      : getPromptFromFile(path.resolve(process.cwd(), promptFile));

    promptPromise
      .then(async (promptText) => {
        for (let i = 0; i < count; i++) {
          if (count > 1) {
            console.log(`\n${'='.repeat(60)}\nGeneration ${i + 1} of ${count}\n${'='.repeat(60)}\n`);
          }

          // Optimize prompt if requested (once per generation)
          let finalPrompt = promptText;
          if (optimize) {
            finalPrompt = await optimizePrompt(promptText, optimizeMode, optimizeStyle, optimizeImage);
          }

          await run(finalPrompt, modelEndpoint, size, enableBase64, enableSync, images);
        }
      })
      .catch((error) => {
        console.error("Failed to get prompt:", error);
      });
  }
};

main();
