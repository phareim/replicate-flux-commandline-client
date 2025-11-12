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

export const loraNames = {
    disney: {
        url: "https://civitai.com/api/download/models/825954?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "DisneyRenstyle",
    },
    lucid: {
        url: "https://civitai.com/api/download/models/857586?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "Lucid Dream",
    },
    retrowave: {
        url: "https://civitai.com/api/download/models/913440?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "ck-rw, in the style of ck-rw,",
    },
    incase: {
        url: "https://civitai.com/api/download/models/857267?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "Incase art",
    },
    eldritch: {
        url: "https://civitai.com/api/download/models/792184?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "Eldritch Comic",
    },
    details_alt: {
        url: "https://civitai.com/api/download/models/839689?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "",
    },
    details: {
        url: "https://civitai.com/api/download/models/955535?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "aidmafluxpro1.1",
    },
    details_strong: {
        url: "https://civitai.com/api/download/models/839637?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "",
    },
    mj: {
        url: "https://civitai.com/api/download/models/827351?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "aidmaMJ6.1",
    },
    fantasy: {
        url: "https://civitai.com/api/download/models/880134?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "",
    },
    poly: {
        url: "https://civitai.com/api/download/models/812320?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "",
    },
    cinematic: {
        url: "https://civitai.com/api/download/models/857668?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "cinematic, cinematic still image",
    },
    "anime-flat": {
        url: "https://civitai.com/api/download/models/838667?type=Model&format=SafeTensor",
        scale: "2",
        keyword: "Flat colour anime style image showing",
    },
    anime: {
        url: "https://civitai.com/api/download/models/753053?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "MythAn1m3",
    },
    "anime-portrait": {
        url: "https://civitai.com/api/download/models/753053?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "MythP0rt",
    },
    niji: {
        url: "https://civitai.com/api/download/models/855516?type=Model&format=SafeTensor",
        scale: "0.9",
        keyword: "aidmanijiv6",
    },
    "fantasy-core": {
        url: "https://civitai.com/api/download/models/905789?type=Model&format=SafeTensor",
        scale: "1",
        keyword:
            "This is a highly detailed, CGI-rendered digital artwork depicting a",
    },
    goofy: {
        url: "https://civitai.com/api/download/models/830009?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "3d render ",
    },
    psychedelic: {
        url: "https://civitai.com/api/download/models/983116?type=Model&format=SafeTensor",
        scale: "0.6",
        keyword: "ArsMovieStill, movie still from a 60s psychedelic movie",
    },
    neurocore: {
        url: "https://civitai.com/api/download/models/1010560?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "A digital artwork in the style of cknc,",
    },
    "anime-realistic": {
        url: "https://civitai.com/api/download/models/1023735?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "Realistic anime style,",
    },
};

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

/**
 * Search models by keyword
 * @param {string} query - Search term
 * @returns {Array} - Array of matching model objects
 */
export function searchModels(query) {
    const lowerQuery = query.toLowerCase();
    return allModels.filter(model => {
        const displayName = model.metadata.display_name?.toLowerCase() || '';
        const description = model.metadata.description?.toLowerCase() || '';
        const endpointId = model.endpoint_id.toLowerCase();

        return displayName.includes(lowerQuery) ||
               description.includes(lowerQuery) ||
               endpointId.includes(lowerQuery);
    });
}

/**
 * Get models by category
 * @param {string} category - Category name
 * @returns {Array} - Array of model objects in that category
 */
export function getModelsByCategory(category) {
    return allModels.filter(model => model.metadata.category === category);
}

export function prepareLoras(loraObjects, scale) {
    if (!loraObjects || loraObjects.length === 0) return null;

    const loras = loraObjects.map((loraObj) => ({
        path: loraObj.url,
        scale: loraObj.scale || scale,
    }));

    const loraKeywords = loraObjects
        .map((loraObj) => loraObj.keyword)
        .filter(Boolean)
        .join(". ");

    return { loras, loraKeywords };
}
