#!/usr/bin/env node

import * as fal from "@fal-ai/serverless-client";
import { promises as fs } from 'fs';
import path from 'path';
// For Node.js versions below 18
import fetch from 'node-fetch';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

fal.config({
    credentials: process.env.FAL_KEY,
});

const image_size = {
    'square': 'square',
    'square_hd': 'square_hd',
    'portrait': 'portrait_4_3',
    'tall': 'portrait_16_9',
    'normal': 'landscape_4_3',
    'landscape': 'landscape_16_9',
    'wide': 'landscape_16_9'
};
const modelEndpoints = {
    'pro': 'fal-ai/flux-pro/new',
    'pro11': 'fal-ai/flux-pro/v1.1',
    'dev': 'fal-ai/flux/dev',
    'lora': 'fal-ai/flux-lora',
    'schnell': 'fal-ai/flux/schnell',
    'realism': 'fal-ai/flux-realism',
    'diff': 'fal-ai/flux-differential-diffusion',
    'SD3': 'fal-ai/stable-diffusion-v3-medium',
    'SD35': 'fal-ai/stable-diffusion-v35-large',
    'anime': 'fal-ai/stable-cascade/sote-diffusion',
    'red-panda': 'fal-ai/recraft-v3',
    'omnigen': 'fal-ai/omnigen-v1',
};
const loraNames = {
    'disney':           { url: 'https://civitai.com/api/download/models/825954?type=Model&format=SafeTensor', scale: '1', keyword: 'DisneyRenstyle' },
    'lucid':            { url: 'https://civitai.com/api/download/models/857586?type=Model&format=SafeTensor', scale: '1', keyword: 'Lucid Dream' },
    'retrowave':        { url: 'https://civitai.com/api/download/models/913440?type=Model&format=SafeTensor', scale: '1', keyword: 'ck-rw, in the style of ck-rw,' },
    'incase':           { url: 'https://civitai.com/api/download/models/857267?type=Model&format=SafeTensor', scale: '1', keyword: 'Incase art' },
    'eldritch':         { url: 'https://civitai.com/api/download/models/792184?type=Model&format=SafeTensor', scale: '1', keyword: 'Eldritch Comic' },
    'details_alt':      { url: 'https://civitai.com/api/download/models/839689?type=Model&format=SafeTensor', scale: '1', keyword: '' },
    'details':          { url: 'https://civitai.com/api/download/models/955535?type=Model&format=SafeTensor', scale: '1', keyword: 'aidmafluxpro1.1' },
    'details_strong':   { url: 'https://civitai.com/api/download/models/839637?type=Model&format=SafeTensor', scale: '1', keyword: '' },
    'realistic_skin':   { url: 'https://civitai.com/api/download/models/876368?type=Model&format=SafeTensor', scale: '1', keyword: '' },
    'mj':               { url: 'https://civitai.com/api/download/models/827351?type=Model&format=SafeTensor', scale: '1', keyword: 'aidmaMJ6.1' },
    'fantasy':          { url: 'https://civitai.com/api/download/models/880134?type=Model&format=SafeTensor', scale: '1', keyword: '' },
    'poly':             { url: 'https://civitai.com/api/download/models/812320?type=Model&format=SafeTensor', scale: '1', keyword: '' },
    'cinematic':        { url: 'https://civitai.com/api/download/models/857668?type=Model&format=SafeTensor', scale: '1', keyword: 'cinematic, cinematic still image' },
    'anime-flat':       { url: 'https://civitai.com/api/download/models/838667?type=Model&format=SafeTensor', scale: '1', keyword: 'Flat colour anime style image showing' },
    'anime':            { url: 'https://civitai.com/api/download/models/753053?type=Model&format=SafeTensor', scale: '1', keyword: 'MythAn1m3' },
    'anime-portrait':   { url: 'https://civitai.com/api/download/models/753053?type=Model&format=SafeTensor', scale: '1', keyword: 'MythP0rt' },
    'niji':             { url: 'https://civitai.com/api/download/models/855516?type=Model&format=SafeTensor', scale: '1', keyword: 'aidmanijiv6' },
    'fantasy-core':     { url: 'https://civitai.com/api/download/models/905789?type=Model&format=SafeTensor', scale: '1', keyword: 'This is a highly detailed, CGI-rendered digital artwork depicting a' },
};
let DEBUG = false;

