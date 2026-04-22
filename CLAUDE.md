# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

flux-client is a CLI tool providing unified interfaces to two AI image generation services: Venice.ai and Wavespeed.ai. Each service is implemented as an independent module with its own CLI entry point.

## Development Commands

### Testing
```bash
npm test  # Runs smoke tests for venice and wavespeed
```

The smoke tests use mock modes to verify that each CLI generates/downloads output files without making actual API calls.

### Running Services Locally (Development)

Instead of using the installed global commands, run directly from source:

```bash
# Venice.ai
node venice/index.js --prompt "your prompt here"

# Wavespeed.ai
node wavespeed/index.js --prompt "your prompt here"
```

## Architecture

### Module Independence

Each service module (`venice/`, `wavespeed/`) is completely self-contained with no cross-dependencies. Each has evolved its own structure based on its specific needs:

**Venice structure:**
```
venice/
├── index.js        # Main entry point with orchestration logic
├── cli.js          # Commander.js CLI setup and option parsing
├── config.js       # Configuration constants and defaults
├── models.js       # Loads model endpoint mappings from models.json
├── utils.js        # File I/O, image saving
├── get-models.js   # Dynamic model discovery from Venice API
```

**Wavespeed structure:**
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

### CLI Entry Points (package.json bin)

- `venice` → `venice/index.js`
- `venice-models` → `venice/get-models.js`
- `wavespeed` → `wavespeed/index.js`

These are symlinked when installed globally via `npm install -g`.

### Key Architectural Patterns

**Prompt Handling Strategy**: Both modules support dual-input mode:
1. CLI argument via `--prompt "text"`
2. File-based via `prompt.txt` in the current working directory

The file-based approach enables batch workflows and avoids shell escaping issues.

**Model Endpoint Resolution**:
- **Venice**: Uses `models.js` which dynamically loads model endpoint mappings from `models.json`. Also supports `getModelConstraints()` for model-specific parameter validation.
- **Wavespeed**: Uses `models.js` with hardcoded `modelEndpoints` and `allModels` arrays. Includes `constrainDimensions()` to automatically scale dimensions to fit model-specific max width/height while preserving aspect ratio.

### Authentication

Both services require environment variables set before use:

- `VENICE_API_TOKEN` - Bearer token for Venice.ai
- `WAVESPEED_KEY` - API key for Wavespeed.ai

These must be set in the shell environment, not hardcoded.

### Output Directories

Images are saved to:
- Venice: `./images/venice/` or `$VENICE_PATH` if set
- Wavespeed: `./images/` or `$WAVESPEED_PATH` if set

File naming convention: `<source>_<timestamp>.png` or extracted from URL for downloads.

### aiwdm Upload Integration

Both CLIs support `--aiwdm` to push the saved image into the aiwdm media library by shelling out to the local `aiwdm upload` binary (`~/.npm-global/bin/aiwdm`). The prompt is forwarded via `--prompt` so `aiwdm` uses it verbatim as the description (skipping its AI description step).

- Flags: `--aiwdm`, `--aiwdm-rating <G|PG|PG13|R>` (default `R`), `--aiwdm-tags <a,b>` (comma-separated extras; a source tag `venice` or `wavespeed` is always prepended).
- Skipped in smoke-test mode (`VENICE_SMOKE_TEST=1` / `WAVESPEED_SMOKE_TEST=1`).
- Wavespeed: `fetchImages` now returns saved file paths, and `handleResponse` returns `{ ok, savedPaths }`. When adding new response handlers, follow the same shape so `--aiwdm` keeps working.
- Implementation is inlined in each `index.js` (`uploadToAiwdm`) to preserve module independence — no shared helper.

### API Response Handling

**Venice**: Returns binary image data directly with `return_binary: true`. No polling required.

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

Response handling uses `response-handlers.js` with category-based handlers. Supports both async (default) and sync modes via `--sync` flag.

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
- `flux-2-flex` (FLUX.2 [flex]): 1536x1536 max
- `z-image-turbo` (Z-Image-Turbo): 1536x1536 max
- `seedream-v4.5` family (base, edit, sequential, edit-sequential): 8192x8192 max — default model
- `seedream-v4` (Seedream v4): 4096x4096 max
- `seedream-v3.1` (Seedream v3.1): 2048x2048 max
- `wan-2.5` (WAN 2.5): 1440x1440 max
- `grok-2-image` (Grok 2 Image): 1536x1536 max

### Dynamic Model Updates (Venice)

The `venice-models` command fetches the latest available models from Venice's API and updates `venice/models.json`. This file is version-controlled but can be refreshed when Venice adds new models.

## Common Development Scenarios

### Adding a New Model (Venice)

Run `venice-models` to auto-update, or manually edit `venice/models.json`:
```json
{
  "modelEndpoints": {
    "model-key": "venice/model-endpoint"
  }
}
```

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

Set `--debug` flag (both services) to enable verbose output:
- Venice: Logs full input parameters
- Wavespeed: Logs API URL, request parameters, and full responses

Check for common issues:
- Missing environment variables (error on startup)
- Invalid model keys (falls back to default)
- API rate limits or authentication failures
- Image dimension constraints

### Testing Changes to CLI Options

There are smoke tests in `tests/smoke.test.js` that verify basic functionality. To run them:
```bash
npm test
```

Smoke tests use special environment variables to enable mock mode:
- `VENICE_SMOKE_TEST=1` - Venice returns mock binary data
- `WAVESPEED_SMOKE_TEST=1` - Wavespeed returns mock predictions

For manual testing of new CLI options:
1. Run with new options to ensure parsing works
2. Check default values when options are omitted
3. Verify file-based prompt fallback when `--prompt` not provided
4. Test error handling for missing environment variables
