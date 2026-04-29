#!/usr/bin/env node

import { promises as fs } from "fs";
import { existsSync } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { Command } from "commander";

import { saveMetadata } from "./utils.js";

const VENICE_API_BASE = "https://api.venice.ai/api/v1";
const MODEL_ID = "wan-2.6-flash-image-to-video";
const MODEL_NAME = "Wan 2.6 Flash";
const DEFAULT_PROMPT = "animate";
const SMOKE_MODE = process.env.VENICE_SMOKE_TEST === "1";

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const isHttpUrl = (s) => /^https?:\/\//i.test(s);

const resolveImageInput = async (input) => {
  if (!input) throw new Error("An image path or URL is required.");
  if (isHttpUrl(input)) return input;

  const abs = path.resolve(process.cwd(), input);
  let buf;
  try {
    buf = await fs.readFile(abs);
  } catch (err) {
    throw new Error(`Could not read image at ${abs}: ${err.message}`);
  }
  const ext = path.extname(abs).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw new Error(`Unsupported image extension: ${ext || "(none)"} — use png, jpg, jpeg, webp, or gif.`);
  }
  return `data:${mime};base64,${buf.toString("base64")}`;
};

const getVideoPath = (localOverride) => {
  const defaultPath = path.resolve(process.cwd(), "videos/venice/");
  const envPath = process.env.VENICE_VIDEO_PATH
    ? path.resolve(process.env.VENICE_VIDEO_PATH)
    : defaultPath;
  return localOverride ? defaultPath : envPath;
};

const saveVideo = async (buffer, fileName, localOverride) => {
  const outDir = getVideoPath(localOverride);
  const filePath = path.join(outDir, fileName);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(filePath, buffer);
  console.log(`Video saved: ${filePath}`);
  return filePath;
};

