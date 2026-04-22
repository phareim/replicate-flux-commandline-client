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
    assert(files.some((file) => file.startsWith("venice_") && file.endsWith(".png")), "Expected venice output file");
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
    assert(files.some((file) => file.endsWith(".png")), "Expected wavespeed output file");
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
