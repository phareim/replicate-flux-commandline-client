# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

flux-client is a CLI tool providing unified interfaces to four AI image generation services: Venice.ai, Fal.ai, Replicate.ai, and Wavespeed.ai. Each service is implemented as an independent module with its own CLI entry point.

## Development Commands

### Testing
```bash
npm test  # Runs smoke tests for all services (venice, fal, replicate, wavespeed)
```

The smoke tests use mock modes to verify that each CLI generates/downloads output files without making actual API calls.

### Running Services Locally (Development)

Instead of using the installed global commands, run directly from source:

```bash
# Venice.ai
node venice/index.js --prompt "your prompt here"

# Fal.ai
node fal/index.js --prompt "your prompt here" --model pro

# Wavespeed.ai
node wavespeed/index.js --prompt "your prompt here"

# Replicate - List and download all predictions
node replicate/index.js

# Replicate - Get specific prediction
node replicate/get.js <prediction-id>
```

### Makefile Commands (Replicate only)

```bash
make run    # Run replicate/index.js (downloads all predictions)
make get    # Run replicate/get.js with prediction ID as argument
```

## Architecture

### Module Independence

Each service module (`venice/`, `fal/`, `replicate/`, `wavespeed/`) is completely self-contained with no cross-dependencies. Each has evolved its own structure based on its specific needs:

**Venice structure:**
```
venice/
├── index.js        # Main entry point with orchestration logic
├── cli.js          # Commander.js CLI setup and option parsing
├── config.js       # Configuration constants and defaults
├── models.js       # Loads model endpoint mappings from models.json
├── utils.js        # File I/O, HTTP requests, image saving
├── generate.js     # Generation logic
├── get-models.js   # Dynamic model discovery from Venice API
```

**Fal structure (heavily refactored):**
```
fal/
├── index.js                # Main entry point with orchestration logic
├── cli.js                  # Commander.js CLI setup and option parsing
├── config.js               # Configuration constants and defaults
├── models.js               # Re-export hub for model utilities
├── model-resolver.js       # Model endpoint resolution from models.json
├── model-utils.js          # Model search and query utilities
├── model-overrides.js      # Model-specific parameter overrides
├── loras.js                # LoRA definitions and utilities
├── parameter-builders.js   # Category-based parameter building
├── response-handlers.js    # Category-based response handling
├── utils.js                # File I/O, HTTP requests, image saving
```

**Wavespeed structure (similar to Fal):**
```
wavespeed/
├── index.js                # Main entry point with orchestration logic
├── cli.js                  # Commander.js CLI setup and option parsing
├── config.js               # Configuration constants and defaults
├── models.js               # Model endpoint mappings and metadata
├── parameter-builders.js   # Category-based parameter building
├── response-handlers.js    # Category-based response handling
├── utils.js                # File I/O, HTTP requests, image saving
```

**Replicate structure (minimal):**
```
replicate/
├── index.js      # Main entry point - fetches all predictions
├── get.js        # Fetches specific prediction by ID
```
Note: Replicate has no cli.js, config.js, or models.js files. It's a simple script that downloads predictions.

### CLI Entry Points (package.json bin)

- `venice` → `venice/index.js`
- `venice-models` → `venice/get-models.js`
- `falflux` → `fal/index.js`
- `wavespeed` → `wavespeed/index.js`
- `repflux` → `replicate/index.js`

These are symlinked when installed globally via `npm install -g`.

### Key Architectural Patterns

**Prompt Handling Strategy**: All modules support dual-input mode:
1. CLI argument via `--prompt "text"`
2. File-based via `prompt.txt` in the current working directory

The file-based approach enables batch workflows and avoids shell escaping issues.

**Model Endpoint Resolution**:
- **Venice**: Uses `models.js` which dynamically loads model endpoint mappings from `models.json`. Also supports `getModelConstraints()` for model-specific parameter validation.
- **Fal**: Uses a more sophisticated system with `model-resolver.js` loading from `models.json` and auto-generating short keys from endpoint IDs (e.g., `fal-ai/flux-pro/v1.1` → `pro11`). Additional model utilities in `model-utils.js` provide search and category filtering.
- **Wavespeed**: Uses `models.js` with hardcoded `modelEndpoints` and `allModels` arrays. Includes `constrainDimensions()` to automatically scale dimensions to fit model-specific max width/height while preserving aspect ratio.

**LoRA System (Fal only)**: The Fal module supports LoRA (Low-Rank Adaptation) models defined in `fal/loras.js`. LoRAs can be:
- Applied via `--lora <key>` flags (multiple allowed)
- Automatically inject trigger keywords into prompts
- Have configurable scale values for blend strength

LoRA support is model-specific and controlled via `model-overrides.js`. Only models that support LoRAs (like `flux-lora`, `flux-krea-lora`) will apply them.

