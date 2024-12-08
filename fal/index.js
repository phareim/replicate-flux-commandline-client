#!/usr/bin/env node

import * as fal from "@fal-ai/serverless-client";
import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import fetch from "node-fetch";

const program = new Command();

let local_output_override = false;
let DEBUG = false;

fal.config({
  credentials: process.env.FAL_KEY,
});

const image_size = {
  square: "square",
  square_hd: "square_hd",
  portrait: "portrait_4_3",
  portrait_4_3: "portrait_4_3",
  tall: "portrait_16_9",
  portrait_16_9: "portrait_16_9",
  normal: "landscape_4_3",
  landscape_4_3: "landscape_4_3",
  landscape: "landscape_16_9",
  wide: "landscape_16_9",
  landscape_16_9: "landscape_16_9",
};

const image_size_new = {
  "21:9": "21:9",
  "16:9": "16:9",
  "4:3": "4:3",
  "1:1": "1:1",
  "3:4": "3:4",
  "9:16": "9:16",
  "9:21": "9:21",
  square: "1:1",
  portrait: "3:4",
  tall: "9:16",
  xtall: "9:21",
  normal: "4:3",
  landscape: "16:9",
  wide: "21:9",
};

const modelEndpoints = {
  pro: "fal-ai/flux-pro/new",
  pro11: "fal-ai/flux-pro/v1.1",
  dev: "fal-ai/flux/dev",
  lora: "fal-ai/flux-lora",
  schnell: "fal-ai/flux/schnell",
  realism: "fal-ai/flux-realism",
  diff: "fal-ai/flux-differential-diffusion",
  SD3: "fal-ai/stable-diffusion-v3-medium",
  SD35: "fal-ai/stable-diffusion-v35-large",
  anime: "fal-ai/stable-cascade/sote-diffusion",
  "red-panda": "fal-ai/recraft-v3",
  omnigen: "fal-ai/omnigen-v1",
  ultra: "fal-ai/flux-pro/v1.1-ultra",
  "ultra-redux": "fal-ai/flux-pro/v1.1-ultra/redux",
};

const loraNames = {
  disney: {
    url: "https://civitai.com/api/download/models/825954?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "DisneyRenstyle",
  },
  lucid: {
    url: "https://civitai.com/api/download/models/857586?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "Lucid Dream",
  },
  retrowave: {
    url: "https://civitai.com/api/download/models/913440?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "ck-rw, in the style of ck-rw,",
  },
  incase: {
    url: "https://civitai.com/api/download/models/857267?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "Incase art",
  },
  eldritch: {
    url: "https://civitai.com/api/download/models/792184?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "Eldritch Comic",
  },
  details_alt: {
    url: "https://civitai.com/api/download/models/839689?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "",
  },
  details: {
    url: "https://civitai.com/api/download/models/955535?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "aidmafluxpro1.1",
  },
  details_strong: {
    url: "https://civitai.com/api/download/models/839637?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "",
  },
  realistic_skin: {
    url: "https://civitai.com/api/download/models/876368?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "",
  },
  mj: {
    url: "https://civitai.com/api/download/models/827351?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "aidmaMJ6.1",
  },
  fantasy: {
    url: "https://civitai.com/api/download/models/880134?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "",
  },
  poly: {
    url: "https://civitai.com/api/download/models/812320?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "",
  },
  cinematic: {
    url: "https://civitai.com/api/download/models/857668?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "cinematic, cinematic still image",
  },
  "anime-flat": {
    url: "https://civitai.com/api/download/models/838667?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "Flat colour anime style image showing",
  },
  anime: {
    url: "https://civitai.com/api/download/models/753053?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "MythAn1m3",
  },
  "anime-portrait": {
    url: "https://civitai.com/api/download/models/753053?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "MythP0rt",
  },
  niji: {
    url: "https://civitai.com/api/download/models/855516?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "aidmanijiv6",
  },
  "fantasy-core": {
    url: "https://civitai.com/api/download/models/905789?type=Model&format=SafeTensor",
    scale: "1",
    keyword:
      "This is a highly detailed, CGI-rendered digital artwork depicting a",
  },
  goofy: {
    url: "https://civitai.com/api/download/models/830009?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "3d render ",
  },
  psychedelic: {
    url: "https://civitai.com/api/download/models/983116?type=Model&format=SafeTensor",
    scale: "0.6",
    keyword: "ArsMovieStill, movie still from a 60s psychedelic movie",
  },
  neurocore: {
    url: "https://civitai.com/api/download/models/1010560?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "A digital artwork in the style of cknc,",
  },
  "anime-realistic": {
    url: "https://civitai.com/api/download/models/1023735?type=Model&format=SafeTensor",
    scale: "1",
    keyword: "Realistic anime style,",
  },
};

