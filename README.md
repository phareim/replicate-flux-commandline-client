# AI Image Generation CLI Tools

A command-line interface for generating images using various AI services: Venice.ai, Replicate.ai, and Fal.ai.

## Installation

```bash
npm install -g flux-client
```

## Available Commands

### Venice AI (`venice`)
Generate images using Venice AI's models. defaults to anime. 

```bash
# Basic usage
venice --prompt "A futuristic cityscape at dusk"

# Advanced options
venice --prompt "A serene landscape" --format wide --style-preset photographic
venice --prompt "A cyberpunk scene" --steps 25 --cfg-scale 2 --seed 42
```

Options:
- `--prompt`: Text description of the image to generate
- `--model`: Choose AI model (default: flux-dev)
- `--format`: Image size preset (square, portrait, landscape, wide)
- `--style-preset`: Visual style (anime, photographic, digital-art, etc.)
- `--steps`: Generation steps (max 30)
- `--cfg-scale`: Guidance scale
- `--seed`: For reproducible results
- `--negative-prompt`: What to avoid in the image

### Venice Models (`venice-models`)
List and update available Venice AI models.

```bash
venice-models
```

### Fal AI (`falflux`)
Generate images using Fal AI's models.

```bash
falflux --prompt "A happy dog" --model pro
```

### Replicate (`repflux`)
Generate images using Replicate's models.

```bash
repflux --prompt "A mountain landscape"
```

## Environment Variables

- `VENICE_API_TOKEN`: Your Venice AI API token
- `FAL_KEY`: Your Fal AI API key
- `REPLICATE_API_TOKEN`: Your Replicate API token

## Output
Generated images are saved in:
- Venice AI: `./images/venice/`
- Fal AI: `./images/`
- Replicate: `./output/`
