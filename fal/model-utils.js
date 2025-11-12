/**
 * Model search and query utilities for Fal.ai
 */

import { allModels } from './model-resolver.js';

/**
 * Search models by keyword
 * @param {string} query - Search term
 * @returns {Array} - Array of matching model objects
 */
export function searchModels(query) {
    const lowerQuery = query.toLowerCase();
    return allModels.filter(model => {
        const displayName = model.metadata.display_name?.toLowerCase() || '';
        const description = model.metadata.description?.toLowerCase() || '';
        const endpointId = model.endpoint_id.toLowerCase();

        return displayName.includes(lowerQuery) ||
               description.includes(lowerQuery) ||
               endpointId.includes(lowerQuery);
    });
}

/**
 * Get models by category
 * @param {string} category - Category name
 * @returns {Array} - Array of model objects in that category
 */
export function getModelsByCategory(category) {
    return allModels.filter(model => model.metadata.category === category);
}
