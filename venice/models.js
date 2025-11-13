import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let modelData = {
  defaultModel: "wai-Illustrious",
  modelEndpoints: {},
  modelConstraints: {},
  modelInfo: {},
  stylePresets: []
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
    modelConstraints: {
      ...modelData.modelConstraints,
      ...loadedModelData.modelConstraints
    },
    modelInfo: {
      ...modelData.modelInfo,
      ...loadedModelData.modelInfo
    },
    stylePresets: loadedModelData.stylePresets || modelData.stylePresets,
    defaultModel: loadedModelData.defaultModel || modelData.defaultModel
  };
} catch (error) {
  console.warn("Could not read models.json, using default models:", error.message);
}

export const modelEndpoints = modelData.modelEndpoints;
export const defaultModel = modelData.defaultModel;
export const modelConstraints = modelData.modelConstraints;
export const modelInfo = modelData.modelInfo;
export const stylePresets = modelData.stylePresets;

export function getModelEndpoint(modelKey) {
  if (modelKey && !modelEndpoints[modelKey]) {
    console.warn(`\nWarning: Model '${modelKey}' not found. Using default model '${modelData.defaultModel}' instead.`);
    console.warn(`Available models: ${Object.keys(modelEndpoints).join(", ")}\n`);
  }
  return modelEndpoints[modelKey] || modelData.defaultModel;
}

export function getModelConstraints(modelKey) {
  const effectiveModel = modelEndpoints[modelKey] || modelData.defaultModel;
  return modelConstraints[effectiveModel] || {
    widthHeightDivisor: 16,
    maxSteps: 50,
    defaultSteps: 30,
    promptCharacterLimit: 1500
  };
} 