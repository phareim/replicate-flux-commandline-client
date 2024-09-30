#!/usr/bin/env node

import * as fal from "@fal-ai/serverless-client";
import { promises as fs } from 'fs';
import path, { format } from 'path';
// For Node.js versions below 18
import fetch from 'node-fetch';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

fal.config({
    credentials: process.env.FAL_KEY,
  });

const image_size = {
    'small':'square', 
    'square':'square_hd', 
    'portrait':'portrait_4_3', 
    'tall':'portrait_16_9', 
    'normal':'landscape_4_3', 
    'landscape':'landscape_16_9',
    'wide':'landscape_16_9'
};
const modelEndpoints = {
    'pro': 'fal-ai/flux-pro',
    'dev': 'fal-ai/flux-dev',
    'lora': 'fal-ai/flux-lora',
    'schnell':'fal-ai/flux/schnell',
    'realism': 'fal-ai/flux-realism',
    'diff': 'fal-ai/flux-differential-diffusion',
    'SD3': 'fal-ai/stable-diffusion-v3-medium',
    'anime': 'fal-ai/stable-cascade/sote-diffusion'
};
const loraNames = { 
    'incase': 'https://civitai.com/api/download/models/857267?type=Model&format=SafeTensor',
    'eldritch': 'https://civitai.com/api/download/models/792184?type=Model&format=SafeTensor',
    'details': 'https://civitai.com/api/download/models/839689?type=Model&format=SafeTensor',
    'realistic_skin': 'https://civitai.com/api/download/models/876368?type=Model&format=SafeTensor'
};  
let DEBUG = false;

// Function to parse command-line arguments
const parseArgs = () => {
    const args = process.argv.slice(2);
    let userPrompt = null;
    let modelKey = null;
    let formatKey = null;
    let loraKey = null;
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--prompt' && i + 1 < args.length) {
            userPrompt = args[i + 1];
            i++;
        } else if (args[i] === '--model' && i + 1 < args.length) {
            modelKey = args[i + 1];
            i++;
        }else if (args[i] === '--format' && i + 1 < args.length) {
            formatKey = args[i + 1];
            i++;
        }else if (args[i] === '--lora' && i + 1 < args.length) {
            loraKey = args[i + 1];
            i++;
        }else if (args[i] === '--debug' && i + 1 < args.length) {
            DEBUG = true;
            i++;
        }
    }
    
    return { userPrompt, modelKey, formatKey, loraKey };
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

// Function to get random prompt from prompts.txt file
const getRandomPrompt = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const lines = data.split('\n').filter(Boolean);
        const randomLine = lines[Math.floor(Math.random() * lines.length)];
        return randomLine.trim();
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
};

// Function to save buffer as file
const saveImage = async (buffer, fileName) => {
    const falPath = getFalPath();
    const filePath = path.join(falPath, fileName);
    
    // Ensure the directory exists
    await fs.mkdir(falPath, { recursive: true });
    
    try {
        await fs.writeFile(filePath, buffer);
        console.log(`Image saved: ${filePath}`);
    } catch (error) {
        console.error(`Failed to save image to ${filePath}:`, error);
    }
};

// Fetch images from URLs and save them
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

const run = async (prompt, modelEndpoint, format, loraUrl) => {
    let count = 0;
    
    let result;
    const input = { 
        prompt,
        image_size: format,
        num_inference_steps: 50,
        guidance_scale: 3.5,
        num_images: 1,
        safety_tolerance: "6",
        "enable_safety_checker": false
    };
    if (loraUrl) {
        input.loras = [{
            path: loraUrl,
        }];
    }
    try {
        result = await fal.subscribe(modelEndpoint,
            {
                input,
                logs: false,
                options: {},
                onQueueUpdate: (update) => {
                    process.stdout.write(`\r${update.status}: ${count++} sec.`);
                    if (update.status === "COMPLETED") {
                        process.stdout.write("                               \r\n");
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
    
    // Assuming result.images contains the URLs
    if (result && Array.isArray(result.images) && result.images.length > 0) {
        const imageUrls = result.images;
        await fetchImages(imageUrls);
    } else {
        console.error("No images returned from the API.");
    }
};

const { userPrompt, modelKey, formatKey,loraKey } = parseArgs();

// Get the model endpoint from the dictionary
const pictureFormat = image_size[formatKey] || "square_hd";
const prompt = userPrompt || await getRandomPrompt(path.resolve(__dirname, 'prompts.txt'));
const loraUrl = loraNames[loraKey] || null;
const modelEndpoint = modelEndpoints[modelKey] || (loraKey?'fal-ai/flux-lora':'fal-ai/flux-pro'); // Default model

run(prompt, modelEndpoint, pictureFormat, loraUrl);
