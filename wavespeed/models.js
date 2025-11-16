/**
 * Wavespeed.ai model endpoints and metadata
 */

export const modelEndpoints = {
  "seedream-v4": "bytedance/seedream-v4",
  "seedream": "bytedance/seedream-v4",
  "v4": "bytedance/seedream-v4",
};

export const allModels = [
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