**Video Generation (Fal only)**: Several Fal models support video generation with specific workflows:
- Models like `image_to_video`, `hunyuan`, `wan-i2v`, `kling-i2v` require an input image
- Local image files are automatically uploaded to Fal storage using `@fal-ai/client`
- Video outputs have different result structures than images (e.g., `result.video.url` vs `result.images[]`)

### Authentication

All services require environment variables set before use:

- `VENICE_API_TOKEN` - Bearer token for Venice.ai
- `FAL_KEY` - API key for Fal.ai
- `WAVESPEED_KEY` - API key for Wavespeed.ai
- `REPLICATE_API_TOKEN` - API token for Replicate.ai

These must be set in the shell environment, not hardcoded.

### Output Directories

Images/videos are saved to:
- Venice: `./images/venice/` (auto-created)
- Fal: `./images/` or `$FAL_PATH` if set
- Wavespeed: `./images/` or `$WAVESPEED_PATH` if set
- Replicate: `./output/` or `$REPLICATE_OUTPUT_DIR` if set

File naming convention: `<source>_<timestamp>.png` or extracted from URL for downloads.

### API Response Handling

**Venice**: Returns binary image data directly with `return_binary: true`. No polling required.

**Fal**: Uses queue-based generation with progress callbacks and category-based response handling:
```javascript
fal.subscribe(modelEndpoint, {
  input,
  onQueueUpdate: (update) => {
    // update.status: IN_QUEUE → IN_PROGRESS → COMPLETED
    // update.queue_position, update.logs available
  }
})
```

Response handling has been refactored into `response-handlers.js` with category-specific handlers:
- `handleImageResponse`: Standard image results (result.images[])
- `handleVideoResponse`: Video results (result.video.url)
- `handleDataResponse`: Data/model results (result.data.url for 3D models, etc.)
- Each handler includes progress tracking and proper file naming

**Wavespeed**: Uses a polling-based approach with async predictions:
```javascript
// POST to API endpoint creates a prediction
const response = await fetch(apiUrl, { method: "POST", ... });
const predictionData = response.data;

// Poll for completion using prediction.urls.get or prediction.id
while (status !== 'completed') {
  const result = await fetch(predictionUrl);
  // Status: processing → completed | failed
}
```

Response handling uses `response-handlers.js` with category-based handlers similar to Fal. Supports both async (default) and sync modes via `--sync` flag.

**Prompt Optimization (Wavespeed only)**: Wavespeed includes a prompt optimizer API that can enhance prompts before generation:
- Enabled via `--optimize` flag
- Optimizer endpoint: `wavespeed-ai/prompt-optimizer`
- Parameters:
  - `--optimize-mode`: `image` (default) or `video`
  - `--optimize-style`: `default`, `artistic`, `photographic`, `technical`, `anime`, or `realistic`
  - `--optimize-image`: Optional reference image URL for context
- Implementation validates parameters against API spec and falls back to defaults for invalid values
- Returns an enhanced version of the prompt
- Falls back to original prompt on error to ensure generation continues
- Uses async mode with polling (0.5s intervals) to retrieve optimized prompt

**Replicate**: Uses the official Replicate SDK's prediction API. The `repflux` command fetches all existing predictions from the account rather than generating new images.

## Important Implementation Details

### Image Size Constraints (Venice)

Venice requires dimensions divisible by 16. The code automatically rounds down:
```javascript
_width = Math.floor(_width / 16) * 16;
_height = Math.floor(_height / 16) * 16;
```

Maximum dimensions: 1280x1280 (enforced via `Math.min`).

### Model-Specific Dimension Constraints (Wavespeed)

Wavespeed models have varying maximum dimensions defined in `models.js`:
```javascript
const modelInfo = getModelInfo(modelEndpoint);
const maxWidth = modelInfo.metadata.maxWidth;  // e.g., 4096, 1536, 1440
const maxHeight = modelInfo.metadata.maxHeight;
```

The `constrainDimensions()` function automatically scales down requested dimensions while preserving aspect ratio to fit within model limits. Examples:
- `flux-2-flex`: 1536x1536 max
- `z-image-turbo`: 1536x1536 max
- `seedream-v4.5`, `seedream-v4`: 4096x4096 max
- `seedream-v3.1`: 2048x2048 max
- `wan-2.5`: 1440x1440 max

### Model-Specific Parameter Handling (Fal)

The Fal module uses a **category-based architecture** for parameter handling:

**Category-based parameter building** (`parameter-builders.js`):
- Models are categorized: `text-to-image`, `image-to-image`, `image-to-video`, `text-to-video`, `video-to-video`, `image-to-3d`, etc.
- Each category has a strategy function that builds appropriate default parameters
- Categories determine required parameters (e.g., image-to-video requires `image_url`)

