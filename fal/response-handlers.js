import fetch from "node-fetch";
import { saveImage, fetchImages, getFileNameFromUrl } from "./utils.js";

const FAL_SMOKE_MODE = process.env.FAL_SMOKE_TEST === "1";

/**
 * Category-based response handlers
 * Each handler processes the API result and downloads the appropriate media
 */

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Download a file with progress tracking
 */
async function downloadWithProgress(url, fileName, local_output_override, mediaType = 'file') {
  if (FAL_SMOKE_MODE) {
    const buffer = Buffer.from(`mock fal ${mediaType}`);
    await saveImage(buffer, fileName, local_output_override);
    console.log(`Mock-downloaded ${fileName}`);
    return buffer.length;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${mediaType} from ${url} (${response.status} ${response.statusText})`);
  }

  const contentLength = response.headers.get('content-length');
  const totalSize = contentLength ? parseInt(contentLength, 10) : null;

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const actualSize = buffer.length;
  console.log(`Downloaded ${fileName} (${formatFileSize(actualSize)})`);

  await saveImage(buffer, fileName, local_output_override);
  return actualSize;
}

/**
 * Handle standard image responses (most common)
 */
async function handleImageResponse(result, modelEndpoint, local_output_override) {
  if (result && Array.isArray(result.images) && result.images.length > 0) {
    console.log(`Downloading ${result.images.length} image(s)...`);

    // Display remote URLs
    console.log('\n📎 Remote URL(s):');
    result.images.forEach((img, idx) => {
      const url = typeof img === 'string' ? img : img.url;
      console.log(`  [${idx + 1}] ${url}`);
    });
    console.log();

    const imageUrls = result.images;
    await fetchImages(imageUrls, local_output_override);
    return true;
  }
  return false;
}

/**
 * Handle video responses with result.video.url structure
 */
async function handleVideoResponse(result, modelEndpoint, local_output_override) {
  if (result && result.video && result.video.url) {
    const videoUrl = result.video.url;
    const fileName = getFileNameFromUrl(videoUrl);

    console.log('\n📎 Remote URL:');
    console.log(`  ${videoUrl}\n`);

    console.log(`Downloading video...`);
    await downloadWithProgress(videoUrl, fileName, local_output_override, 'video');

    // Show additional metadata if available
    if (result.video.duration) {
      console.log(`Duration: ${result.video.duration}s`);
    }
    if (result.video.width && result.video.height) {
      console.log(`Resolution: ${result.video.width}x${result.video.height}`);
    }

    return true;
  }
  return false;
}

/**
 * Handle video responses with result.data.video_url structure
 */
async function handleDataVideoResponse(result, modelEndpoint, local_output_override) {
  if (result && result.data && result.data.video_url) {
    const videoUrl = result.data.video_url;
    const fileName = getFileNameFromUrl(videoUrl);

    console.log('\n📎 Remote URL:');
    console.log(`  ${videoUrl}\n`);

    console.log(`Downloading video...`);
    await downloadWithProgress(videoUrl, fileName, local_output_override, 'video');

    if (result.requestId) {
      console.log(`Request ID: ${result.requestId}`);
    }

    // Show video metadata if available
    if (result.data.duration) {
      console.log(`Duration: ${result.data.duration}s`);
    }
    if (result.data.width && result.data.height) {
      console.log(`Resolution: ${result.data.width}x${result.data.height}`);
    }

    return true;
  }
  return false;
}

/**
 * Handle responses with result.data.image_url structure
 */
async function handleDataImageResponse(result, modelEndpoint, local_output_override) {
  if (result && result.data) {
    if (result.requestId) {
      console.log(`Request ID: ${result.requestId}`);
    }

    if (result.data.image_url) {
      const imageUrl = result.data.image_url;
      const fileName = getFileNameFromUrl(imageUrl);

      console.log('\n📎 Remote URL:');
      console.log(`  ${imageUrl}\n`);

      console.log(`Downloading image...`);
      await downloadWithProgress(imageUrl, fileName, local_output_override, 'image');

      // Show image metadata if available
      if (result.data.width && result.data.height) {
        console.log(`Resolution: ${result.data.width}x${result.data.height}`);
      }

      return true;
    }
  }
  return false;
}

/**
 * Handle audio responses
 */
async function handleAudioResponse(result, modelEndpoint, local_output_override) {
  // Try multiple common audio response structures
  const audioUrl = result?.audio?.url ||
                   result?.data?.audio_url ||
                   result?.url;

  if (audioUrl) {
    const fileName = getFileNameFromUrl(audioUrl);
    console.log(`Downloading audio...`);
    await downloadWithProgress(audioUrl, fileName, local_output_override, 'audio');

    // Show audio metadata if available
    if (result.audio?.duration || result.data?.duration) {
      const duration = result.audio?.duration || result.data?.duration;
      console.log(`Duration: ${duration}s`);
    }

    return true;
  }
  return false;
}

/**
 * Handle 3D model responses
 */
async function handle3DResponse(result, modelEndpoint, local_output_override) {
  // 3D models may have multiple file formats
  const modelUrl = result?.model?.url ||
                   result?.data?.model_url ||
                   result?.glb_url ||
                   result?.data?.glb_url;

  if (modelUrl) {
    const fileName = getFileNameFromUrl(modelUrl);
    console.log(`Downloading 3D model...`);
    await downloadWithProgress(modelUrl, fileName, local_output_override, '3D model');

    // Some 3D models also return preview images
    if (result.preview_image || result.data?.preview_image) {
      const previewUrl = result.preview_image || result.data.preview_image;
      const previewFileName = getFileNameFromUrl(previewUrl);
      console.log(`Downloading preview image...`);
      await downloadWithProgress(previewUrl, previewFileName, local_output_override, 'preview image');
    }

    return true;
  }
  return false;
}

/**
 * Category-based response handler strategies
 */
const responseStrategies = {
  'text-to-image': async (result, modelEndpoint, local_output_override) => {
    return await handleImageResponse(result, modelEndpoint, local_output_override);
  },

  'image-to-image': async (result, modelEndpoint, local_output_override) => {
    // Try data.image_url first (some models use this), then fall back to images array
    if (await handleDataImageResponse(result, modelEndpoint, local_output_override)) {
      return true;
    }
    return await handleImageResponse(result, modelEndpoint, local_output_override);
  },

  'image-to-video': async (result, modelEndpoint, local_output_override) => {
    // Try result.video.url first, then result.data.video_url
    if (await handleVideoResponse(result, modelEndpoint, local_output_override)) {
      return true;
    }
    return await handleDataVideoResponse(result, modelEndpoint, local_output_override);
  },

  'text-to-video': async (result, modelEndpoint, local_output_override) => {
    // Same as image-to-video
    if (await handleVideoResponse(result, modelEndpoint, local_output_override)) {
      return true;
    }
    return await handleDataVideoResponse(result, modelEndpoint, local_output_override);
  },

  'video-to-video': async (result, modelEndpoint, local_output_override) => {
    if (await handleVideoResponse(result, modelEndpoint, local_output_override)) {
      return true;
    }
    return await handleDataVideoResponse(result, modelEndpoint, local_output_override);
  },

  'image-to-3d': async (result, modelEndpoint, local_output_override) => {
    return await handle3DResponse(result, modelEndpoint, local_output_override);
  },

  'text-to-audio': async (result, modelEndpoint, local_output_override) => {
    return await handleAudioResponse(result, modelEndpoint, local_output_override);
  },

  'audio-to-audio': async (result, modelEndpoint, local_output_override) => {
    return await handleAudioResponse(result, modelEndpoint, local_output_override);
  },

  'text-to-speech': async (result, modelEndpoint, local_output_override) => {
    return await handleAudioResponse(result, modelEndpoint, local_output_override);
  },

  'vision': async (result, modelEndpoint, local_output_override) => {
    // Vision models typically return JSON/text responses
    if (result.text || result.response || result.data) {
      console.log('Vision Model Response:');
      console.log(JSON.stringify(result, null, 2));
      return true;
    }
    return false;
  },

  'text-to-json': async (result, modelEndpoint, local_output_override) => {
    // JSON output models
    console.log('Model Response:');
    console.log(JSON.stringify(result, null, 2));
    return true;
  },

  'training': async (result, modelEndpoint, local_output_override) => {
    // Training endpoints return model URLs or status
    console.log('Training Result:');
    console.log(JSON.stringify(result, null, 2));
    return true;
  },
};

/**
 * Main response handler - routes to appropriate strategy based on category
 * @param {Object} result - API response from Fal
 * @param {string} category - Model category (e.g., 'text-to-image')
 * @param {string} modelEndpoint - Full model endpoint ID
 * @param {boolean} local_output_override - Save to current directory
 * @returns {Promise<boolean>} - True if handled successfully
 */
export async function handleResponse(result, category, modelEndpoint, local_output_override = false) {
  const strategy = responseStrategies[category] || responseStrategies['text-to-image'];

  try {
    const handled = await strategy(result, modelEndpoint, local_output_override);

    if (!handled) {
      // Fallback: try all handlers in sequence
      console.warn(`Primary handler for category '${category}' failed, trying fallbacks...`);

      for (const [cat, handler] of Object.entries(responseStrategies)) {
        if (cat === category) continue; // Skip the one we already tried

        try {
          if (await handler(result, modelEndpoint, local_output_override)) {
            console.log(`Successfully handled with ${cat} handler`);
            return true;
          }
        } catch (err) {
          // Continue to next handler
        }
      }

      // If nothing worked, log the result for debugging
      console.error(`No handler could process the result for category '${category}'`);
      console.error('Result:', JSON.stringify(result, null, 2));
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error handling response for category '${category}':`, error.message);
    return false;
  }
}
