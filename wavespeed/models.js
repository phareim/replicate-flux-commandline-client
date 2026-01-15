/**
 * Wavespeed.ai model endpoints and metadata
 */

export const modelEndpoints = {
  "flux-2-flex": "wavespeed-ai/flux-2-flex/text-to-image",
  "flux2": "wavespeed-ai/flux-2-flex/text-to-image",
  "flex": "wavespeed-ai/flux-2-flex/text-to-image",
  "z-wave": "wavespeed-ai/z-image/turbo",
  "z-image-turbo": "wavespeed-ai/z-image/turbo",
  "z-image": "wavespeed-ai/z-image/turbo",
  "turbo": "wavespeed-ai/z-image/turbo",
  "seedream-v4.5": "bytedance/seedream-v4.5",
  "seedream-v4.5-edit": "bytedance/seedream-v4.5/edit",
  "seedream-v4": "bytedance/seedream-v4",
  "seedream-v4-edit": "bytedance/seedream-v4/edit",
  "seedream-v3.1": "bytedance/seedream-v3.1",
  "seedream": "bytedance/seedream-v4.5",
  "seedream-edit": "bytedance/seedream-v4.5/edit",
  "v4.5": "bytedance/seedream-v4.5",
  "v4.5-edit": "bytedance/seedream-v4.5/edit",
  "v4": "bytedance/seedream-v4",
  "v4-edit": "bytedance/seedream-v4/edit",
  "v3.1": "bytedance/seedream-v3.1",
  "wan-2.5": "alibaba/wan-2.5/text-to-image",
  "wan2.5": "alibaba/wan-2.5/text-to-image",
  "wan": "alibaba/wan-2.5/text-to-image",
  "wan-2.5-edit": "alibaba/wan-2.5/image-edit",
  "wan-edit": "alibaba/wan-2.5/image-edit",
  "wan2.5-edit": "alibaba/wan-2.5/image-edit",
  "nano-banana-pro-edit": "google/nano-banana-pro/edit",
  "nano-edit": "google/nano-banana-pro/edit",
  "banana-edit": "google/nano-banana-pro/edit",
  "gemini-edit": "google/nano-banana-pro/edit",
  "grok-2-image": "x-ai/grok-2-image",
  "grok2": "x-ai/grok-2-image",
  "grok": "x-ai/grok-2-image",
  "sdxl": "stability-ai/sdxl",
  "stable-diffusion-xl": "stability-ai/sdxl",
  "chroma": "wavespeed-ai/chroma",
};

