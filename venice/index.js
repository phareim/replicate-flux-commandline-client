#!/usr/bin/env node

import fetch from "node-fetch";
import path from "path";

import { setupCLI } from "./cli.js";
import {
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_STEPS,
    DEFAULT_CFG_SCALE,
    DEFAULT_SEED,
    DEFAULT_HIDE_WATERMARK,
    DEFAULT_RETURN_BINARY,
    image_size
} from "./config.js";
import {
    getModelEndpoint
} from "./models.js";
import {
    saveImage,
    getFileNameFromUrl
} from "./utils.js";

let DEBUG = false;

const run = async (options) => {
    // Validate API token
    if (!process.env.VENICE_API_TOKEN) {
        console.error("Error: VENICE_API_TOKEN environment variable is not set.");
        process.exit(1);
    }

    // Validate required parameters
    if (!options.prompt) {
        console.error("Error: --prompt is required");
        process.exit(1);
    }

    // Prepare input parameters
    const input = {
        model: getModelEndpoint(options.model),
        prompt: options.prompt,
        width: parseInt(options.width) || DEFAULT_WIDTH,
        height: parseInt(options.height) || DEFAULT_HEIGHT,
        steps: Math.min(parseInt(options.steps) || DEFAULT_STEPS, 30),
        cfg_scale: parseFloat(options.cfgScale) || DEFAULT_CFG_SCALE,
        hide_watermark: options.hideWatermark || DEFAULT_HIDE_WATERMARK,
        return_binary: options.returnBinary || DEFAULT_RETURN_BINARY,
    };

    // Warn if steps was capped
    if (options.steps && parseInt(options.steps) > 30) {
        console.warn("\nWarning: Steps value was capped at 30 (maximum allowed value)");
    }

    // Optional parameters
    if (options.seed !== undefined) input.seed = parseInt(options.seed);
    if (options.stylePreset) input.style_preset = options.stylePreset;
    if (options.negativePrompt) input.negative_prompt = options.negativePrompt;

    // Handle format option if provided
    if (options.format) {
        const formatSize = image_size[options.format];
        if (formatSize) {
            input.width = formatSize.width;
            input.height = formatSize.height;
        }
    }

    if (DEBUG) {
        console.log("Input parameters:", JSON.stringify(input, null, 2));
    }

    try {
        const response = await fetch("https://api.venice.ai/api/v1/image/generate", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.VENICE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
        });

        // Check if response is JSON (error) or binary (image)
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            // Handle JSON response (likely an error)
            const result = await response.json();
            console.error(`API Error: ${response.status} - ${JSON.stringify(result, null, 2)}`);
            return;
        }

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            return;
        }

        // Handle binary image response
        const buffer = Buffer.from(await response.arrayBuffer());
        const fileName = `venice_${Date.now()}.png`;
        
        console.log("\nGeneration successful, saving image...");
        await saveImage(buffer, fileName);

    } catch (error) {
        console.error("Error during image generation:", error);
    }
};

const main = async () => {
    const options = setupCLI();
    DEBUG = options.debug || false;

    await run(options);
};

main(); 