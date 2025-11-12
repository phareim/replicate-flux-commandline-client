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
      num_inference_steps: 28,
      guidance_scale: 3.5,
      output_format: "jpeg",
    },
    supportsLoras: true,
  },

  'fal-ai/minimax/video-01/image-to-video': {
    params: {
      prompt_optimizer: true,
    },
  },
};

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
