import { Command } from "commander";
import { modelEndpoints, loraNames } from "./models.js";
import { image_size, DEFAULT_MODEL } from "./config.js";

export function setupCLI() {
  const program = new Command();

  program
    .version("1.0.0")
    .description(
      "This script generates images using the FAL AI serverless client. You can provide custom prompts, select models, and adjust settings to customize the image generation process."
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
    .option("--raw", "Generate less processed, more natural-looking images.")
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
      "--random-lora",
      "Randomly select a LoRA to apply."
    )
    .option(
      "--seed <number>",
      "Set a seed for randomization to reproduce results."
    )
    .option("--scale <number>", "Set the scale for guidance.")
    .option("--strength <number>", "Set the strength for image-to-image models (0.01-1.0).")
    .option("--num-images <number>", "Number of images to generate (1-4, default: 1)", "1")
    .option(
      "--out",
      "Save images to the current directory instead of the default."
    )
    .option("--debug", "Enable debug mode to display additional logs.")
    .option("--all-prompts", 'Generate image using the content of "prompt.txt".')
    .option(
      "--image-url <imageUrl>",
      "URL or local file path of the input image for image-to-video models"
    )
    .option("--duration <duration>", "The duration of the video (5 or 10 seconds)", "5")
    .option("--list-models", "List all available models")
    .option("--category <category>", "Filter models by category (use with --list-models)")
    .option("--search <term>", "Search models by keyword")
    .option("--model-info <modelKey>", "Show detailed information about a specific model")
    .option("--list-categories", "List all available model categories")
    .helpOption("-h, --help", "Display this help message.")
    .on("--help", () => {
      // Generate the list of available LoRAs
      const availableLoras = Object.keys(loraNames)
        .map((key) => key)
        .join(", ");

      const availableFormats = Object.keys(image_size).join(", ");

      console.log(`
Default Model:
  ${DEFAULT_MODEL} (${modelEndpoints[DEFAULT_MODEL]})
  A creative AI model that works well with LoRAs for stylized image generation.

Discovering Models:
  Due to the large number of available models, use these commands to explore:

  --list-models               List all available models
  --search <term>             Search models by keyword (e.g., "video", "flux", "anime")
  --category <category>       Filter models by category (e.g., "text-to-image", "image-to-video")
  --list-categories           Show all available categories
  --model-info <modelKey>     Get detailed info about a specific model

  Popular model shortcuts: pro, ultra, dev, krea, krea-i2i, kontext, image_to_video

Available LoRAs:
${availableLoras}

Available Formats:
${availableFormats}

Examples:
  # Basic usage (uses default model: ${DEFAULT_MODEL})
  falflux --prompt "A futuristic cityscape at dusk"

  # With LoRAs (enhances the default model)
  falflux --lora disney --prompt "An enchanted forest"
  falflux --lora disney,lucid --prompt "A magical landscape"
  falflux --lora cinematic --prompt "A dramatic sunset over mountains" --format wide
  falflux --random-lora --prompt "Surprise me with a random style"

  # Using different models
  falflux --model pro --prompt "Photorealistic portrait"
  falflux --model krea-i2i --image-url "./input.jpg" --prompt "Transform into watercolor style"

  # Video generation
  falflux --model image_to_video --image-url "./photo.jpg" --prompt "Camera slowly pans right"

  # Discover models
  falflux --search "anime"
  falflux --category "image-to-video"
  falflux --model-info pro

Notes:
  - Ensure that 'prompt.txt' exists in the directory where you run the script.
  - The 'FAL_KEY' environment variable must be set with your FAL AI API key.
  - Images are saved to the directory specified by 'FAL_PATH' or './images' by default.
        `);

      // Exit the process after displaying help
      process.exit(0);
    });

  program.parse(process.argv);

  return program.opts();
}