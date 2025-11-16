import { fetchImages } from "./utils.js";

/**
 * Handle Wavespeed API response
 * @param {Object} result - API response from Wavespeed
 * @param {string} category - Model category (e.g., 'text-to-image')
 * @param {string} modelEndpoint - Full model endpoint ID
 * @param {boolean} local_output_override - Save to current directory
 * @returns {Promise<boolean>} - True if handled successfully
 */
export async function handleResponse(result, category, modelEndpoint, local_output_override = false) {
  try {
    // Check for error status
    if (result.status === 'failed') {
      console.error('Generation failed:', result.error || 'Unknown error');
      return false;
    }

    // Handle image responses
    if (result && Array.isArray(result.outputs) && result.outputs.length > 0) {
      console.log(`Downloading ${result.outputs.length} image(s)...`);

      // Display remote URLs
      console.log('\n📎 Remote URL(s):');
      result.outputs.forEach((url, idx) => {
        console.log(`  [${idx + 1}] ${url}`);
      });
      console.log();

      await fetchImages(result.outputs, local_output_override);
      return true;
    }

    // If outputs array is empty but status is completed, it might still be processing
    if (result.status === 'processing' || result.status === 'created') {
      console.warn('Generation is still processing. Please check back later.');
      if (result.id) {
        console.log(`Prediction ID: ${result.id}`);
      }
      return true;
    }

    console.error('No outputs found in response');
    return false;
  } catch (error) {
    console.error(`Error handling response:`, error.message);
    return false;
  }
}
