#!/usr/bin/env node

import path from "path";
import fetch from "node-fetch";

import { setupCLI } from "./cli.js";
import { getPromptFromFile } from "./utils.js";
import { getModelEndpoint, getModelInfo } from "./models.js";
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
 * Main generation function
 */
const run = async (prompt, modelEndpoint, size, enableBase64, enableSync) => {
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
  const promptFile = options.promptFile || "prompt.txt";
  const modelKey = options.model;
  const formatKey = options.format;
  const allPrompts = options.allPrompts || false;
  const enableBase64 = options.enableBase64 || false;
  const enableSync = options.sync || false;

  // Get the model endpoint
  const modelEndpoint = getModelEndpoint(modelKey);

  // Get size - either from format map or use raw value
  const size = image_size[formatKey] || formatKey || "2048*2048";

  if (allPrompts) {
    const promptFilePath = path.resolve(process.cwd(), promptFile);
    getPromptFromFile(promptFilePath)
      .then(async (promptText) => {
        console.log(`Generating image for ${promptFile}`);
        await run(promptText, modelEndpoint, size, enableBase64, enableSync);
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
        run(promptText, modelEndpoint, size, enableBase64, enableSync);
      })
      .catch((error) => {
        console.error("Failed to get prompt:", error);
      });
  }
};

main();
