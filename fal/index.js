import * as fal from "@fal-ai/serverless-client";
import { promises as fs } from 'fs';
import path from 'path';

// Function to get the FAL_PATH from the environment
const getFalPath = () => {
    const falPath = process.env.FAL_PATH || path.resolve(__dirname, 'images');
    return falPath;
};

// Function to get random prompt from prompts.txt file
const getRandomPrompt = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const lines = data.split('\n').filter(Boolean); // Filter out empty lines
        const randomLine = lines[Math.floor(Math.random() * lines.length)];
        return randomLine.trim(); // Ensure no trailing/leading spaces
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
};

// Function to save blob as file
const saveImage = async (blob, fileName) => {
    const falPath = getFalPath(); // Get the FAL_PATH
    const filePath = path.join(falPath, fileName); // Build the full path
    const arrayBuffer = await blob.arrayBuffer(); // Convert blob to array buffer
    const buffer = Buffer.from(arrayBuffer); // Convert array buffer to buffer
    
    try {
        await fs.writeFile(filePath, buffer);
        console.log(`Image saved successfully to ${filePath}`);
    } catch (error) {
        console.error(`Failed to save image to ${filePath}:`, error);
    }
};

const run = async () => {
    const filePath = path.resolve(__dirname, 'prompts.txt');
    let count = 0;
    
    // Get random prompt from file
    const prompt = await getRandomPrompt(filePath);
    console.log(`Using prompt: "${prompt}"`);
    
    // Use the random prompt with fal-ai client
    const result = await fal.subscribe("fal-ai/flux-pro", {
        input: {
            prompt: prompt, // Use the random prompt here
        },
        logs: false,
        onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
                process.stdout.write(`\rProcessing... ${count++}`);
            }
        },
    });
    
    // Fetch the images from the result.images array
    const fetchImages = async (imageUrls) => {
        try {
            const imageFetches = imageUrls.map(async (url, index) => {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image from ${url}`);
                }
                const blob = await response.blob();
                const fileName = `image_${index + 1}.png`; // Define a file name for each image
                await saveImage(blob, fileName); // Save the image to the file system
            });
            
            await Promise.all(imageFetches);
            console.log("All images fetched and saved successfully.");
        } catch (error) {
            console.error("Error fetching and saving images:", error);
        }
    };
    
    // Assuming result.images contains the URLs
    if (result && Array.isArray(result.images) && result.images.length > 0) {
        const imageUrls = result.images;
        await fetchImages(imageUrls);
    } else {
        console.error("No images returned from the API.");
    }
};

run();
