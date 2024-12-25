import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let modelData = {
  modelEndpoints: {
    "flux-dev": "flux-dev",
    "flux-dev-uncensored": "flux-dev-uncensored",
    "pony-realism": "pony-realism"
  },
  defaultModel: "flux-dev"
};

try {
  const modelsPath = path.join(__dirname, 'models.json');
  const fileContent = await readFile(modelsPath, 'utf8');
  const loadedModelData = JSON.parse(fileContent);
  
  // Merge or replace default data
  modelData = {
    modelEndpoints: {
      ...modelData.modelEndpoints,
      ...loadedModelData.modelEndpoints
    },
    defaultModel: loadedModelData.defaultModel || modelData.defaultModel
  };
} catch (error) {
  console.warn("Could not read models.json, using default models:", error.message);
}

export const modelEndpoints = modelData.modelEndpoints;

export function getModelEndpoint(modelKey) {
  return modelEndpoints[modelKey] || modelData.defaultModel;
} 