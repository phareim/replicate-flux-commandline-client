# AI Image Generation CLI Tools

A unified command-line interface for AI image generation services: Venice.ai, Fal.ai, Wavespeed.ai, and Replicate.ai. Generate images, videos, and 3D models using state-of-the-art AI models.

## Installation

```bash
npm install -g flux-client
```

## Available Commands

### Venice AI (`venice`)
Generate images using Venice AI's models with extensive customization options.

```bash
# Basic usage
venice --prompt "A futuristic cityscape at dusk"

# Advanced options
venice --prompt "A serene landscape" --format wide --lora photographic
venice --prompt "A cyberpunk scene" --steps 25 --cfg-scale 2 --seed 42
venice --prompt "Portrait" --model qwen-image --variants 4 --output-format png
```

**Options:**
- `--prompt <text>`: Text description of the image to generate
- `--negative-prompt <text>`: Describe what to avoid in the image
- `--model <modelKey>`: Choose AI model (run `venice --help` to see available models)
- `--format <formatKey>`: Image size preset (square, portrait, landscape, wide, tall)
- `--width <number>`: Custom image width (default: 1024)
- `--height <number>`: Custom image height (default: 1024)
- `--lora <preset>`: Apply a Venice LoRA/style preset (Anime, Photographic, Cinematic, Fantasy Art, etc.)
- `--steps <number>`: Number of inference steps (default: 20)
- `--cfg-scale <number>`: Guidance scale (default: 2)
- `--seed <number>`: Random seed for reproducible results
- `--output-format <format>`: Output format (jpeg, png, webp - default: webp)
- `--variants <number>`: Generate multiple variants (1-4, only with --return-binary false)
- `--lora-strength <number>`: LoRA strength (0-100)
- `--embed-exif-metadata`: Embed generation parameters in EXIF metadata
- `--hide-watermark`: Hide watermark in generated image
- `--return-binary`: Return image as binary data (default: true)
- `--debug`: Enable debug mode

**Note:** Images are automatically constrained to dimensions divisible by 16 (model requirement), with a maximum of 1280x1280.

### Venice Models (`venice-models`)
Fetch and update the latest available Venice AI models from the API.

```bash
venice-models  # Updates venice/models.json with latest models
```

---

### Fal AI (`falflux`)
Generate images, videos, and 3D models using Fal AI's extensive model library. Supports LoRAs, model discovery, and advanced features.

#### Basic Usage

```bash
# Basic image generation (default model: krea-lora)
falflux --prompt "A futuristic cityscape at dusk"

# Using specific models
falflux --model pro --prompt "Photorealistic portrait"
falflux --model ultra --prompt "High quality landscape"
falflux --model dev --prompt "Creative artwork"
```

#### LoRA Support

Apply artistic styles using Low-Rank Adaptation (LoRA) models:

```bash
# Single LoRA
falflux --lora disney --prompt "An enchanted forest"
falflux --lora cinematic --prompt "A dramatic sunset" --format wide

# Multiple LoRAs (comma-separated)
falflux --lora disney,lucid --prompt "A magical landscape"
falflux --lora anime,niji --prompt "Anime character in mystical setting"
```

**Available LoRAs:** disney, lucid, retrowave, incase, eldritch, details, mj, fantasy, poly, cinematic, anime, anime-flat, anime-portrait, niji, fantasy-core, goofy, psychedelic, neurocore, anime-realistic

Run `falflux --help` for the complete list.

#### Video Generation

Generate videos from images or text:

```bash
# Image-to-video (requires input image)
falflux --model image_to_video --image-url "./photo.jpg" --prompt "Camera slowly pans right"

# With duration control
falflux --model image_to_video --image-url "./photo.jpg" --prompt "Zoom in slowly" --duration 10

# Video models: image_to_video, wan-25, hunyuan
```

#### Image-to-Image

Transform existing images:

```bash
falflux --model krea-i2i --image-url "./input.jpg" --prompt "Transform into watercolor style"
falflux --model krea-i2i --image-url "./photo.jpg" --prompt "Make it look like oil painting" --strength 0.7
```

#### Model Discovery

Explore the extensive model library:

```bash
# List all available categories
falflux --list-categories

# List all models (grouped by category)
falflux --list-models

# List models in a specific category
falflux --list-models --category text-to-image
falflux --list-models --category image-to-video

# Search for models by keyword
falflux --search "anime"
falflux --search "video"
falflux --search "3d"

# Get detailed information about a model
falflux --model-info pro
falflux --model-info krea-lora
```

**Options:**
- `--prompt <text>`: Text prompt for generation
- `--model <modelKey>`: Model to use (default: krea-lora)
- `--format <formatKey>`: Image size (square, square_hd, portrait, landscape, wide, tall)
- `--lora <keys>`: Apply LoRAs (comma-separated)
- `--seed <number>`: Random seed for reproducibility
- `--scale <number>`: Guidance scale (default: 2.7)
- `--strength <number>`: Strength for image-to-image (0.01-1.0)
- `--num-images <number>`: Number of images to generate (1-4, default: 1)
- `--image-url <path>`: Input image (URL or local file path) for image-to-video/image-to-image
- `--duration <seconds>`: Video duration (5 or 10 seconds, default: 5)
- `--out`: Save to current directory instead of default
- `--debug`: Enable debug mode
- `--list-models`: List all available models
- `--list-categories`: List all model categories
- `--search <term>`: Search models by keyword
- `--model-info <key>`: Show detailed model information

**Note:** Local image files are automatically uploaded to Fal storage when used with `--image-url`.

---

