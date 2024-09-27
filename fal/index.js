import * as fal from "@fal-ai/serverless-client";
import { promises as fs } from 'fs';
import path from 'path';
// For Node.js versions below 18
import fetch from 'node-fetch';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        console.log(`Image saved successfully to ${filePath}`);
    } catch (error) {
        console.error(`Failed to save image to ${filePath}:`, error);
    }
};

// Fetch images from URLs and save them
const fetchImages = async (imageUrls) => {
    console.log(imageUrls);
    /*
    {
    url: 'https://fal.media/files/koala/MukELGM-TP46m_F5CzL-e_55435d277d064ff284c0d35629c22a8f.png',
    width: 1024,
    height: 768,
    content_type: 'image/png'
    }
    */
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
        console.log("All images fetched and saved successfully.");
    } catch (error) {
        console.error("Error fetching and saving images:", error);
    }
};

const run = async () => {
    const filePath = path.resolve(__dirname, 'prompts.txt');
    let count = 0;
    
    // Get random prompt from file
    const prompt = await getRandomPrompt(filePath);
    // console.log(`Using prompt: "${prompt}"`);
    
    // Use the random prompt with fal-ai client
    let result;
    try {
        result = await fal.subscribe("fal-ai/flux-pro", {
            input: { prompt,
                image_size: "portrait_4_3",
                num_inference_steps: 50,
                guidance_scale: 3.5,
                num_images: 1,
                safety_tolerance: "6"
             },
            logs: true,
            onQueueUpdate: (update) => {
                process.stdout.write(`\r${update.status} ${count++}`);
            },
        });

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

run();
