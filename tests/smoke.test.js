import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const runCli = (args, env = {}) => {
  const result = spawnSync("node", args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env
    },
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(result.status, 0, `CLI exited with ${result.status}\nSTDERR:\n${result.stderr}`);
  return result;
};

const removeDir = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
};

test("venice smoke test saves mocked image output", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "venice-smoke-"));
  try {
    runCli(
      ["venice/index.js", "--prompt", "smoke test"],
      {
        VENICE_API_TOKEN: "test-token",
        VENICE_SMOKE_TEST: "1",
        VENICE_PATH: outputDir,
        NODE_ENV: "test"
      }
    );

    const files = fs.readdirSync(outputDir);
    const imageFile = files.find((file) => file.startsWith("venice_") && file.endsWith(".png"));
    assert(imageFile, "Expected venice output file");

    const sidecar = imageFile.replace(/\.png$/, ".json");
    assert(files.includes(sidecar), "Expected venice metadata sidecar");
    const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, sidecar), "utf8"));
    assert.equal(metadata.source, "venice");
    assert.equal(metadata.kind, "image");
    assert.equal(metadata.prompt, "smoke test");
  } finally {
    removeDir(outputDir);
  }
});

test("venice --no-metadata skips sidecar", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "venice-nometa-"));
  try {
    runCli(
      ["venice/index.js", "--prompt", "smoke test", "--no-metadata"],
      {
        VENICE_API_TOKEN: "test-token",
        VENICE_SMOKE_TEST: "1",
        VENICE_PATH: outputDir,
        NODE_ENV: "test"
      }
    );

    const files = fs.readdirSync(outputDir);
    assert(files.some((file) => file.endsWith(".png")), "Expected venice output file");
    assert(!files.some((file) => file.endsWith(".json")), "Expected no sidecar with --no-metadata");
  } finally {
    removeDir(outputDir);
  }
});

test("wavespeed smoke test saves mocked image output", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "wavespeed-smoke-"));
  try {
    runCli(
      ["wavespeed/index.js", "--prompt", "smoke test"],
      {
        WAVESPEED_KEY: "test-key",
        WAVESPEED_SMOKE_TEST: "1",
        WAVESPEED_PATH: outputDir,
        NODE_ENV: "test"
      }
    );

    const files = fs.readdirSync(outputDir);
    const imageFile = files.find((file) => file.endsWith(".png"));
    assert(imageFile, "Expected wavespeed output file");

    const sidecar = imageFile.replace(/\.png$/, ".json");
    assert(files.includes(sidecar), "Expected wavespeed metadata sidecar");
    const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, sidecar), "utf8"));
    assert.equal(metadata.source, "wavespeed");
    assert.equal(metadata.kind, "image");
    assert.equal(metadata.prompt, "smoke test");
    assert.equal(metadata.output_file, imageFile);
  } finally {
    removeDir(outputDir);
  }
});

test("venice-video smoke test saves mocked mp4 output", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "venice-video-smoke-"));
  try {
    runCli(
      ["venice/video.js", "--prompt", "smoke test"],
      {
        VENICE_API_TOKEN: "test-token",
        VENICE_SMOKE_TEST: "1",
        VENICE_VIDEO_PATH: outputDir,
        NODE_ENV: "test"
      }
    );

    const files = fs.readdirSync(outputDir);
    const videoFile = files.find((file) => file.startsWith("venice_") && file.endsWith(".mp4"));
    assert(videoFile, "Expected venice-video output file");

    const sidecar = videoFile.replace(/\.mp4$/, ".json");
    assert(files.includes(sidecar), "Expected venice-video metadata sidecar");
    const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, sidecar), "utf8"));
    assert.equal(metadata.source, "venice-video");
    assert.equal(metadata.kind, "video");
    assert.equal(metadata.prompt, "smoke test");
    assert(metadata.queue_id, "Expected queue_id in metadata");
  } finally {
    removeDir(outputDir);
  }
});

test("wavespeed smoke test with optimize flag", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "wavespeed-opt-smoke-"));
  try {
    runCli(
      ["wavespeed/index.js", "--prompt", "test", "--optimize"],
      {
        WAVESPEED_KEY: "test-key",
        WAVESPEED_SMOKE_TEST: "1",
        WAVESPEED_PATH: outputDir,
        NODE_ENV: "test"
      }
    );

    const files = fs.readdirSync(outputDir);
    assert(files.some((file) => file.endsWith(".png")), "Expected wavespeed output file with optimization");
  } finally {
    removeDir(outputDir);
  }
});
