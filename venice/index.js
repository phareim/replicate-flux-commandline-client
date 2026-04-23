#!/usr/bin/env node

import { promises as fs } from "fs";
import { spawn } from "child_process";

import { setupCLI } from "./cli.js";
import {
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_STEPS,
    DEFAULT_CFG_SCALE,
    DEFAULT_HIDE_WATERMARK,
    DEFAULT_RETURN_BINARY,
    image_size,
    stylePresets
} from "./config.js";
import {
    getModelEndpoint,
    getModelConstraints,
    stylePresets as dynamicStylePresets
} from "./models.js";
import { saveImage, saveMetadata } from "./utils.js";

const VENICE_API_URL = "https://api.venice.ai/api/v1/image/generate";
const SMOKE_MODE = process.env.VENICE_SMOKE_TEST === "1";

const mockResponse = () => {
    const buffer = Buffer.from("mock venice image");
    return {
        ok: true,
        status: 200,
        headers: { get: (name) => (name?.toLowerCase() === "content-type" ? "image/png" : null) },
        arrayBuffer: async () => buffer,
        json: async () => ({ message: "mocked response" })
    };
};

const requestImage = async (body) => {
    if (SMOKE_MODE) return mockResponse();

    return fetch(VENICE_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.VENICE_API_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
};

let DEBUG = false;
let localOutputOverride = false;

const AIWDM_CLI_DIR = "/home/petter/github/aiwdm/cli";

const uploadToAiwdm = (filePath, { prompt, rating, tags }) => {
    const args = ["upload", filePath];
    if (rating) args.push("--rating", rating);
    if (tags && tags.length) args.push("--tags", tags.join(","));
    if (prompt) args.push("--prompt", prompt);

    return new Promise((resolve) => {
        // cwd anchors the env lookup: aiwdm loads .env from cwd first.
        const proc = spawn("aiwdm", args, { stdio: "inherit", cwd: AIWDM_CLI_DIR });
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

const readPromptFromFile = async (filePath) => {
    try {
        const prompt = await fs.readFile(filePath, "utf8");
        return prompt.trim();
    } catch (error) {
        if (DEBUG) console.error(`Failed to read prompt from ${filePath}:`, error);
        return null;
    }
};

const buildInput = (options) => {
    const constraints = getModelConstraints(options.model);
    const divisor = constraints.widthHeightDivisor;

    let _width = Math.min(parseInt(options.width) || DEFAULT_WIDTH, 1280);
    let _height = Math.min(parseInt(options.height) || DEFAULT_HEIGHT, 1280);
    _width = Math.floor(_width / divisor) * divisor;
    _height = Math.floor(_height / divisor) * divisor;

    const requestedSteps = parseInt(options.steps) || DEFAULT_STEPS;
    if (options.steps && requestedSteps > constraints.maxSteps) {
        console.warn(`\nWarning: Steps value was capped at ${constraints.maxSteps} (maximum for this model)`);
    }

    const input = {
        model: getModelEndpoint(options.model),
        prompt: options.prompt,
        width: _width,
        height: _height,
        steps: Math.min(requestedSteps, constraints.maxSteps),
        cfg_scale: parseFloat(options.cfgScale) || DEFAULT_CFG_SCALE,
        hide_watermark: options.hideWatermark || DEFAULT_HIDE_WATERMARK,
        return_binary: options.returnBinary || DEFAULT_RETURN_BINARY,
        safe_mode: false,
    };

    if (options.seed !== undefined) input.seed = parseInt(options.seed);
    if (options.lora) input.style_preset = options.lora;
    if (options.negativePrompt) input.negative_prompt = options.negativePrompt;
    if (options.outputFormat) input.format = options.outputFormat;
    if (options.loraStrength !== undefined) {
        input.lora_strength = Math.min(Math.max(parseInt(options.loraStrength), 0), 100);
    }
    if (options.embedExifMetadata) input.embed_exif_metadata = true;

    if (options.variants !== undefined) {
        const variants = Math.min(Math.max(parseInt(options.variants), 1), 4);
        if (variants > 1 || !input.return_binary) {
            if (variants > 1 && input.return_binary) {
                console.warn("\nWarning: Variants only work when return_binary is false. Setting return_binary to false.");
                input.return_binary = false;
            }
            input.variants = variants;
        }
    }

    if (options.format) {
        const formatSize = image_size[options.format];
        if (formatSize) {
            input.width = formatSize.width;
            input.height = formatSize.height;
        }
    }

    return input;
};

const run = async (options) => {
    if (!process.env.VENICE_API_TOKEN) {
        console.error("Error: VENICE_API_TOKEN environment variable is not set.");
        process.exit(1);
    }

    if (!options.prompt) {
        const promptFilePath = options.file || "./prompt.txt";
        const promptFromFile = await readPromptFromFile(promptFilePath);
        if (promptFromFile) {
            options.prompt = promptFromFile;
            console.log(`Using prompt from ${promptFilePath}.`);
        } else {
            console.error("Error: No prompt provided. Please use --prompt, --file, or create a ./prompt.txt file.");
            process.exit(1);
        }
    }

    const input = buildInput(options);

    if (DEBUG) console.log("Input parameters:", JSON.stringify(input, null, 2));

    try {
        console.log("__Generating image" + "_".repeat(60 - 18));
        console.log(`Model: ${input.model}`);
        console.log(`Dimensions: ${input.width}x${input.height}`);
        console.log(`Steps: ${input.steps} | CFG Scale: ${input.cfg_scale}`);
        if (input.seed) console.log(`Seed: ${input.seed}`);
        console.log("‾".repeat(60) + "\n");

        const startTime = Date.now();
        const progressInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            process.stdout.write(`\r🎨 Generating... ${elapsed}s      `);
        }, 1000);
        process.stdout.write("\r");

        const response = await requestImage(input);

        clearInterval(progressInterval);
        process.stdout.write("\r✨ Generation complete!                                    \n");

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const result = await response.json();
            console.error(`API Error: ${response.status} - ${JSON.stringify(result, null, 2)}`);
            return;
        }
        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            return;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const fileName = `venice_${Date.now()}.png`;
        const generationTimeMs = Date.now() - startTime;
        const generationTime = (generationTimeMs / 1000).toFixed(2);

        const savedPath = await saveImage(buffer, fileName, localOutputOverride);

        if (options.metadata !== false && savedPath) {
            await saveMetadata(savedPath, {
                source: "venice",
                kind: "image",
                generated_at: new Date().toISOString(),
                cli_version: "1.0.0",
                model: input.model,
                model_key: options.model,
                prompt: input.prompt,
                negative_prompt: input.negative_prompt,
                width: input.width,
                height: input.height,
                steps: input.steps,
                cfg_scale: input.cfg_scale,
                seed: input.seed,
                style_preset: input.style_preset,
                lora_strength: input.lora_strength,
                output_format: input.format,
                hide_watermark: input.hide_watermark,
                variants: input.variants,
                generation_time_ms: generationTimeMs,
            });
        }

        if (options.aiwdm && !SMOKE_MODE && savedPath) {
            const extraTags = options.aiwdmTags
                ? options.aiwdmTags.split(",").map((t) => t.trim()).filter(Boolean)
                : [];
            const tags = ["venice", ...extraTags];
            await uploadToAiwdm(savedPath, {
                prompt: options.prompt,
                rating: options.aiwdmRating,
                tags,
            });
        }

        console.log("\n" + "__ Generation Summary " + "_".repeat(38));
        if (input.seed) console.log(`Seed: ${input.seed}`);
        console.log(`Total time: ${generationTime}s`);
        console.log(`Dimensions: ${input.width}x${input.height}`);
        console.log("‾".repeat(60) + "\n");
    } catch (error) {
        console.error("Error during image generation:", error);
    }
};

const main = async () => {
    const options = setupCLI();
    DEBUG = options.debug || false;
    localOutputOverride = options.out || false;

    if (options.randomLora) {
        const presets = dynamicStylePresets.length > 0 ? dynamicStylePresets : stylePresets;
        options.lora = presets[Math.floor(Math.random() * presets.length)];
        console.log(`\n🎲 Randomly selected LoRA (style preset): ${options.lora}\n`);
    }

    await run(options);
};

main();
