/**
 * Model-specific overrides for models that need non-standard parameters
 * Only truly exceptional cases should be added here
 */
export const modelOverrides = {
  'fal-ai/flux/krea/image-to-image': {
    params: {
      strength: 0.9,
      num_inference_steps: 40,
      guidance_scale: 4.5,
      output_format: "jpeg",
      acceleration: "none",
    },
    supportsLoras: false,
  },

  'fal-ai/flux/krea': {
    params: {
      output_format: "jpeg",
      acceleration: "none",
    },
    supportsLoras: false,
  },

  'fal-ai/flux-krea-lora': {
    params: {
      num_inference_steps: 38,
      guidance_scale: 2.5,
      output_format: "jpeg",
    },
    supportsLoras: true,
  },

  'fal-ai/minimax/video-01/image-to-video': {
    params: {
      prompt_optimizer: true,
    },
  },

  'fal-ai/bytedance/seedream/v4/text-to-image': {
    params: {
      image_size: { width: 4096, height: 4096 },
      enable_safety_checker: false,
      enhance_prompt_mode: "standard",
    },
    supportsLoras: false,
    maxWidth: 4096,
    maxHeight: 4096,
  },
};

/**
 * Constrain image dimensions to model's maximum values while preserving aspect ratio
 * @param {Object} imageSize - Image size object with width and height
 * @param {number} maxWidth - Maximum allowed width
 * @param {number} maxHeight - Maximum allowed height
 * @returns {Object} - Constrained image size object
 */
function constrainImageSize(imageSize, maxWidth, maxHeight) {
  if (!imageSize || typeof imageSize !== 'object' || !imageSize.width || !imageSize.height) {
    return imageSize; // Not an object with dimensions, return as-is
  }

  let { width, height } = imageSize;

  // Calculate scaling factor to fit within max dimensions
  const scaleWidth = maxWidth / width;
  const scaleHeight = maxHeight / height;
  const scale = Math.min(scaleWidth, scaleHeight, 1); // Don't upscale

  if (scale < 1) {
    // Need to scale down
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }

  return { width, height };
}

/**
 * Apply model-specific overrides to input parameters
 * @param {string} modelEndpoint - The full model endpoint ID
 * @param {Object} input - Base input parameters
 * @param {Object} options - User options
 * @returns {Object} - Modified input parameters
 */
export function applyModelOverrides(modelEndpoint, input, options) {
  const override = modelOverrides[modelEndpoint];

  if (!override) {
    return input;
  }

  // Merge override params (don't override user-provided values)
  const mergedInput = { ...input };

  for (const [key, value] of Object.entries(override.params)) {
    // Only apply override if user hasn't explicitly set the value
    if (!(key === 'guidance_scale' && options.scale) &&
        !(key === 'strength' && options.strength)) {
      mergedInput[key] = value;
    }
  }

  // Apply dimension constraints if model has max dimensions
  if (override.maxWidth || override.maxHeight) {
    const maxWidth = override.maxWidth || Infinity;
    const maxHeight = override.maxHeight || Infinity;

    if (mergedInput.image_size) {
      mergedInput.image_size = constrainImageSize(
        mergedInput.image_size,
        maxWidth,
        maxHeight
      );
    }
  }

  return mergedInput;
}

/**
 * Check if a model supports LoRAs
 * @param {string} modelEndpoint - The full model endpoint ID
 * @returns {boolean}
 */
export function supportsLoras(modelEndpoint) {
  const override = modelOverrides[modelEndpoint];

  // Default to true unless explicitly set to false
  if (!override) {
    // Standard flux models support LoRAs
    return modelEndpoint.includes('flux') &&
           !modelEndpoint.includes('krea/image-to-image') &&
           !modelEndpoint.includes('flux/krea');
  }

  return override.supportsLoras !== false;
}
