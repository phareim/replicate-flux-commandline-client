import { Command } from "commander";

export const videoModels = {
  "wan-2.7-t2v": { id: "wan-2-7-text-to-video", name: "Wan 2.7 (text-to-video)", type: "text-to-video" },
  "wan-t2v":     { id: "wan-2-7-text-to-video", name: "Wan 2.7 (text-to-video)", type: "text-to-video" },
  "wan-2.7":     { id: "wan-2-7-text-to-video", name: "Wan 2.7 (text-to-video)", type: "text-to-video" },
  "wan":         { id: "wan-2-7-text-to-video", name: "Wan 2.7 (text-to-video)", type: "text-to-video" },
  "wan-2.7-i2v": { id: "wan-2-7-image-to-video", name: "Wan 2.7 (image-to-video)", type: "image-to-video" },
  "wan-i2v":     { id: "wan-2-7-image-to-video", name: "Wan 2.7 (image-to-video)", type: "image-to-video" },
  "wan-2.7-r2v": { id: "wan-2-7-reference-to-video", name: "Wan 2.7 Reference", type: "image-to-video" },
  "wan-r2v":     { id: "wan-2-7-reference-to-video", name: "Wan 2.7 Reference", type: "image-to-video" },
  "wan-2.7-v2v": { id: "wan-2-7-video-to-video", name: "Wan 2.7 Edit", type: "video" },
  "wan-v2v":     { id: "wan-2-7-video-to-video", name: "Wan 2.7 Edit", type: "video" },
  "wan-edit":    { id: "wan-2-7-video-to-video", name: "Wan 2.7 Edit", type: "video" },
};

export const DEFAULT_VIDEO_MODEL = "wan-2.7-t2v";

export function resolveVideoModel(key) {
  if (videoModels[key]) return videoModels[key];
  // allow passing the raw Venice model id too
  const match = Object.values(videoModels).find((m) => m.id === key);
  if (match) return match;
  return null;
}

export function setupVideoCLI() {
  const program = new Command();

  program
    .version("1.0.0")
    .description("Generate videos via the Venice.ai /video/queue API.")
    .option("--prompt <text>", "Text prompt for video generation.")
    .option("--file <path>", "Read prompt from a file (default: ./prompt.txt)")
    .option("--model <modelKey>", "Video model alias or Venice model id.", DEFAULT_VIDEO_MODEL)
    .option("--duration <duration>", 'Clip length (e.g. "5s", "10s", "15s").', "5s")
    .option("--resolution <res>", "Output resolution (720p or 1080p).", "720p")
    .option("--aspect-ratio <ratio>", "Aspect ratio (16:9, 9:16, 1:1).", "16:9")
    .option("--negative-prompt <text>", "Negative prompt.")
    .option("--seed <number>", "Random seed.", parseInt)
    .option("--image-url <url>", "Input image URL (for image-to-video).")
    .option("--reference-images <urls...>", "Reference image URLs (for reference-to-video).")
    .option("--video-url <url>", "Input video URL (for video-to-video).")
    .option("--audio-url <url>", "Input audio URL (for models that accept audio input).")
    .option("--out", "Save video to ./videos/venice/ instead of $VENICE_VIDEO_PATH.")
    .option("--aiwdm", "Upload the saved video to the aiwdm media library via the local `aiwdm` CLI.")
    .option("--aiwdm-rating <rating>", "Rating passed to aiwdm upload (G, PG, PG13, R).", "R")
    .option("--aiwdm-tags <tags>", "Extra comma-separated tags (source tag `venice-video` is always added).")
    .option("--no-metadata", "Skip writing the JSON metadata sidecar next to the saved video.")
    .option("--debug", "Verbose logging.")
    .helpOption("-h, --help", "Display this help message.")
    .on("--help", () => {
      const rows = Object.entries(videoModels)
        .map(([key, m]) => `  - ${key.padEnd(14)}: ${m.name} [${m.id}]`)
        .join("\n");
      console.log(`
Available Video Models:
${rows}

Examples:
  venice-video --prompt "a neon-lit alley at night" --duration 10s --resolution 1080p
  venice-video --model wan-i2v --image-url https://example.com/still.jpg --prompt "camera pushes in"
  venice-video --model wan-r2v --reference-images https://ex.com/a.jpg https://ex.com/b.jpg --prompt "character walks"
  venice-video --model wan-edit --video-url https://example.com/in.mp4 --prompt "make it more cinematic"

Notes:
  - VENICE_API_TOKEN must be set.
  - Videos save to $VENICE_VIDEO_PATH or ./videos/venice/ by default.
  - Use --out to save to ./videos/venice/ in the current directory.
`);
      process.exit(0);
    });

  program.parse(process.argv);
  return program.opts();
}
