# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

flux-client is a CLI tool providing unified interfaces to three AI image generation services: Venice.ai, Fal.ai, and Replicate.ai. Each service is implemented as an independent module with its own CLI entry point.

## Development Commands

### Testing
```bash
npm test  # Currently returns success with "no tests" message
```

### Running Services Locally (Development)

Instead of using the installed global commands, run directly from source:

```bash
# Venice.ai
node venice/index.js --prompt "your prompt here"

# Fal.ai
node fal/index.js --prompt "your prompt here" --model pro

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

Each service module (`venice/`, `fal/`, `replicate/`) is completely self-contained with no cross-dependencies. They share a common architectural pattern but can be modified independently:

```
<module>/
├── index.js      # Main entry point with orchestration logic
├── cli.js        # Commander.js CLI setup and option parsing
├── config.js     # Configuration constants and defaults
├── models.js     # Model endpoint mappings (Venice & Fal only)
├── utils.js      # File I/O, HTTP requests, image saving
```

### CLI Entry Points (package.json bin)

- `venice` → `venice/index.js`
- `venice-models` → `venice/get-models.js`
- `falflux` → `fal/index.js`
- `repflux` → `replicate/index.js`

These are symlinked when installed globally via `npm install -g`.

### Key Architectural Patterns

**Prompt Handling Strategy**: All modules support dual-input mode:
1. CLI argument via `--prompt "text"`
2. File-based via `prompt.txt` in the current working directory

The file-based approach enables batch workflows and avoids shell escaping issues.

**Model Endpoint Resolution**: Venice and Fal use a key-based system (`models.js`) that maps short keys (e.g., `pro`, `dev`) to full API endpoints. This abstraction allows easy updates when providers change endpoints.

**LoRA System (Fal only)**: The Fal module supports LoRA (Low-Rank Adaptation) models defined in `fal/models.js`. LoRAs can be:
- Applied via `--lora <key>` flags (multiple allowed)
- Automatically inject trigger keywords into prompts
- Have configurable scale values for blend strength

When LoRAs are specified, the model endpoint automatically switches to `fal-ai/flux-lora` unless explicitly overridden.

**Video Generation (Fal only)**: Several Fal models support video generation with specific workflows:
- Models like `image_to_video`, `hunyuan`, `wan-i2v`, `kling-i2v` require an input image
- Local image files are automatically uploaded to Fal storage using `@fal-ai/client`
- Video outputs have different result structures than images (e.g., `result.video.url` vs `result.images[]`)

### Authentication

All services require environment variables set before use:

- `VENICE_API_TOKEN` - Bearer token for Venice.ai
- `FAL_KEY` - API key for Fal.ai
- `REPLICATE_API_TOKEN` - API token for Replicate.ai

These must be set in the shell environment, not hardcoded.

### Output Directories

Images/videos are saved to:
- Venice: `./images/venice/` (auto-created)
- Fal: `./images/` or `$FAL_PATH` if set
- Replicate: `./output/` or `$REPLICATE_OUTPUT_DIR` if set

File naming convention: `<source>_<timestamp>.png` or extracted from URL for downloads.

### API Response Handling

**Venice**: Returns binary image data directly with `return_binary: true`. No polling required.

**Fal**: Uses queue-based generation with progress callbacks:
```javascript
fal.subscribe(modelEndpoint, {
  input,
  onQueueUpdate: (update) => {
    // update.status: IN_QUEUE → IN_PROGRESS → COMPLETED
    // update.queue_position, update.logs available
  }
})
```

**Replicate**: Uses the official Replicate SDK's prediction API. The `repflux` command fetches all existing predictions from the account rather than generating new images.

## Important Implementation Details

### Image Size Constraints (Venice)

Venice requires dimensions divisible by 16. The code automatically rounds down:
```javascript
_width = Math.floor(_width / 16) * 16;
_height = Math.floor(_height / 16) * 16;
```

Maximum dimensions: 1280x1280 (enforced via `Math.min`).

### Model-Specific Parameter Handling (Fal)

Different Fal models accept different parameters. The `fal/index.js` implementation uses conditional logic based on `modelEndpoint`:

- Video models require `image_url` parameter
- Krea models have hardcoded optimal parameters (strength=0.9, steps=40, guidance=4.5)
- Standard Flux models support LoRAs
- All other parameters are passed through (Fal ignores unsupported ones)

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
  "model-key": "venice/model-endpoint"
}
```

**Fal**: Edit `fal/models.js` and add to `modelEndpoints`:
```javascript
export const modelEndpoints = {
  "your-key": "fal-ai/your/endpoint",
  // ...
};
```

### Adding a New LoRA (Fal)

Edit `fal/models.js` and add to `loraNames`:
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

The keyword is automatically prepended to prompts when the LoRA is used.

### Debugging API Issues

Set `--debug` flag (Venice and Fal) to enable verbose output:
- Venice: Logs full input parameters
- Fal: Logs complete API responses

Check for common issues:
- Missing environment variables (error on startup)
- Invalid model keys (falls back to default)
- API rate limits or authentication failures
- Image dimension constraints (Venice)

### Testing Changes to CLI Options

Since there are no automated tests, manually verify:
1. Run with new options to ensure parsing works
2. Check default values when options are omitted
3. Verify file-based prompt fallback when `--prompt` not provided
4. Test error handling for missing environment variables