**Model-specific overrides** (`model-overrides.js`):
- Models needing non-standard parameters are defined in `modelOverrides` object
- **Krea models** have specialized handling:
  - `fal-ai/flux/krea`: output_format=jpeg, acceleration=none, no LoRA support
  - `fal-ai/flux/krea/image-to-image`: strength=0.9, steps=40, guidance=4.5, output_format=jpeg, no LoRA support
  - `fal-ai/flux-krea-lora`: steps=28, guidance=3.5, output_format=jpeg, supports LoRAs
- Override system also controls which models support LoRAs via `supportsLoras` flag

This architecture makes it easy to add new models without cluttering the main index.js file.

### Dynamic Model Updates (Venice)

The `venice-models` command fetches the latest available models from Venice's API and updates `venice/models.json`. This file is version-controlled but can be refreshed when Venice adds new models.

### File Upload Strategy (Fal)

When `--image-url` is provided:
1. Check if it's a web URL (starts with `http://` or `https://`)
2. If web URL: pass directly to Fal
3. If local path: resolve absolute path, upload to Fal storage, use returned URL

This enables seamless local file usage for image-to-video workflows.

## Common Development Scenarios

### Adding a New Model (Venice or Fal)

**Venice**: Run `venice-models` to auto-update, or manually edit `venice/models.json`:
```json
{
  "modelEndpoints": {
    "model-key": "venice/model-endpoint"
  }
}
```

**Fal**: Models are loaded from `fal/models.json` which contains model metadata and endpoint IDs. The file structure:
```json
{
  "models": [
    {
      "endpoint_id": "fal-ai/your/endpoint",
      "metadata": {
        "display_name": "Your Model",
        "category": "text-to-image",
        "description": "Model description",
        "status": "live",
        ...
      }
    }
  ]
}
```

The `model-resolver.js` auto-generates short keys from endpoint IDs, but you can add manual shortcuts in the `shortcuts` object in `model-resolver.js`.

If the model needs special parameter handling:
1. Check if its category in `parameter-builders.js` handles it correctly
2. If not, add model-specific overrides to `model-overrides.js`:
```javascript
export const modelOverrides = {
  'fal-ai/your/endpoint': {
    params: {
      custom_param: value,
    },
    supportsLoras: true,  // or false
  },
};
```

### Adding a New LoRA (Fal)

Edit `fal/loras.js` and add to `loraNames`:
```javascript
export const loraNames = {
  "your-lora": {
    url: "https://civitai.com/api/download/models/...",
    scale: "1",
    keyword: "trigger word",
  },
  // ...
};
```

The keyword is automatically prepended to prompts when the LoRA is used. Ensure the model you're using supports LoRAs by checking `model-overrides.js`.

### Model Discovery (Fal)

The Fal module includes powerful model discovery features:

```bash
# List all available model categories
falflux --list-categories

# List all models, grouped by category
falflux --list-models

# List models in a specific category
falflux --list-models --category text-to-image

# Search for models by name or description
falflux --search "video"

# Get detailed information about a specific model
falflux --model-info pro
```

These commands use data from `models.json` and utilities in `model-utils.js`.

### Adding a New Model (Wavespeed)

Wavespeed models are hardcoded in `wavespeed/models.js`:

1. Add shortcut mapping to `modelEndpoints`:
```javascript
export const modelEndpoints = {
  "your-key": "provider/model-name/endpoint",
  // ...
};
```

2. Add full model metadata to `allModels`:
```javascript
{
  endpoint_id: "provider/model-name/endpoint",
  metadata: {
    display_name: "Model Name",
    category: "text-to-image",
    description: "Model description",
    status: "live",
    tags: ["provider", "text-to-image"],
    model_url: "https://...",
    maxWidth: 4096,
    maxHeight: 4096,
  }
}
```

The `constrainDimensions()` function will automatically enforce the max dimensions.

### Debugging API Issues

Set `--debug` flag (Venice, Fal, and Wavespeed) to enable verbose output:
- Venice: Logs full input parameters
- Fal: Logs complete API responses
- Wavespeed: Logs API URL, request parameters, and full responses

Check for common issues:
- Missing environment variables (error on startup)
- Invalid model keys (falls back to default)
- API rate limits or authentication failures
- Image dimension constraints (Venice, Wavespeed)

### Testing Changes to CLI Options

There are smoke tests in `tests/smoke.test.js` that verify basic functionality for all services. To run them:
```bash
npm test
```

Smoke tests use special environment variables to enable mock mode:
- `VENICE_SMOKE_TEST=1` - Venice returns mock binary data
- `FAL_SMOKE_TEST=1` - Fal returns mock results
- `WAVESPEED_SMOKE_TEST=1` - Wavespeed returns mock predictions
- `REPLICATE_SMOKE_TEST=1` - Replicate returns mock downloads

For manual testing of new CLI options:
1. Run with new options to ensure parsing works
2. Check default values when options are omitted
3. Verify file-based prompt fallback when `--prompt` not provided
4. Test error handling for missing environment variables
