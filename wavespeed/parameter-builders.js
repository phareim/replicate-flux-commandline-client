import { DEFAULT_SIZE } from "./config.js";

/**
 * Build parameters for Wavespeed API request
 * @param {string} category - The model category (e.g., 'text-to-image')
 * @param {Object} options - User-provided options from CLI
 * @returns {Object} - Input parameters for the Wavespeed API
 */
export function buildParameters(category, options) {
  const params = {
    prompt: options.prompt,
    size: options.size || DEFAULT_SIZE,
  };

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
  };

  return requirements[category] || ['prompt'];
}
