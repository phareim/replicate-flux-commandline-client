import { DEFAULT_FORMAT } from "./config.js";

/**
 * Build parameters for Wavespeed API request
 * @param {string} category - The model category (e.g., 'text-to-image', 'image-to-image')
 * @param {Object} options - User-provided options from CLI
 * @returns {Object} - Input parameters for the Wavespeed API
 */
export function buildParameters(category, options) {
  const params = {
    prompt: options.prompt,
  };

  // Add size parameter for text-to-image models
  if (category === 'text-to-image') {
    params.size = options.size || DEFAULT_FORMAT;
  }

  // Add images parameter for image-to-image models
  if (category === 'image-to-image') {
    if (!options.images || !Array.isArray(options.images) || options.images.length === 0) {
      throw new Error('image-to-image models require at least one input image. Use --images <url1> <url2> ...');
    }
    params.images = options.images;

    // Size is optional for image-to-image models
    if (options.size) {
      params.size = options.size;
    }
  }

  // Optional parameters
  if (options.enableBase64) {
    params.enable_base64_output = true;
  }

  if (options.sync) {
    params.enable_sync_mode = true;
  }

  return params;
}

/**
 * Get required parameters for a category
 * @param {string} category - The model category
 * @returns {string[]} - Array of required parameter names
 */
export function getRequiredParams(category) {
  const requirements = {
    'text-to-image': ['prompt'],
    'image-to-image': ['prompt', 'images'],
  };

  return requirements[category] || ['prompt'];
}
