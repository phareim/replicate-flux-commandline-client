import Replicate from "replicate";

const replicate = new Replicate();

async function listPredictions() {
    const page = await replicate.predictions.list();
    console.log(`You've created ${page.results.length} images.`);
    //=> [{ "id": "xyz...", "status": "successful", ... }, { ... }]
    //=> "https://bflapistorage.blob.core.windows.net/public/c8145..."
}

listPredictions();