program
  .version("1.0.0")
  .description(
    "This script generates images using the FAL AI serverless client. You can provide custom prompts, select models, and adjust settings to customize the image generation process."
  )
  .option(
    "--prompt <text>",
    'Specify the text prompt for image generation. If omitted, a random prompt from "prompts.txt" is used.'
  )
  .option("--model <modelKey>", "Choose the AI model to use.")
  .option("--format <formatKey>", "Specify image size/format.")
  .option(
    "--lora <loraKeys>",
    "Apply one or more LoRAs (comma-separated).",
    (value, previous) =>
      previous
        ? previous.concat(value.split(",").map((s) => s.trim()))
        : value.split(",").map((s) => s.trim())
  )
  .option(
    "--seed <number>",
    "Set a seed for randomization to reproduce results."
  )
  .option("--scale <number>", "Set the scale for guidance.")
  .option(
    "--out",
    "Save images to the current directory instead of the default."
  )
  .option(
    "--index <number>",
    'Use a specific prompt from "prompts.txt" by line number.'
  )
  .option("--debug", "Enable debug mode to display additional logs.")
  .option("--all-prompts", 'Generate images for all prompts in "prompts.txt".')
  .helpOption("-h, --help", "Display this help message.")
  .on("--help", () => {
    // Generate the list of available models
    const availableModels = Object.keys(modelEndpoints)
      .map((key) => `  - ${key.padEnd(10)}: ${modelEndpoints[key]}`)
      .join("\n");

    // Generate the list of available LoRAs
    const availableLoras = Object.keys(loraNames)
      .map((key) => key)
      .join(", ");

    // Generate the list of available formats
    let availableFormats = null;
    if (model.indexOf("ultra") > -1) {
      availableFormats = Object.keys(image_size_new).join(", ");
    } else {
      availableFormats = Object.keys(image_size).join(", ");
    }
    console.log(`
Available Models:
${availableModels}

Available LoRAs:
${availableLoras}

Available Formats:
${availableFormats}

Examples:
  node your_script_name.js --prompt "A futuristic cityscape at dusk" --model pro --format wide
  node your_script_name.js --lora disney --index 5 --seed 12345
  node your_script_name.js --lora disney,lucid --prompt "An enchanted forest"
  node your_script_name.js --lora retrowave --lora incase --prompt "A cyberpunk skyline"
  node your_script_name.js --all-prompts --model anime

Notes:
  - If 'prompts.txt' is used, ensure it exists in the directory where you run the script.
  - The 'FAL_KEY' environment variable must be set with your FAL AI API key.
  - Images are saved to the directory specified by 'FAL_PATH' or './images' by default.
        `);
  });

program.parse(process.argv);

const options = program.opts();

DEBUG = options.debug || false;
local_output_override = options.out || false;

const getFalPath = () => {
  let falPath = process.env.FAL_PATH || path.resolve(process.cwd(), "images");
  falPath = local_output_override
    ? path.resolve(process.cwd(), "images")
    : falPath;
  return falPath;
};

const getFileNameFromUrl = (url) => {
  const parsedUrl = new URL(url);
  const fileName = parsedUrl.pathname.split("/").pop();
  return fileName;
};

const getPromptFromFile = async (filePath, index = null) => {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const lines = data.split("\n").filter(Boolean);
    const randomIndex = Math.floor(Math.random() * lines.length);
    const selectedIndex = index !== null ? parseInt(index) - 1 : randomIndex;
    const selectedLine = lines[selectedIndex];
    return selectedLine.trim();
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
};

const getAllPrompts = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const lines = data
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
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

const run = async (prompt, modelEndpoint, format, loraObjects, seed, scale) => {
  let count = 0;

  let result;
  const input = {
    prompt,
    image_size: format,
    num_inference_steps: 30,
    guidance_scale: 3.4,
    num_images: 1,
    safety_tolerance: "6",
    enable_safety_checker: false,
  };
  if (loraObjects && loraObjects.length > 0) {
    input.loras = loraObjects.map((loraObj) => ({
      path: loraObj.url,
      scale: scale || loraObj.scale,
    }));
    const loraKeywords = loraObjects
      .map((loraObj) => loraObj.keyword)
      .filter(Boolean)
      .join(". ");
    if (loraKeywords) {
      input.prompt = loraKeywords + ". " + input.prompt;
    }
  }
  if (seed) {
    input.seed = seed;
  }
  try {
    result = await fal.subscribe(modelEndpoint, {
      input,
      logs: false,
      options: {},
      onQueueUpdate: (update) => {
        if (update.status === "IN_QUEUE") {
          process.stdout.write(
            `\r${update.status}: position ${update.queue_position}.`
          );
        } else if (update.status === "IN_PROGRESS") {
          process.stdout.write(
            `\r${update.status}: ${count++} sec.           `
          );
        } else if (update.status === "COMPLETED") {
          process.stdout.write(
            "\rDONE ✔                                    \n"
          );
        }
      },
    });
    if (DEBUG) console.log(result);
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

const main = async () => {
  const userPrompt = options.prompt;
  const modelKey = options.model;
  const formatKey = options.format;
  const loraKeys = options.lora || [];
  const allPrompts = options.allPrompts || false;
  const seed = options.seed || null;
  const index = options.index || null;
  const scale = options.scale || null;

  // Get the model endpoint from the dictionary
  const pictureFormat = image_size[formatKey] || "square_hd";

  const loraObjects = loraKeys.map((key) => loraNames[key]).filter(Boolean);
  const modelEndpoint =
    modelEndpoints[modelKey] ||
    (loraObjects.length > 0 ? "fal-ai/flux-lora" : "fal-ai/flux-pro/new");

  if (allPrompts) {
    // Handle the --all-prompts option
    const promptsFilePath = path.resolve(process.cwd(), "prompts.txt");
    getAllPrompts(promptsFilePath)
      .then(async (prompts) => {
        for (const [idx, promptText] of prompts.entries()) {
          console.log(
            `Generating image for prompt ${idx + 1}: "${promptText}"`
          );
          await run(
            promptText,
            modelEndpoint,
            pictureFormat,
            loraObjects,
            seed,
            scale
          );
        }
      })
      .catch((error) => {
        console.error("Failed to read prompts:", error);
      });
  } else {
    const promptPromise = userPrompt
      ? Promise.resolve(userPrompt)
      : getPromptFromFile(path.resolve(process.cwd(), "prompts.txt"), index);

    promptPromise
      .then((promptText) => {
        console.log(`Generating image for prompt: "${promptText}"`);
        run(promptText, modelEndpoint, pictureFormat, loraObjects, seed, scale);
      })
      .catch((error) => {
        console.error("Failed to get prompt:", error);
      });
  }
};

main();
