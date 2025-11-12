/**
 * Model endpoint resolution for Fal.ai
 * Handles mapping between short keys and full endpoint IDs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load models from JSON file
const modelsPath = path.join(__dirname, 'models.json');
const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf-8'));

export const allModels = modelsData.models;

/**
 * Generate a short key from an endpoint ID
 * Examples:
 *   fal-ai/flux-pro/v1.1 -> pro11
 *   fal-ai/flux/dev -> dev
 *   fal-ai/wan-i2v -> wan-i2v
 */
function generateShortKey(endpointId) {
  // Remove fal-ai/ prefix
  let key = endpointId.replace(/^fal-ai\//, '');

  // For simple cases like "flux/dev", just return "dev"
  if (key.includes('/')) {
    const parts = key.split('/');
    const last = parts[parts.length - 1];

    // Special cases for version numbers
    if (last.match(/^v?\d+/)) {
      // e.g., flux-pro/v1.1 -> pro11
      return parts[parts.length - 2].replace(/-/g, '') + last.replace(/[^0-9]/g, '');
    }

    // Return the last part for most cases
    return last;
  }

  return key;
}

// Build endpoint mapping dynamically
export const modelEndpoints = {};
const keyToModel = {}; // Maps short key to full model object

allModels.forEach(model => {
  const endpointId = model.endpoint_id;
  const shortKey = generateShortKey(endpointId);

  // Avoid collisions - if key exists, use full path
  if (modelEndpoints[shortKey] && modelEndpoints[shortKey] !== endpointId) {
    // Use a more specific key
    const specificKey = endpointId.replace(/^fal-ai\//, '').replace(/\//g, '-');
    modelEndpoints[specificKey] = endpointId;
    keyToModel[specificKey] = model;
  } else {
    modelEndpoints[shortKey] = endpointId;
    keyToModel[shortKey] = model;
  }

  // Also map the full endpoint_id to itself
  modelEndpoints[endpointId] = endpointId;
  keyToModel[endpointId] = model;
});

// Manual shortcuts for commonly used models (only include models that exist in models.json)
const shortcuts = {
  pro: "fal-ai/flux-pro/v1.1-ultra", // "flux-pro/new" doesn't exist, using ultra as default
  ultra: "fal-ai/flux-pro/v1.1-ultra",
  dev: "fal-ai/flux/dev",
  lora: "fal-ai/flux-lora",
  kontext: "fal-ai/flux-pro/kontext",
  "red-panda": "fal-ai/recraft/v3/text-to-image",
  "image_to_video": "fal-ai/minimax/video-01/image-to-video",
  krea: "fal-ai/flux/krea",
  "krea-i2i": "fal-ai/flux/krea/image-to-image",
  "krea-lora": "fal-ai/flux-krea-lora",
  "wan-25": "fal-ai/wan-25-preview/image-to-video",
  // Note: Many shortcuts have been removed as the models don't exist in current models.json
  // The auto-generated keys from endpoint_id should cover most models
};

// Merge shortcuts with auto-generated mappings
Object.assign(modelEndpoints, shortcuts);

// Update keyToModel for shortcuts
Object.entries(shortcuts).forEach(([key, endpointId]) => {
  const model = allModels.find(m => m.endpoint_id === endpointId);
  if (model) {
    keyToModel[key] = model;
  }
});

/**
 * Get the full model endpoint from a short key
 * @param {string} modelKey - Short key or full endpoint ID
 * @param {Array} loraObjects - Array of LoRA objects (optional)
 * @returns {string} - Full endpoint ID
 */
export function getModelEndpoint(modelKey, loraObjects = []) {
    const endpoint = modelEndpoints[modelKey];

    if (endpoint) {
        return endpoint;
    }

    // Fallback: if LoRAs are provided, use flux-lora, otherwise ultra
    return loraObjects.length > 0 ? "fal-ai/flux-lora" : "fal-ai/flux-pro/v1.1-ultra";
}

/**
 * Get the full model object from a short key or endpoint ID
 * @param {string} modelKey - Short key or full endpoint ID
 * @returns {Object|null} - Model object with endpoint_id and metadata
 */
export function getModelInfo(modelKey) {
    return keyToModel[modelKey] || null;
}

// Internal export for model-utils.js
export { keyToModel };
