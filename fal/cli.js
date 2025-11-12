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
      "--seed <number>",
      "Set a seed for randomization to reproduce results."
    )
    .option("--scale <number>", "Set the scale for guidance.")
    .option("--strength <number>", "Set the strength for image-to-image models (0.01-1.0).")
    .option(
      "--out",
      "Save images to the current directory instead of the default."
    )
    // The index option is deprecated but kept for backward compatibility
    .option(
      "-i, --index <index>",
      "(Deprecated) Not used: prompt.txt is treated as a single prompt."
    )
    .option("--debug", "Enable debug mode to display additional logs.")
    .option("--all-prompts", 'Generate image using the content of "prompt.txt".')
    .option(
      "--image-url <imageUrl>",
      "URL or local file path of the input image for image-to-video models"
    )
    .option("--duration <duration>", "The duration of the video (5 or 10 seconds)", "5")
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

      const availableFormats = Object.keys(image_size).join(", ");

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
  node your_script_name.js --model krea-lora --lora cinematic --prompt "A dramatic sunset over mountains"
  node your_script_name.js --model image_to_video --prompt "A stylish woman walks down a Tokyo street" --image-url "https://example.com/image.jpg"
  node your_script_name.js --model hunyuan --prompt "A stylish woman walks down a Tokyo street filled with warm glowing neon and animated city signage"
  node your_script_name.js --model wan-i2v --prompt "A stylish woman walks down a Tokyo street" --image-url "https://fal.media/files/elephant/8kkhB12hEZI2kkbU8pZPA_test.jpeg"
  node your_script_name.js --model image_to_video --prompt "A stylish woman walks down a Tokyo street" --image-url "./local/assets/input.jpg"

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