### Wavespeed AI (`wavespeed`)
Generate high-quality images using Wavespeed AI's fast and powerful models, including FLUX.2, Seedream, and more.

#### Basic Usage

```bash
# Basic image generation (default model: z-image-turbo)
wavespeed --prompt "A futuristic cityscape at dusk"

# Using specific models
wavespeed --model flux2 --prompt "Photorealistic portrait"
wavespeed --model seedream --prompt "High quality landscape"
wavespeed --model grok --prompt "Product photography shot"
```

#### Available Models

- **flux-2-flex, flux2, flex** - FLUX.2 [flex]: Fast, flexible text-to-image with enhanced realism (1536x1536 max)
- **z-image-turbo, z-image, turbo** - Z-Image-Turbo: 6B parameter model, photorealistic in sub-second time (1536x1536 max, default)
- **seedream-v4.5, seedream, v4.5** - Seedream v4.5: Latest version by ByteDance with improved quality (4096x4096 max)
- **seedream-v4, v4** - Seedream v4: High-fidelity image generation (4096x4096 max)
- **seedream-v3.1, v3.1** - Seedream v3.1: Strong style fidelity and rich detail (2048x2048 max)
- **wan-2.5, wan2.5, wan** - WAN 2.5: Alibaba text-to-image model (1440x1440 max)
- **grok-2-image, grok2, grok** - Grok 2 Image: xAI's photorealistic image generation (1536x1536 max)

#### Prompt Optimization

Wavespeed includes a built-in prompt optimizer that enhances your prompts before generation:

```bash
# Basic optimization
wavespeed --prompt "woman walking" --optimize

# Optimization for video prompts
wavespeed --prompt "city scene" --optimize --optimize-mode video

# Style-specific optimization
wavespeed --prompt "portrait shot" --optimize --optimize-style photographic
wavespeed --prompt "fantasy art" --optimize --optimize-style artistic
wavespeed --prompt "anime character" --optimize --optimize-style anime

# With reference image
wavespeed --prompt "similar style" --optimize --optimize-image https://example.com/reference.jpg
```

**Optimization Modes:** `image` (default), `video`
**Optimization Styles:** `default`, `artistic`, `photographic`, `technical`, `anime`, `realistic`

#### Advanced Features

```bash
# Custom image sizes
wavespeed --prompt "Mountain landscape" --format 1920*1080
wavespeed --prompt "Square image" --format square_hd

# Multiple generations
wavespeed --prompt "A magical landscape" --count 4

# With seed for reproducibility
wavespeed --prompt "A magical landscape" --seed 12345

# Synchronous mode (wait for result in single response)
wavespeed --prompt "Quick test" --sync

# Save to current directory
wavespeed --prompt "Local save" --out

# Debug mode
wavespeed --prompt "Test" --debug
```

**Options:**
- `--prompt <text>`: Text prompt for generation
- `--model <modelKey>`: Model to use (default: z-image-turbo)
- `--format <formatKey>`: Image size preset (square, portrait, landscape, wide, tall) or custom dimensions
- `--seed <number>`: Random seed for reproducibility
- `--count <number>`: Number of generations (default: 1)
- `--optimize`: Enable prompt optimization
- `--optimize-mode <mode>`: Optimization mode (image, video)
- `--optimize-style <style>`: Optimization style (default, artistic, photographic, technical, anime, realistic)
- `--optimize-image <url>`: Reference image URL for optimization
- `--sync`: Enable synchronous mode
- `--out`: Save to current directory instead of default
- `--debug`: Enable debug mode

**Note:** Images are automatically constrained to model-specific maximum dimensions while preserving aspect ratio.

---

### Replicate (`repflux`)
Download and manage existing predictions from your Replicate account.

```bash
# Download all predictions from your account
repflux

# Get a specific prediction by ID
node replicate/get.js <prediction-id>
```

**Note:** `repflux` does not generate new images. It downloads existing predictions from your Replicate account. Use Replicate's web interface or SDK to create new predictions.

## Environment Variables

All services require their respective API credentials to be set as environment variables:

```bash
export VENICE_API_TOKEN="your-venice-api-token"
export FAL_KEY="your-fal-api-key"
export WAVESPEED_KEY="your-wavespeed-api-key"
export REPLICATE_API_TOKEN="your-replicate-api-token"
```

Add these to your `~/.bashrc`, `~/.zshrc`, or equivalent shell configuration file for persistence.

## Output Directories

Generated media is automatically saved to the following locations:

- **Venice AI**: `./images/venice/` (automatically created)
- **Fal AI**: `./images/` (or `$FAL_PATH` if set)
- **Replicate**: `./output/` (or `$REPLICATE_OUTPUT_DIR` if set)

File naming convention: `<source>_<timestamp>.<ext>` or extracted from URL for downloads.

## Prompt Files

All services support reading prompts from a `prompt.txt` file in the current directory:

```bash
# Create a prompt file
echo "A serene mountain landscape at sunset" > prompt.txt

# Generate without --prompt flag (uses prompt.txt)
venice
falflux --model pro
```

This approach is useful for:
- Avoiding shell escaping issues with complex prompts
- Batch workflows
- Long prompts that exceed command-line limits

## Additional Features

### Model Discovery (Fal)
Use the built-in model discovery commands to explore available models:
```bash
falflux --list-categories  # See all categories
falflux --search "anime"   # Find anime models
falflux --model-info dev   # Get details about a model
```

### Debug Mode
Enable verbose logging with the `--debug` flag:
```bash
venice --prompt "test" --debug
falflux --prompt "test" --debug
```

## Development

See [CLAUDE.md](./CLAUDE.md) for detailed development documentation, architecture details, and contribution guidelines.
