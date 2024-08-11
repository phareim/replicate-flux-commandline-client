import Replicate from "replicate";
import fs from "fs";
import path from "path";
import https from "https";

// Check if REPLICATE_API_TOKEN is defined
if (!process.env.REPLICATE_API_TOKEN) {
    console.error("Error: REPLICATE_API_TOKEN is not defined.");
    process.exit(1);
}
const replicate = new Replicate();

// Set outputDir to REPLICATE_OUTPUT_DIR if set, otherwise default to "output"
const outputDir = process.env.REPLICATE_OUTPUT_DIR || path.join(process.cwd(), "output");

async function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on("finish", () => {
                file.close(resolve);
            });
        }).on("error", (err) => {
            fs.unlink(filePath);
            reject(err);
        });
    });
}

async function listPredictions() {
    const page = await replicate.predictions.list();
    console.log(`You've created ${page.results.length} images.`);

    for (const prediction of page.results) {
        const filePath = path.join(outputDir, `${prediction.id}.jpg`);
        
        if (!fs.existsSync(filePath)) {
            try {
                console.log("Getting prediction...");
                const predictionDetails = await replicate.predictions.get(prediction.id);
                const outputUrl = predictionDetails.output;
                await downloadFile(outputUrl, filePath);
                console.log(`Downloaded prediction ${prediction.id} to ${filePath}`);
            } catch (error) {
                console.error(`Failed to download prediction ${prediction.id}:`, error);
            }
        } else {
            console.log(`Prediction ${prediction.id} already exists.`);
        }
    }
}

listPredictions();