export const allModels = [
  {
    endpoint_id: "wavespeed-ai/flux-2-flex/text-to-image",
    metadata: {
      display_name: "FLUX.2 [flex]",
      category: "text-to-image",
      description: "Fast, flexible text-to-image generation with enhanced realism, sharper text rendering, and built-in editing. No cold start delays.",
      status: "live",
      tags: ["flux", "text-to-image", "flex", "fast", "realistic"],
      model_url: "https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-2-flex/text-to-image",
      defaultSize: "1536*1536",
      maxWidth: 1536,
      maxHeight: 1536,
    }
  },
  {
    endpoint_id: "wavespeed-ai/z-image/turbo",
    metadata: {
      display_name: "Z-Image-Turbo",
      category: "text-to-image",
      description: "6 billion parameter text-to-image model that generates photorealistic images in sub-second time. Best performance, no coldstarts, affordable pricing.",
      status: "live",
      tags: ["wavespeed", "text-to-image", "turbo", "fast", "6b"],
      model_url: "https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo'",
      maxWidth: 1536,
      maxHeight: 1536,
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
      maxWidth: 4096,
      maxHeight: 4096,
    }
  },
  {
    endpoint_id: "bytedance/seedream-v4.5/edit",
    metadata: {
      display_name: "Seedream v4.5 Edit",
      category: "image-to-image",
      description: "ByteDance Seedream 4.5 Edit preserves facial features, lighting, and color tone from reference images, delivering professional, high-fidelity edits up to 4K with strong prompt adherence.",
      status: "live",
      tags: ["bytedance", "image-to-image", "edit", "4k"],
      model_url: "https://wavespeed.ai/models/bytedance/seedream-v4.5/edit",
      maxWidth: 4096,
      maxHeight: 4096,
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
      maxWidth: 4096,
      maxHeight: 4096,
    }
  },
  {
    endpoint_id: "bytedance/seedream-v4/edit",
    metadata: {
      display_name: "Seedream v4 Edit",
      category: "image-to-image",
      description: "ByteDance's state-of-the-art image editing model that outperforms Nano Banana in fidelity and edit quality. Ready-to-use REST inference API, best performance, no coldstarts, affordable pricing.",
      status: "live",
      tags: ["bytedance", "image-to-image", "edit", "4k"],
      model_url: "https://wavespeed.ai/models/bytedance/seedream-v4/edit",
      maxWidth: 4096,
      maxHeight: 4096,
    }
  },
  {
    endpoint_id: "bytedance/seedream-v3.1",
    metadata: {
      display_name: "Seedream v3.1",
      category: "text-to-image",
      description: "Seedream V3.1 by ByteDance is a text-to-image model with upgraded visuals, stronger style fidelity, and rich detail from text prompts.",
      status: "live",
      tags: ["bytedance", "text-to-image"],
      model_url: "https://wavespeed.ai/models/bytedance/seedream-v3.1",
      defaultSize: "2048*2048",
      maxWidth: 2048,
      maxHeight: 2048,
    }
  },
  {
    endpoint_id: "alibaba/wan-2.5/text-to-image",
    metadata: {
      display_name: "WAN 2.5",
      category: "text-to-image",
      description: "Alibaba WAN 2.5 Text-to-Image turns text prompts into AI-generated images with the WAN 2.5 model for on-demand image creation.",
      status: "live",
      tags: ["alibaba", "text-to-image", "wan"],
      model_url: "https://wavespeed.ai/models/alibaba/wan-2.5/text-to-image",
      defaultSize: "1440*1440",
      maxWidth: 1440,
      maxHeight: 1440,
    }
  },
  {
    endpoint_id: "alibaba/wan-2.5/image-edit",
    metadata: {
      display_name: "WAN 2.5 Edit",
      category: "image-to-image",
      description: "Refine existing visuals with Alibaba WAN 2.5 image-edit using prompt-driven adjustments and stylistic upgrades for photos and graphics.",
      status: "live",
      tags: ["alibaba", "image-to-image", "edit", "wan"],
      model_url: "https://wavespeed.ai/models/alibaba/wan-2.5/image-edit",
      maxWidth: 1440,
      maxHeight: 1440,
    }
  },
  {
    endpoint_id: "google/nano-banana-pro/edit",
    metadata: {
      display_name: "Nano Banana Pro Edit",
      category: "image-to-image",
      description: "Google Nano Banana Pro (Gemini 3.0 Pro Image) Edit enables image editing with 4K-capable output.",
      status: "live",
      tags: ["google", "image-to-image", "edit", "gemini", "4k"],
      model_url: "https://wavespeed.ai/models/google/nano-banana-pro/edit",
      maxWidth: 4096,
      maxHeight: 4096,
    }
  },
  {
    endpoint_id: "x-ai/grok-2-image",
    metadata: {
      display_name: "Grok 2 Image",
      category: "text-to-image",
      description: "xAI's latest image generation model converting simple text prompts into sharp, photorealistic visuals. Suitable for product photography, social media content, and conceptual artwork with close adherence to instructions.",
      status: "live",
      tags: ["x-ai", "text-to-image", "grok", "photorealistic", "fast"],
      model_url: "https://api.wavespeed.ai/api/v3/x-ai/grok-2-image",
      maxWidth: 1536,
      maxHeight: 1536,
    }
  },
  {
    endpoint_id: "stability-ai/sdxl",
    metadata: {
      display_name: "SDXL",
      category: "text-to-image",
      description: "Stable Diffusion XL - a text-to-image generator that creates beautiful, high-quality images.",
      status: "live",
      tags: ["stability-ai", "text-to-image", "sdxl", "stable-diffusion"],
      model_url: "https://api.wavespeed.ai/api/v3/stability-ai/sdxl",
      defaultSize: "1024*1024",
      maxWidth: 1536,
      maxHeight: 1536,
    }
  },
  {
    endpoint_id: "wavespeed-ai/chroma",
    metadata: {
      display_name: "Chroma",
      category: "text-to-image",
      description: "Uncensored image generation for creative expression and artistic freedom. No cold starts.",
      status: "live",
      tags: ["wavespeed", "text-to-image", "chroma", "uncensored"],
      model_url: "https://api.wavespeed.ai/api/v3/wavespeed-ai/chroma",
      defaultSize: "1536*1536",
      maxWidth: 1536,
      maxHeight: 1536,
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

/**
 * Constrain dimensions to model's maximum values while preserving aspect ratio
 * @param {string} size - Size string in format "width*height"
 * @param {string} modelKeyOrEndpoint - Model key or endpoint to check constraints
 * @returns {string} - Constrained size string
 */
export function constrainDimensions(size, modelKeyOrEndpoint) {
  const modelInfo = getModelInfo(modelKeyOrEndpoint);

  if (!modelInfo?.metadata?.maxWidth && !modelInfo?.metadata?.maxHeight) {
    return size; // No constraints for this model
  }

  // Parse the size string
  const [widthStr, heightStr] = size.split('*');
  let width = parseInt(widthStr, 10);
  let height = parseInt(heightStr, 10);

  if (isNaN(width) || isNaN(height)) {
    return size; // Invalid format, return as-is
  }

  const maxWidth = modelInfo.metadata.maxWidth || Infinity;
  const maxHeight = modelInfo.metadata.maxHeight || Infinity;

  // Calculate scaling factor to fit within max dimensions
  const scaleWidth = maxWidth / width;
  const scaleHeight = maxHeight / height;
  const scale = Math.min(scaleWidth, scaleHeight, 1); // Don't upscale

  if (scale < 1) {
    // Need to scale down
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }

  return `${width}*${height}`;
}
