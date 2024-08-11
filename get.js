import Replicate from "replicate";
import fs from "fs";
import path from "path";
import https from "https";

// Check if REPLICATE_API_TOKEN is defined
if (!process.env.REPLICATE_API_TOKEN) {
    console.error("Error: REPLICATE_API_TOKEN is not defined.");
    process.exit(1);
}

// Set outputDir to REPLICATE_OUTPUT_DIR if set, otherwise default to "output"
const outputDir = process.env.REPLICATE_OUTPUT_DIR || path.join(process.cwd(), "output");

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});

// Get predictionId from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Error: predictionId is not provided.");
    process.exit(1);
}
const predictionId = args[0];

async function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        const options = {
            headers: {
                'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`
            }
        };
        https.get(url, options, (response) => {
            response.pipe(file);
            file.on("finish", () => {
                file.close(resolve);
                console.log(`Downloaded prediction to ${filePath}, from ${url}`);
            });
        }).on("error", (err) => {
            fs.unlink(filePath, () => reject(err));
        });
    });
}

async function getPredictionAndDownload() {
    try {
        console.log("Getting prediction...");
        const prediction = await replicate.predictions.get(predictionId);
        console.log(prediction);

        prediction.output.forEach(async outputUrl => {
            const filePath = path.join(outputDir, `${predictionId}.jpg`);
            await downloadFile(outputUrl, filePath); 
        });
    } catch (error) {
        console.error(`Failed to download prediction ${predictionId}:`, error);
    }
}

getPredictionAndDownload();