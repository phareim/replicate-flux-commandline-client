import { Command } from "commander";
import { modelEndpoints } from "./models.js";
import { image_size, DEFAULT_MODEL } from "./config.js";

export function setupCLI() {
  const program = new Command();

  program
    .version("1.0.0")
    .description(
      "This script generates images using the Wavespeed.ai API. You can provide custom prompts, select models, and adjust settings to customize the image generation process."
    )
    .option(
      "--prompt <text>",
      'Specify the text prompt for image generation. If omitted, the content of "prompt.txt" is used.'
    )
    .option(
      "--file <path>",
      "Read prompt from a specified file (default: ./prompt.txt)"
    )
    .option("--model <modelKey>", "Choose the AI model to use.", DEFAULT_MODEL)
    .option("--format <formatKey>", "Specify image size/format (e.g., '2048*2048', 'square_hd', 'portrait').")
    .option(
      "--seed <number>",
      "Set a seed for randomization to reproduce results."
    )
    .option(
      "--out",
      "Save images to the current directory instead of the default."
    )
    .option("--debug", "Enable debug mode to display additional logs.")
    .option("--all-prompts", 'Generate image using the content of "prompt.txt".')
    .option("--enable-base64", "Enable base64 output instead of URL (API only).")
    .option("--sync", "Enable synchronous mode (wait for result in single response).")
    .option("--count <number>", "Number of times to run the generation (default: 1).", "1")
    .option("--optimize", "Use Wavespeed prompt optimizer to enhance the prompt before generation.")
    .option("--optimize-mode <mode>", "Optimization mode: 'image' or 'video' (default: image).", "image")
    .option("--optimize-style <style>", "Optimization style: default, artistic, photographic, technical, anime, realistic (default: default).", "default")
    .option("--optimize-image <url>", "Reference image URL for optimization context.")
    .helpOption("-h, --help", "Display this help message.")
    .on("--help", () => {
      const availableSizes = Object.keys(image_size).join(", ");

      console.log(`
Default Model:
  ${DEFAULT_MODEL} (${modelEndpoints[DEFAULT_MODEL]})
  Seedream 4.0 by ByteDance - state-of-the-art image generation delivering high-fidelity outputs.

Available Models:
  seedream-v4, seedream, v4

Available Formats:
  ${availableSizes}

Examples:
  # Basic usage
  wavespeed --prompt "A futuristic cityscape at dusk"

  # With custom format/size
  wavespeed --prompt "An enchanted forest" --format square_hd
  wavespeed --prompt "Mountain landscape" --format 1920*1080

  # With seed for reproducibility
  wavespeed --prompt "A magical landscape" --seed 12345

  # Generate multiple images
  wavespeed --prompt "A magical landscape" --count 4

  # Using prompt file
  wavespeed --all-prompts

  # With prompt optimization
  wavespeed --prompt "woman walking" --optimize
  wavespeed --prompt "city scene" --optimize --optimize-mode video
  wavespeed --prompt "portrait shot" --optimize --optimize-style photographic
  wavespeed --prompt "fantasy art" --optimize --optimize-style artistic

Notes:
  - Ensure that 'prompt.txt' exists in the directory where you run the script.
  - The 'WAVESPEED_KEY' environment variable must be set with your Wavespeed API key.
  - Images are saved to the directory specified by 'WAVESPEED_PATH' or './images' by default.
        `);

      // Exit the process after displaying help
      process.exit(0);
    });

  program.parse(process.argv);

  return program.opts();
}
