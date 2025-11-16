import Replicate from "replicate";
import fs from "fs";
import path from "path";
import https from "https";

const SMOKE_TEST = process.env.REPLICATE_SMOKE_TEST === "1";

if (!process.env.REPLICATE_API_TOKEN) {
    console.error("Error: REPLICATE_API_TOKEN is not defined.");
    process.exit(1);
}

const outputDir = process.env.REPLICATE_OUTPUT_DIR || path.join(process.cwd(), "output");

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});


// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function downloadFile(url, filePath) {
    if (SMOKE_TEST) {
        await fs.promises.writeFile(filePath, `mock data for ${url}`);
        return;
    }

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on("finish", () => {
                file.close(resolve);
            });
        }).on("error", (err) => {
            fs.unlink(filePath, () => reject(err));
        });
    });
}

async function getAllPredictions() {
    if (SMOKE_TEST) {
        const mockResults = [
            { id: "mock-prediction-1", output: ["https://example.com/mock.jpg"] }
        ];
        console.log(`You've created ${mockResults.length} images. (mock)`);
        console.log("Getting predictions...");
        for (const prediction of mockResults) {
            const filePath = path.join(outputDir, `${prediction.id}.jpg`);
            await downloadFile(prediction.output[0], filePath);
            console.log(`Downloaded prediction ${prediction.id} to ${filePath}`);
        }
        console.log("Already downloaded: 0");
        console.log("Empty output: 0");
        console.log(`Downloaded: ${mockResults.length}`);
        return;
    }

    const page = await replicate.predictions.list();
    console.log(`You've created ${page.results.length} images.`);
    console.log("Getting predictions...");
    let alreadyDownloaded = 0;
    let downloaded = 0;
    let emptyOutput = 0;
    for (const prediction of page.results) {
        const filePath = path.join(outputDir, `${prediction.id}.jpg`);
        
        if (!fs.existsSync(filePath)) {
            try {
                const predictionDetails = await replicate.predictions.get(prediction.id);
                if (!predictionDetails.output) {
                    emptyOutput++;
                } else {
                    if(predictionDetails.output.forEach){
                        predictionDetails.output.forEach(async outputUrl => {
                            if (!outputUrl || outputUrl.length < 10) {
                                emptyOutput++;
                            }else {
                                await downloadFile(outputUrl, filePath);
                                console.log(`Downloaded prediction ${prediction.id} to ${filePath}`);
                                downloaded++; 
                            }
                        });
                    } 
                    else {
                        await downloadFile(predictionDetails.output, filePath);
                        console.log(`Downloaded prediction ${prediction.id} to ${filePath}`);
                        downloaded++; 
                    }
                }
            } catch (error) {
                console.error(`Failed to download prediction ${prediction.id}:`, error);
            }
        } else {
            alreadyDownloaded++;
        }
    }
    console.log(`Already downloaded: ${alreadyDownloaded}`);
    console.log(`Empty output: ${emptyOutput}`);
    console.log(`Downloaded: ${downloaded}`);
}

getAllPredictions();
