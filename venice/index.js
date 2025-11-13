#!/usr/bin/env node

import fetch from "node-fetch";
import { promises as fs } from "fs";

import { setupCLI } from "./cli.js";
import {
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_STEPS,
    DEFAULT_CFG_SCALE,
    DEFAULT_HIDE_WATERMARK,
    DEFAULT_RETURN_BINARY,
    image_size
} from "./config.js";
import {
    getModelEndpoint,
    getModelConstraints
} from "./models.js";
import {
    saveImage} from "./utils.js";

let DEBUG = false;

// Function to read prompt from file
const readPromptFromFile = async (filePath) => {
    try {
        const prompt = await fs.readFile(filePath, 'utf8');
        return prompt.trim();
    } catch (error) {
        if (DEBUG) {
            console.error(`Failed to read prompt from ${filePath}:`, error);
        }
        return null;
    }
};

const run = async (options) => {
    // Validate API token
    if (!process.env.VENICE_API_TOKEN) {
        console.error("Error: VENICE_API_TOKEN environment variable is not set.");
        process.exit(1);
    }

    // If no prompt provided via CLI, try to read from ./prompt.txt
    if (!options.prompt) {
        const promptFromFile = await readPromptFromFile('./prompt.txt');
        if (promptFromFile) {
            options.prompt = promptFromFile;
            console.log(`Using prompt from ./prompt.txt.`);
        } else {
            console.error("Error: No prompt provided. Please use --prompt or create a ./prompt.txt file.");
            process.exit(1);
        }
    }

    // Get model constraints for proper width/height divisor
    const modelConstraints = getModelConstraints(options.model);
    const divisor = modelConstraints.widthHeightDivisor;

    let _width = Math.min(parseInt(options.width) || DEFAULT_WIDTH, 1280);
    let _height = Math.min(parseInt(options.height) || DEFAULT_HEIGHT, 1280);

    _width = Math.floor(_width / divisor) * divisor;
    _height = Math.floor(_height / divisor) * divisor;

    const input = {
        model: getModelEndpoint(options.model),
        prompt: options.prompt,
        width: _width,
        height: _height,
        steps: Math.min(parseInt(options.steps) || DEFAULT_STEPS, modelConstraints.maxSteps),
        cfg_scale: parseFloat(options.cfgScale) || DEFAULT_CFG_SCALE,
        hide_watermark: options.hideWatermark || DEFAULT_HIDE_WATERMARK,
        return_binary: options.returnBinary || DEFAULT_RETURN_BINARY,
        safe_mode: false
    };

    // Warn if steps was capped
    if (options.steps && parseInt(options.steps) > modelConstraints.maxSteps) {
        console.warn(`\nWarning: Steps value was capped at ${modelConstraints.maxSteps} (maximum for this model)`);
    }

    // Optional parameters
    if (options.seed !== undefined) input.seed = parseInt(options.seed);
    if (options.lora) input.style_preset = options.lora;
    if (options.negativePrompt) input.negative_prompt = options.negativePrompt;
    if (options.outputFormat) input.format = options.outputFormat;
    if (options.loraStrength !== undefined) input.lora_strength = Math.min(Math.max(parseInt(options.loraStrength), 0), 100);
    if (options.embedExifMetadata) input.embed_exif_metadata = true;

    // Variants handling - only send if > 1 or if return_binary is false
    if (options.variants !== undefined) {
        const variantsValue = Math.min(Math.max(parseInt(options.variants), 1), 4);

        // Only include variants parameter if > 1 or return_binary is already false
        if (variantsValue > 1 || !input.return_binary) {
            if (variantsValue > 1 && input.return_binary) {
                console.warn("\nWarning: Variants only work when return_binary is false. Setting return_binary to false.");
                input.return_binary = false;
            }
            input.variants = variantsValue;
        }
    }

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
        // Display generation header
        console.log('__Generating image' + '_'.repeat(60 - 18));
        console.log(`Model: ${input.model}`);
        console.log(`Dimensions: ${input.width}x${input.height}`);
        console.log(`Steps: ${input.steps} | CFG Scale: ${input.cfg_scale}`);
        if (input.seed) {
            console.log(`Seed: ${input.seed}`);
        }
        console.log('‾'.repeat(60) + '\n');

        // Track generation time
        const startTime = Date.now();
        let elapsed = 0;

        // Show progress indicator
        const progressInterval = setInterval(() => {
            elapsed = Math.floor((Date.now() - startTime) / 1000);
            process.stdout.write(`\r🎨 Generating... ${elapsed}s      `);
        }, 1000);

        const response = await fetch("https://api.venice.ai/api/v1/image/generate", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.VENICE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
        });

        clearInterval(progressInterval);
        process.stdout.write('\r✨ Generation complete!                                    \n');

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
        const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);

        await saveImage(buffer, fileName);

        // Display generation summary
        console.log('\n' + '__ Generation Summary ' + '_'.repeat(38));
        if (input.seed) {
            console.log(`Seed: ${input.seed}`);
        }
        console.log(`Total time: ${generationTime}s`);
        console.log(`Dimensions: ${input.width}x${input.height}`);
        console.log('‾'.repeat(60) + '\n');

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