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
      "--images <urls...>",
      "Input image URLs for image-to-image models (space-separated, max 10)."
    )
    .option(
      "--negative-prompt <text>",
      "Specify negative prompt to guide what to avoid in generation."
    )
    .option(
      "--seed <number>",
      "Set a seed for randomization to reproduce results."
    )
    .option(
      "--aspect-ratio <ratio>",
      "Aspect ratio for generation (e.g., '1:1', '16:9', '9:16'). Model-specific."
    )
    .option(
      "--resolution <res>",
      "Output resolution: '1k', '2k', or '4k'. Model-specific."
    )
    .option(
      "--output-format <format>",
      "Output format: 'png' or 'jpeg'. Model-specific."
    )
    .option(
      "--out",
      "Save images to the current directory instead of the default."
    )
    .option("--debug", "Enable debug mode to display additional logs.")
    .option("--all-prompts", 'Generate images for all .txt files in the current directory.')
    .option("--enable-base64", "Enable base64 output instead of URL (API only).")
    .option("--sync", "Enable synchronous mode (wait for result in single response).")
    .option("--count <number>", "Number of times to run the generation (default: 1).", "1")
    .option("--optimize", "Use Wavespeed prompt optimizer to enhance the prompt before generation.")
    .option("--optimize-mode <mode>", "Optimization mode: 'image' or 'video' (default: image).", "image")
    .option("--optimize-style <style>", "Optimization style: default, artistic, photographic, technical, realistic, random (default: default).", "default")
    .option("--optimize-image <url>", "Reference image URL for optimization context.")
    .helpOption("-h, --help", "Display this help message.")
    .on("--help", () => {
      const availableSizes = Object.keys(image_size).join(", ");

      console.log(`
Default Model:
  ${DEFAULT_MODEL} (${modelEndpoints[DEFAULT_MODEL]})
  Z-Image-Turbo - 6B parameter model generating photorealistic images in sub-second time.

Available Models:
  flux-2-flex, flux2, flex              FLUX.2 [flex] - Fast, flexible text-to-image with enhanced realism
  z-image-turbo, z-image, turbo         Z-Image-Turbo - 6B parameter model, photorealistic in sub-second time
  seedream-v4.5, seedream, v4.5         Seedream v4.5 - Latest version by ByteDance
  seedream-v4.5-edit, seedream-edit     Seedream v4.5 Edit - Professional image editing with facial preservation
  seedream-v4, v4                       Seedream v4 - High-fidelity image generation
  seedream-v4-edit, v4-edit             Seedream v4 Edit - State-of-the-art image editing (4K)
  seedream-v3.1, v3.1                   Seedream v3.1 - Strong style fidelity and rich detail
  wan-2.5, wan2.5, wan                  WAN 2.5 - Alibaba text-to-image model
  wan-2.5-edit, wan-edit, wan2.5-edit   WAN 2.5 Edit - Alibaba image editing with stylistic upgrades
  nano-banana-pro-edit, nano-edit       Nano Banana Pro Edit - Google Gemini 3.0 image editing (4K)
  banana-edit, gemini-edit              (aliases for nano-banana-pro-edit)
  grok-2-image, grok2, grok             Grok 2 Image - xAI's photorealistic image generation

Available Formats:
  ${availableSizes}

Examples:
  # Basic usage (default model: z-image-turbo)
  wavespeed --prompt "A futuristic cityscape at dusk"

  # Using specific models
  wavespeed --model flux2 --prompt "Photorealistic portrait"
  wavespeed --model turbo --prompt "Quick render of mountain landscape"
  wavespeed --model grok --prompt "Product photography shot"

  # With custom format/size
  wavespeed --prompt "An enchanted forest" --format square_hd
  wavespeed --prompt "Mountain landscape" --format 1920*1080

  # With seed for reproducibility
  wavespeed --prompt "A magical landscape" --seed 12345

  # Generate multiple images
  wavespeed --prompt "A magical landscape" --count 4

  # Process all .txt files in current directory
  wavespeed --all-prompts

  # Process all .txt files with optimization and multiple generations per file
  wavespeed --all-prompts --optimize --optimize-style random --count 2

  # With prompt optimization
  wavespeed --prompt "woman walking" --optimize
  wavespeed --prompt "city scene" --optimize --optimize-mode video
  wavespeed --prompt "portrait shot" --optimize --optimize-style photographic
  wavespeed --prompt "fantasy art" --optimize --optimize-style artistic
  wavespeed --prompt "creative scene" --optimize --optimize-style random --count 4

  # Image-to-image editing (Seedream v4.5 Edit)
  wavespeed --model seedream-edit --images https://example.com/photo.jpg --prompt "Professional headshot"
  wavespeed --model v4.5-edit --images img1.jpg img2.jpg --prompt "Enhance lighting and color"

  # Image-to-image editing (Seedream v4 Edit)
  wavespeed --model v4-edit --images photo.jpg --prompt "Transform into oil painting style"
  wavespeed --model seedream-v4-edit --images img1.jpg img2.jpg --prompt "Cinematic color grading"

  # Image-to-image editing (WAN 2.5 Edit)
  wavespeed --model wan-edit --images photo.jpg --prompt "Professional portrait with soft lighting"
  wavespeed --model wan-2.5-edit --images img1.jpg --prompt "Enhance colors" --negative-prompt "oversaturated, blurry"

  # Image-to-image editing (Nano Banana Pro Edit / Gemini 3.0)
  wavespeed --model nano-edit --images photo.jpg --prompt "Transform into artwork"
  wavespeed --model gemini-edit --images img1.jpg img2.jpg --prompt "Enhance details" --resolution 4k
  wavespeed --model banana-edit --images photo.jpg --prompt "Professional edit" --aspect-ratio 16:9 --output-format jpeg

Notes:
  - When using --prompt, provide the prompt as a command-line argument.
  - Without --prompt, the script reads from 'prompt.txt' in the current directory.
  - With --all-prompts, the script processes all .txt files in the current directory.
  - The 'WAVESPEED_KEY' environment variable must be set with your Wavespeed API key.
  - Images are saved to the directory specified by 'WAVESPEED_PATH' or './images' by default.
        `);

      // Exit the process after displaying help
      process.exit(0);
    });

  program.parse(process.argv);

  return program.opts();
}
