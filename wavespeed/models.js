/**
 * Wavespeed.ai model endpoints and metadata
 */

export const modelEndpoints = {
  "z-wave": "wavespeed-ai/z-image/turbo",
  "z-image-turbo": "wavespeed-ai/z-image/turbo",
  "z-image": "wavespeed-ai/z-image/turbo",
  "turbo": "wavespeed-ai/z-image/turbo",
  "seedream-v4.5": "bytedance/seedream-v4.5",
  "seedream-v4": "bytedance/seedream-v4",
  "seedream": "bytedance/seedream-v4.5",
  "v4.5": "bytedance/seedream-v4.5",
  "v4": "bytedance/seedream-v4",
};

export const allModels = [
  {
    endpoint_id: "wavespeed-ai/z-image/turbo",
    metadata: {
      display_name: "Z-Image-Turbo",
      category: "text-to-image",
      description: "6 billion parameter text-to-image model that generates photorealistic images in sub-second time. Best performance, no coldstarts, affordable pricing.",
      status: "live",
      tags: ["wavespeed", "text-to-image", "turbo", "fast", "6b"],
      model_url: "https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo'",
    }
  },
  {
    endpoint_id: "bytedance/seedream-v4.5",
    metadata: {
      display_name: "Seedream v4.5",
      category: "text-to-image",
      description: "Seedream 4.5 by ByteDance - latest version with improved quality and performance.",
      status: "live",
      tags: ["bytedance", "text-to-image", "4k", "latest"],
      model_url: "https://wavespeed.ai/models/bytedance/seedream-v4.5",
    }
  },
  {
    endpoint_id: "bytedance/seedream-v4",
    metadata: {
      display_name: "Seedream v4",
      category: "text-to-image",
      description: "Seedream 4.0 by ByteDance is a state-of-the-art image generation model delivering high-fidelity outputs and outperforming Nano Banana.",
      status: "live",
      tags: ["bytedance", "text-to-image", "4k"],
      model_url: "https://wavespeed.ai/models/bytedance/seedream-v4",
    }
  }
];

/**
 * Get the full model endpoint from a short key
 */
export function getModelEndpoint(modelKey) {
  return modelEndpoints[modelKey] || modelKey;
}

/**
 * Get model metadata by key or endpoint
 */
export function getModelInfo(modelKeyOrEndpoint) {
  const endpoint = getModelEndpoint(modelKeyOrEndpoint);
  return allModels.find(m => m.endpoint_id === endpoint);
}
