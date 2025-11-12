import {
  DEFAULT_FORMAT,
  DEFAULT_GUIDANCE_SCALE,
  DEFAULT_INFERENCE_STEPS,
  DEFAULT_SAFETY_TOLERANCE
} from "./config.js";

/**
 * Category-based parameter building strategies
 * Each category has a function that builds the appropriate input object
 */
const parameterStrategies = {
  'text-to-image': (options) => ({
    prompt: options.prompt,
    image_size: options.format,
    num_inference_steps: options.steps || DEFAULT_INFERENCE_STEPS,
    guidance_scale: options.scale || DEFAULT_GUIDANCE_SCALE,
    num_images: Math.min(Math.max(parseInt(options.numImages || 1, 10), 1), 4), // Clamp between 1-4
    safety_tolerance: DEFAULT_SAFETY_TOLERANCE,
    enable_safety_checker: false,
  }),

  'image-to-image': (options) => ({
    prompt: options.prompt,
    image_url: options.imageUrl,
    strength: options.strength || 0.8,
    num_inference_steps: options.steps || DEFAULT_INFERENCE_STEPS,
    guidance_scale: options.scale || DEFAULT_GUIDANCE_SCALE,
    num_images: 1,
    safety_tolerance: DEFAULT_SAFETY_TOLERANCE,
    enable_safety_checker: false,
  }),

  'image-to-video': (options) => ({
    prompt: options.prompt,
    image_url: options.imageUrl,
    duration: parseInt(options.duration || 5, 10),
  }),

  'text-to-video': (options) => ({
    prompt: options.prompt,
    duration: parseInt(options.duration || 5, 10),
  }),

  'video-to-video': (options) => ({
    prompt: options.prompt,
    video_url: options.videoUrl || options.imageUrl, // Allow --image-url as alias
  }),

  'image-to-3d': (options) => ({
    image_url: options.imageUrl,
  }),

  'text-to-audio': (options) => ({
    prompt: options.prompt,
  }),

  'audio-to-audio': (options) => ({
    audio_url: options.audioUrl || options.imageUrl, // Reuse --image-url flag
  }),

  'text-to-speech': (options) => ({
    text: options.prompt,
  }),

  'vision': (options) => ({
    image_url: options.imageUrl,
    prompt: options.prompt,
  }),

  'text-to-json': (options) => ({
    prompt: options.prompt,
  }),

  'training': (options) => ({
    // Training models need special handling
    prompt: options.prompt,
  }),
};

/**
 * Builds input parameters based on model category
 * @param {string} category - The model category (e.g., 'text-to-image')
 * @param {Object} options - User-provided options from CLI
 * @returns {Object} - Input parameters for the Fal API
 */
export function buildParameters(category, options) {
  const strategy = parameterStrategies[category] || parameterStrategies['text-to-image'];
  const baseParams = strategy(options);

  // Apply global overrides
  if (options.seed) {
    baseParams.seed = options.seed;
  }

  // Override guidance_scale if explicitly provided
  if (options.scale !== null && options.scale !== undefined) {
    baseParams.guidance_scale = parseFloat(options.scale);
  }

  // Override strength if explicitly provided
  if (options.strength !== null && options.strength !== undefined) {
    baseParams.strength = parseFloat(options.strength);
  }

  return baseParams;
}

/**
 * Get required parameters for a category
 * @param {string} category - The model category
 * @returns {string[]} - Array of required parameter names
 */
export function getRequiredParams(category) {
  const requirements = {
    'image-to-image': ['imageUrl'],
    'image-to-video': ['imageUrl'],
    'video-to-video': ['videoUrl'],
    'image-to-3d': ['imageUrl'],
    'audio-to-audio': ['audioUrl'],
  };

  return requirements[category] || [];
}
