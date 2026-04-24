#!/usr/bin/env node

import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

import { setupVideoCLI, resolveVideoModel } from "./video-cli.js";
import { saveMetadata } from "./utils.js";

const VENICE_API_BASE = "https://api.venice.ai/api/v1";
const SMOKE_MODE = process.env.VENICE_SMOKE_TEST === "1";

let DEBUG = false;
let localOutputOverride = false;

const getVideoPath = () => {
  const defaultPath = path.resolve(process.cwd(), "videos/venice/");
  const envPath = process.env.VENICE_VIDEO_PATH
    ? path.resolve(process.env.VENICE_VIDEO_PATH)
    : defaultPath;
  return localOutputOverride ? defaultPath : envPath;
};

const saveVideo = async (buffer, fileName) => {
  const outDir = getVideoPath();
  const filePath = path.join(outDir, fileName);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(filePath, buffer);
  console.log(`Video saved: ${filePath}`);
  return filePath;
};

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
    return (await fs.readFile(filePath, "utf8")).trim();
  } catch {
    return null;
  }
};

const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${process.env.VENICE_API_TOKEN}`,
  ...extra,
});

const queueJob = async (body) => {
  if (SMOKE_MODE) return { queue_id: "smoke-queue-id", model: body.model };

  const res = await fetch(`${VENICE_API_BASE}/video/queue`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Queue failed (${res.status}): ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Queue returned non-JSON: ${text}`);
  }
};

const retrieveJob = async (model, queueId) => {
  if (SMOKE_MODE) {
    return { done: true, buffer: Buffer.from("mock venice video mp4") };
  }

  const res = await fetch(`${VENICE_API_BASE}/video/retrieve`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ model, queue_id: queueId }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Retrieve failed (${res.status}): ${errText}`);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.startsWith("video/")) {
    const buffer = Buffer.from(await res.arrayBuffer());
    return { done: true, buffer };
  }

  const payload = await res.json();
  if (DEBUG) console.log("Retrieve status:", JSON.stringify(payload));
  return { done: false, status: payload };
};

const pollUntilReady = async (model, queueId, { interval = 5000, maxAttempts = 360 } = {}) => {
  const start = Date.now();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await retrieveJob(model, queueId);
    if (result.done) return result.buffer;

    const elapsed = Math.round((Date.now() - start) / 1000);
    const avg = result.status?.average_execution_time;
    const etaSuffix = avg ? ` (est. ${Math.round(avg / 1000)}s)` : "";
    process.stdout.write(`\r🎬 Generating... ${elapsed}s${etaSuffix}          `);

    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Polling timeout: video generation took too long");
};

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

const buildQueueBody = (options, modelEntry) => {
  const body = {
    model: modelEntry.id,
    prompt: options.prompt,
    duration: options.duration,
    resolution: options.resolution,
    seed: options.seed,
  };

  if (modelEntry.type === "text-to-video" && options.aspectRatio) {
    body.aspect_ratio = options.aspectRatio;
  }
  if (options.negativePrompt) body.negative_prompt = options.negativePrompt;
  if (options.imageUrl) body.image_url = options.imageUrl;
  if (options.referenceImages?.length) body.reference_image_urls = options.referenceImages;
  if (options.videoUrl) body.video_url = options.videoUrl;
  if (options.audioUrl) body.audio_url = options.audioUrl;

  return body;
};

const run = async (options) => {
  if (!process.env.VENICE_API_TOKEN && !SMOKE_MODE) {
    console.error("Error: VENICE_API_TOKEN environment variable is not set.");
    process.exit(1);
  }

  if (!options.prompt) {
    const promptFilePath = options.file || "./prompt.txt";
    const fromFile = await readPromptFromFile(promptFilePath);
    if (fromFile) {
      options.prompt = fromFile;
      console.log(`Using prompt from ${promptFilePath}.`);
    } else {
      console.error("Error: No prompt provided. Use --prompt, --file, or create ./prompt.txt.");
      process.exit(1);
    }
  }

  const modelEntry = resolveVideoModel(options.model);
  if (!modelEntry) {
    console.error(`Error: Unknown video model '${options.model}'. Try --help for aliases.`);
    process.exit(1);
  }

  if (modelEntry.type === "image-to-video" && !options.imageUrl && !options.referenceImages?.length) {
    console.error(`Error: ${modelEntry.name} requires --image-url or --reference-images.`);
    process.exit(1);
  }
  if (modelEntry.type === "video" && !options.videoUrl) {
    console.error(`Error: ${modelEntry.name} requires --video-url.`);
    process.exit(1);
  }

  const seedProvidedByUser = options.seed !== undefined;
  if (!seedProvidedByUser) options.seed = randomSeed();

  const body = buildQueueBody(options, modelEntry);
  if (DEBUG) console.log("Queue body:", JSON.stringify(body, null, 2));

  console.log("__Generating video" + "_".repeat(60 - 18));
  console.log(`Model: ${modelEntry.name} [${modelEntry.id}]`);
  console.log(`Duration: ${options.duration} | Resolution: ${options.resolution}`);
  if (modelEntry.type === "text-to-video") console.log(`Aspect: ${options.aspectRatio}`);
  console.log(`Seed: ${options.seed}${seedProvidedByUser ? "" : " (auto)"}`);
  console.log("‾".repeat(60) + "\n");

  let queued;
  try {
    queued = await queueJob(body);
  } catch (err) {
    console.error(err.message);
    return;
  }
  const queueId = queued.queue_id;
  if (DEBUG) console.log(`Queued. queue_id=${queueId}`);

  let buffer;
  try {
    buffer = await pollUntilReady(modelEntry.id, queueId);
  } catch (err) {
    process.stdout.write("\r");
    console.error(err.message);
    return;
  }

  process.stdout.write("\r✨ Generation complete!                                    \n");

  const fileName = `venice_${queueId}.mp4`;
  const savedPath = await saveVideo(buffer, fileName);

  if (options.metadata !== false && savedPath) {
    await saveMetadata(savedPath, {
      source: "venice-video",
      kind: "video",
      generated_at: new Date().toISOString(),
      cli_version: "1.0.0",
      model: modelEntry.id,
      model_key: options.model,
      model_type: modelEntry.type,
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      duration: options.duration,
      resolution: options.resolution,
      aspect_ratio: modelEntry.type === "text-to-video" ? options.aspectRatio : undefined,
      seed: options.seed,
      image_url: options.imageUrl,
      reference_image_urls: options.referenceImages,
      video_url: options.videoUrl,
      audio_url: options.audioUrl,
      queue_id: queueId,
    });
  }

  if (options.aiwdm && !SMOKE_MODE && savedPath) {
    const extraTags = options.aiwdmTags
      ? options.aiwdmTags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const tags = ["venice-video", ...extraTags];
    await uploadToAiwdm(savedPath, {
      prompt: options.prompt,
      rating: options.aiwdmRating,
      tags,
    });
  }

  console.log("\n__ Generation Summary " + "_".repeat(38));
  console.log(`Model: ${modelEntry.name}`);
  console.log(`Queue ID: ${queueId}`);
  console.log(`Duration: ${options.duration}`);
  console.log(`Resolution: ${options.resolution}`);
  console.log(`Seed: ${options.seed}${seedProvidedByUser ? "" : " (auto)"}`);
  console.log("‾".repeat(60) + "\n");
};

const main = async () => {
  const options = setupVideoCLI();
  DEBUG = options.debug || false;
  localOutputOverride = options.out || false;
  await run(options);
};

main();