const parseArgs = () => {
    const args = process.argv.slice(2);
    let userPrompt = null;
    let modelKey = null;
    let formatKey = null;
    let loraKey = null;
    let allPrompts = false;
    let seed = null;
    let index = null;
    let showHelp = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--prompt' && i + 1 < args.length) {
            userPrompt = args[i + 1];
            i++;
        } else if (args[i] === '--model' && i + 1 < args.length) {
            modelKey = args[i + 1];
            i++;
        } else if (args[i] === '--format' && i + 1 < args.length) {
            formatKey = args[i + 1];
            i++;
        } else if (args[i] === '--lora' && i + 1 < args.length) {
            loraKey = args[i + 1];
            i++;
        } else if (args[i] === '--seed' && i + 1 < args.length) {
            seed = args[i + 1];
            i++;
        } else if (args[i] === '--index' && i + 1 < args.length) {
            index = args[i + 1];
            i++;
        } else if (args[i] === '--debug') {
            DEBUG = true;
        } else if (args[i] === '--all-prompts') {
            allPrompts = true;
        } else if (args[i] === '-h' || args[i] === '--help') {
            showHelp = true;
        }
    }

    if (showHelp) {
        console.log(`
Usage: node script.js [options]

Options:
  --prompt <text>         Specify the text prompt for image generation.
                          If omitted, a random prompt from 'prompts.txt' is used.

  --model <modelKey>      Choose the AI model to use. Available models:
                            - pro       : fal-ai/flux-pro/new
                            - pro11     : fal-ai/flux-pro/v1.1
                            - dev       : fal-ai/flux/dev
                            - lora      : fal-ai/flux-lora
                            - schnell   : fal-ai/flux-schnell
                            - realism   : fal-ai/flux-realism
                            - diff      : fal-ai/flux-differential-diffusion
                            - SD3       : fal-ai/stable-diffusion-v3-medium
                            - anime     : fal-ai/stable-cascade/sote-diffusion
                          Default is 'fal-ai/flux-pro/new' or 'fal-ai/flux-lora' if --lora is specified.

  --format <formatKey>    Specify image size/format. Available formats:
                            - small, square, portrait, tall,
                              normal, landscape, wide
                          Default is 'square'.

  --lora <loraKey>        Apply a LoRA (Low-Rank Adaptation) model. Available LoRAs:
                            - disney, lucid, retrowave, incase,
                              eldritch, details, details_strong,
                              realistic_skin, mj, fantasy,
                              poly, cinematic, anime

  --seed <number>         Set a seed for randomization to reproduce results.

  --index <number>        Use a specific prompt from 'prompts.txt' by line number.

  --debug                 Enable debug mode to display additional logs.

  --all-prompts           Generate images for all prompts in 'prompts.txt'.

  -h, --help              Display this help message.

Description:
  This script generates images using the FAL AI serverless client.
  You can provide custom prompts, select models, and adjust settings
  to customize the image generation process.

Examples:
  falflux --prompt "A futuristic cityscape at dusk" --model pro --format wide
  falflux --lora disney --index 5 --seed 12345
  falflux --all-prompts --model anime

Notes:
  - If 'prompts.txt' is used, ensure it exists in the same directory as where you run the script.
  - The 'FAL_KEY' environment variable must be set with your FAL AI API key.
  - Images are saved to the directory specified by 'FAL_PATH' or './images' by default.
        `);
        process.exit(0);
    }
    return { userPrompt, modelKey, formatKey, loraKey, allPrompts, seed, index };
};

const getFalPath = () => {
    const falPath = process.env.FAL_PATH || path.resolve(__dirname, 'images');
    return falPath;
};

const getFileNameFromUrl = (url) => {
    const parsedUrl = new URL(url);
    const fileName = parsedUrl.pathname.split('/').pop();
    return fileName;
};

const getPromtFromFile = async (filePath, index = null) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const lines = data.split('\n').filter(Boolean);
        const randomIndex = Math.floor(Math.random() * lines.length);
        const randomLine = lines[index || randomIndex];
        return randomLine.trim();
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
};

const getAllPrompts = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const lines = data.split('\n').map(line => line.trim()).filter(Boolean);
        return lines;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
};

const saveImage = async (buffer, fileName) => {
    const falPath = getFalPath();
    const filePath = path.join(falPath, fileName);
    await fs.mkdir(falPath, { recursive: true });

    try {
        await fs.writeFile(filePath, buffer);
        console.log(`Image saved: ${filePath}`);
    } catch (error) {
        console.error(`Failed to save image to ${filePath}:`, error);
    }
};

const fetchImages = async (imageUrls) => {
    try {
        const imageFetches = imageUrls.map(async (urlObj, index) => {
            const url = urlObj.url;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch image from ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const fileName = getFileNameFromUrl(url);
            await saveImage(buffer, fileName);
        });

        await Promise.all(imageFetches);
    } catch (error) {
        console.error("Error fetching and saving images:", error);
    }
};

const run = async (prompt, modelEndpoint, format, loraObject, seed) => {
    let count = 0;

    let result;
    const input = {
        prompt,
        image_size: format,
        num_inference_steps: 30,
        guidance_scale: 3.4,
        num_images: 1,
        safety_tolerance: "6",
        "enable_safety_checker": false
    };
    if (loraObject) {
        input.loras = [{
            path: loraObject.url,
            scale: loraObject.scale
        }];
        input.prompt = loraObject.keyword + '. ' + input.prompt;
    }
    if (seed) {
        input.seed = seed;
    }
    try {
        result = await fal.subscribe(modelEndpoint,
            {
                input,
                logs: false,
                options: {},
                onQueueUpdate: (update) => {
                    if (update.status === "IN_QUEUE") {
                        process.stdout.write(`\r${update.status}: position ${update.queue_position}.`);
                    } else if (update.status === "IN_PROGRESS") {
                        process.stdout.write(`\r${update.status}: ${count++} sec.           `);
                    } else if (update.status === "COMPLETED") {
                        process.stdout.write("\rDONE ✔                                    \n");
                    }
                }
            }
        );
        if (DEBUG)
            console.log(result);
    } catch (error) {
        console.error("Error during API call:", error);
        return;
    }

    if (result && Array.isArray(result.images) && result.images.length > 0) {
        const imageUrls = result.images;
        await fetchImages(imageUrls);
    } else {
        console.error("No images returned from the API.");
    }
};

const { userPrompt, modelKey, formatKey, loraKey, seed, index } = parseArgs();

// Get the model endpoint from the dictionary
const pictureFormat = image_size[formatKey] || "square_hd";
const prompt = userPrompt || await getPromtFromFile(path.resolve(process.cwd(), 'prompts.txt'), index);
const loraObject = loraNames[loraKey] || null;
const modelEndpoint = modelEndpoints[modelKey] || (loraObject ? 'fal-ai/flux-lora' : 'fal-ai/flux-pro');

run(prompt, modelEndpoint, pictureFormat, loraObject, seed);