const resolveAiwdmDir = () => {
  const candidates = [
    process.env.AIWDM_CLI_DIR,
    path.join(os.homedir(), "github/petter/aiwdm/cli"),
    path.join(os.homedir(), "github/aiwdm/cli"),
    "/home/petter/github/aiwdm/cli",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
};

const uploadToAiwdm = async (filePath, { prompt, rating, tags, metadata }) => {
  const args = ["upload", filePath];
  if (rating) args.push("--rating", rating);
  if (tags && tags.length) args.push("--tags", tags.join(","));
  if (prompt) args.push("--prompt", prompt);

  let metadataDir;
  if (metadata) {
    metadataDir = await fs.mkdtemp(path.join(os.tmpdir(), "wave-meta-"));
    const metadataPath = path.join(metadataDir, "metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    args.push("--metadata-file", metadataPath);
  }

  try {
    await new Promise((resolve) => {
      const cwd = resolveAiwdmDir();
      const proc = spawn("aiwdm", args, { stdio: "inherit", ...(cwd ? { cwd } : {}) });
      proc.on("error", (err) => {
        console.error(`aiwdm upload failed: ${err.message}`);
        resolve();
      });
      proc.on("close", (code) => {
        if (code !== 0) console.error(`aiwdm exited with code ${code}`);
        resolve();
      });
    });
  } finally {
    if (metadataDir) {
      try { await fs.rm(metadataDir, { recursive: true, force: true }); } catch {}
    }
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
  if (!res.ok) throw new Error(`Queue failed (${res.status}): ${text}`);
  try { return JSON.parse(text); }
  catch { throw new Error(`Queue returned non-JSON: ${text}`); }
};

const retrieveJob = async (model, queueId, debug) => {
  if (SMOKE_MODE) return { done: true, buffer: Buffer.from("mock venice video mp4") };

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
    return { done: true, buffer: Buffer.from(await res.arrayBuffer()) };
  }
  const payload = await res.json();
  if (debug) console.log("Retrieve status:", JSON.stringify(payload));
  return { done: false, status: payload };
};

const pollUntilReady = async (queueId, debug, { interval = 5000, maxAttempts = 360 } = {}) => {
  const start = Date.now();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await retrieveJob(MODEL_ID, queueId, debug);
    if (result.done) return result.buffer;
    const elapsed = Math.round((Date.now() - start) / 1000);
    const avg = result.status?.average_execution_time;
    const etaSuffix = avg ? ` (est. ${Math.round(avg / 1000)}s)` : "";
    process.stdout.write(`\r🎬 Generating... ${elapsed}s${etaSuffix}          `);
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Polling timeout: video generation took too long");
};

const slugifyModelTag = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const program = new Command();
program
  .name("wan2.6-flash")
  .description("Image-to-video via Venice's Wan 2.6 Flash model.")
  .argument("<image>", "Path to a local image OR an https URL")
  .option("--prompt <text>", `Text prompt (defaults to "${DEFAULT_PROMPT}")`)
  .option("--duration <duration>", "Clip length: 5s, 10s, 15s.", "5s")
  .option("--resolution <res>", "Output resolution: 720p or 1080p.", "720p")
  .option("--negative-prompt <text>", "Negative prompt.")
  .option("--audio-url <url>", "Audio input URL (model supports audio input).")
  .option("--out", "Save video to ./videos/venice/ instead of $VENICE_VIDEO_PATH.")
  .option("--local", "Skip uploading to the aiwdm media library; only save locally.")
  .option("--aiwdm-rating <rating>", "Rating for aiwdm upload (G, PG, PG13, R).", "R")
  .option("--aiwdm-tags <tags>", "Extra comma-separated tags (source tag `venice-video` is always added).")
  .option("--no-metadata", "Skip recording generation metadata.")
  .option("--debug", "Verbose logging.")
  .helpOption("-h, --help", "Display this help message.")
  .parse(process.argv);

const opts = program.opts();
const [imageArg] = program.args;

const run = async () => {
  if (!process.env.VENICE_API_TOKEN && !SMOKE_MODE) {
    console.error("Error: VENICE_API_TOKEN environment variable is not set.");
    process.exit(1);
  }

  let imageUrl;
  try {
    imageUrl = await resolveImageInput(imageArg);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const prompt = (opts.prompt && opts.prompt.trim()) || DEFAULT_PROMPT;
  const promptIsDefault = prompt === DEFAULT_PROMPT && !opts.prompt;

  const body = {
    model: MODEL_ID,
    prompt,
    duration: opts.duration,
    resolution: opts.resolution,
    image_url: imageUrl,
  };
  if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt;
  if (opts.audioUrl) body.audio_url = opts.audioUrl;

  if (opts.debug) {
    const debugBody = { ...body, image_url: isHttpUrl(imageUrl) ? imageUrl : `${imageUrl.slice(0, 60)}…(truncated)` };
    console.log("Queue body:", JSON.stringify(debugBody, null, 2));
  }

  console.log("__Generating video__");
  console.log(`Model: ${MODEL_NAME} [${MODEL_ID}]`);
  console.log(`Image: ${isHttpUrl(imageArg) ? imageArg : path.resolve(imageArg)}`);
  console.log(`Prompt: ${prompt}${promptIsDefault ? " (default)" : ""}`);
  console.log(`Duration: ${opts.duration} | Resolution: ${opts.resolution}`);
  console.log("‾‾\n");

  let queued;
  try {
    queued = await queueJob(body);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const queueId = queued.queue_id;
  if (opts.debug) console.log(`Queued. queue_id=${queueId}`);

  let buffer;
  try {
    buffer = await pollUntilReady(queueId, opts.debug);
  } catch (err) {
    process.stdout.write("\r");
    console.error(err.message);
    process.exit(1);
  }
  process.stdout.write("\r✨ Generation complete!                                    \n");

  const fileName = `venice_${queueId}.mp4`;
  const savedPath = await saveVideo(buffer, fileName, opts.out);

  const metadataBlob = opts.metadata !== false && savedPath ? {
    source: "venice-video",
    kind: "video",
    generated_at: new Date().toISOString(),
    cli_version: "1.0.0",
    model: MODEL_ID,
    model_key: "wan-2.6-flash",
    model_type: "image-to-video",
    prompt,
    negative_prompt: opts.negativePrompt,
    duration: opts.duration,
    resolution: opts.resolution,
    image_source: isHttpUrl(imageArg) ? imageArg : path.resolve(imageArg),
    audio_url: opts.audioUrl,
    queue_id: queueId,
  } : null;

  const willUpload = !opts.local && !SMOKE_MODE && savedPath;
  if (metadataBlob && !willUpload) {
    await saveMetadata(savedPath, metadataBlob);
  }

  if (willUpload) {
    const extraTags = opts.aiwdmTags
      ? opts.aiwdmTags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const modelTag = slugifyModelTag(MODEL_ID);
    const tags = [...new Set(["venice-video", modelTag, ...extraTags].filter(Boolean))];
    await uploadToAiwdm(savedPath, {
      prompt,
      rating: opts.aiwdmRating,
      tags,
      metadata: metadataBlob,
    });
  }

  console.log("\n__ Generation Summary __");
  console.log(`Model: ${MODEL_NAME}`);
  console.log(`Queue ID: ${queueId}`);
  console.log(`Duration: ${opts.duration}`);
  console.log(`Resolution: ${opts.resolution}`);
  console.log("‾‾\n");
};

run();
