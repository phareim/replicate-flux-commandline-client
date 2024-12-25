import { Command } from "commander";
import { 
  modelEndpoints, 
  getModelEndpoint 
} from "./models.js";
import { 
  DEFAULT_MODEL, 
  DEFAULT_WIDTH, 
  DEFAULT_HEIGHT, 
  DEFAULT_STEPS, 
  DEFAULT_CFG_SCALE, 
  stylePresets,
  image_size 
} from "./config.js";

export function setupCLI() {
  const program = new Command();

  program
    .version("1.0.0")
    .description(
      "This script generates images using the Venice AI image generation API."
    )
    .option(
      "--prompt <text>",
      "Specify the text prompt for image generation."
    )
    .option(
      "--negative-prompt <text>", 
      "Specify a negative prompt to guide what not to generate."
    )
    .option(
      "--model <modelKey>", 
      "Choose the AI model to use.", 
      DEFAULT_MODEL
    )
    .option(
      "--format <formatKey>", 
      "Specify image size/format."
    )
    .option(
      "--width <number>", 
      "Image width", 
      parseFloat,
      DEFAULT_WIDTH
    )
    .option(
      "--height <number>", 
      "Image height", 
      parseFloat,
      DEFAULT_HEIGHT
    )
    .option(
      "--steps <number>", 
      "Number of inference steps", 
      parseFloat,
      DEFAULT_STEPS
    )
    .option(
      "--cfg-scale <number>", 
      "Classifier-free guidance scale", 
      parseFloat,
      DEFAULT_CFG_SCALE
    )
    .option(
      "--seed <number>", 
      "Random seed for reproducibility",
      parseFloat
    )
    .option(
      "--style-preset <preset>", 
      "Choose a style preset for image generation"
    )
    .option(
      "--hide-watermark", 
      "Hide watermark in generated image"
    )
    .option(
      "--return-binary", 
      "Return image as binary data"
    )
    .option(
      "--debug", 
      "Enable debug mode to display additional logs"
    )
    .helpOption("-h, --help", "Display this help message.")
    .on("--help", () => {
      // Generate the list of available models
      const availableModels = Object.keys(modelEndpoints)
        .map((key) => `  - ${key.padEnd(20)}: ${modelEndpoints[key]}`)
        .join("\n");

      // Generate the list of available formats
      const availableFormats = Object.keys(image_size)
        .map((key) => `  - ${key.padEnd(10)}: ${image_size[key].width}x${image_size[key].height}`)
        .join("\n");

      // Generate the list of style presets
      const availableStylePresets = stylePresets.join(", ");

      console.log(`
Available Models:
${availableModels}

Available Formats:
${availableFormats}

Available Style Presets:
${availableStylePresets}

Examples:
  venice --prompt "A futuristic cityscape at dusk" --model stable-diffusion-xl-v1-0
  venice --prompt "A serene landscape" --format wide --style-preset photographic
  venice --prompt "A cyberpunk scene" --steps 50 --cfg-scale 9 --seed 42

Notes:
  - The 'VENICE_API_TOKEN' environment variable must be set with your Venice AI API key.
  - Images are saved to the './images/venice' directory by default.
        `);

      // Exit the process after displaying help
      process.exit(0);
    });

  program.parse(process.argv);

  return program.opts();
} 