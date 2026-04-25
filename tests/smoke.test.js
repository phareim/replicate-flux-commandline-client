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
    assert.equal(typeof metadata.seed, "number", "Expected auto-generated seed in sidecar");
    assert(metadata.seed >= 0, "Expected non-negative seed");
  } finally {
    removeDir(outputDir);
  }
});

test("venice records user-supplied seed in sidecar", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "venice-seed-"));
  try {
    runCli(
      ["venice/index.js", "--prompt", "smoke test", "--seed", "12345"],
      {
        VENICE_API_TOKEN: "test-token",
        VENICE_SMOKE_TEST: "1",
        VENICE_PATH: outputDir,
        NODE_ENV: "test"
      }
    );

    const files = fs.readdirSync(outputDir);
    const sidecar = files.find((file) => file.endsWith(".json"));
    assert(sidecar, "Expected venice metadata sidecar");
    const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, sidecar), "utf8"));
    assert.equal(metadata.seed, 12345, "Expected user-supplied seed preserved");
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
    assert.equal(typeof metadata.seed, "number", "Expected auto-generated seed in sidecar");
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
    assert.equal(typeof metadata.seed, "number", "Expected auto-generated seed in sidecar");
  } finally {
    removeDir(outputDir);
  }
});

test("venice --keywords expands prompt via text model and records inputs in sidecar", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "venice-keywords-"));
  try {
    runCli(
      ["venice/index.js", "--keywords", "neon, cat, alley", "--keyword-rating", "PG13"],
      {
        VENICE_API_TOKEN: "test-token",
        VENICE_SMOKE_TEST: "1",
        VENICE_PATH: outputDir,
        NODE_ENV: "test",
      }
    );

    const files = fs.readdirSync(outputDir);
    const sidecar = files.find((f) => f.endsWith(".json"));
    assert(sidecar, "Expected venice sidecar");
    const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, sidecar), "utf8"));
    assert.equal(metadata.keywords, "neon, cat, alley");
    assert.equal(metadata.keyword_rating, "PG13");
    assert.equal(metadata.keyword_model, "venice-uncensored");
    assert.match(metadata.prompt, /\[mock PG13\] cinematic image inspired by: neon, cat, alley/);
  } finally {
    removeDir(outputDir);
  }
});

test("wave-replay reconstructs venice command from sidecar", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wave-replay-venice-"));
  try {
    const sidecar = path.join(tmpDir, "venice_1.json");
    fs.writeFileSync(sidecar, JSON.stringify({
      source: "venice",
      kind: "image",
      model: "venice-sd35",
      model_key: "venice-sd35",
      prompt: 'a cat with "fancy" hat',
      width: 1024,
      height: 1024,
      cfg_scale: 2,
      seed: 12345,
      style_preset: "Anime",
      output_format: "png",
      hide_watermark: true,
    }));

    const result = runCli(["tools/replay.js", sidecar]);
    const out = result.stdout.trim();
    assert.match(out, /^venice /);
    assert.match(out, /--model venice-sd35/);
    assert.match(out, /--prompt 'a cat with "fancy" hat'/);
    assert.match(out, /--seed 12345/);
    assert.match(out, /--lora Anime/);
    assert.match(out, /--hide-watermark$/);
  } finally {
    removeDir(tmpDir);
  }
});

test("wave-replay finds sidecar when given media file path", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wave-replay-media-"));
  try {
    const sidecarPath = path.join(tmpDir, "wavespeed_1.json");
    const mediaPath = path.join(tmpDir, "wavespeed_1.png");
    fs.writeFileSync(sidecarPath, JSON.stringify({
      source: "wavespeed",
      kind: "image",
      model: "bytedance/seedream-v4-5",
      model_key: "seedream",
      prompt: "Optimized: a cat",
      original_prompt: "a cat",
      size: "1024*1024",
      seed: 7,
      input_images: ["https://ex.com/a.jpg", "https://ex.com/b.jpg"],
    }));
    fs.writeFileSync(mediaPath, "fake png");

    const result = runCli(["tools/replay.js", mediaPath]);
    const out = result.stdout.trim();
    assert.match(out, /^wavespeed /);
    // Replays the post-optimization prompt, not the original — optimizer is non-deterministic.
    assert.match(out, /--prompt 'Optimized: a cat'/);
    assert.doesNotMatch(out, /--optimize\b/);
    assert.match(out, /--format '1024\*1024'/);
    assert.match(out, /--images https:\/\/ex\.com\/a\.jpg https:\/\/ex\.com\/b\.jpg/);
  } finally {
    removeDir(tmpDir);
  }
});

test("wave-replay --exec re-runs venice from a sidecar", () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "wave-replay-exec-fixture-"));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "wave-replay-exec-out-"));
  try {
    const sidecar = path.join(fixtureDir, "venice_seed.json");
    fs.writeFileSync(sidecar, JSON.stringify({
      source: "venice",
      kind: "image",
      model: "venice-sd35",
      model_key: "venice-sd35",
      prompt: "replay smoke",
      seed: 4242,
    }));

    runCli(
      ["tools/replay.js", sidecar, "--exec"],
      {
        VENICE_API_TOKEN: "test-token",
        VENICE_SMOKE_TEST: "1",
        VENICE_PATH: outputDir,
        NODE_ENV: "test",
      }
    );

    const files = fs.readdirSync(outputDir);
    const newSidecar = files.find((f) => f.endsWith(".json"));
    assert(newSidecar, "Expected re-run to produce a fresh sidecar");
    const replayed = JSON.parse(fs.readFileSync(path.join(outputDir, newSidecar), "utf8"));
    assert.equal(replayed.prompt, "replay smoke");
    assert.equal(replayed.seed, 4242, "Expected seed from original sidecar to be honored on replay");
  } finally {
    removeDir(fixtureDir);
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
