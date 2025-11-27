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

  // Check if this is the new API format (has 'data' array)
  if (loadedModelData.data && Array.isArray(loadedModelData.data)) {
    // Transform new API format to old internal format
    const imageModels = loadedModelData.data.filter(model => model.type === "image");

    // Find default model - prefer wai-Illustrious (anime model)
    const waiModel = imageModels.find(m => m.id === "wai-Illustrious");
    const defaultModelId = waiModel?.id || (imageModels.length > 0 ? imageModels[0].id : "wai-Illustrious");

    const transformedData = {
      modelEndpoints: {},
      modelConstraints: {},
      modelInfo: {},
      stylePresets: [],
      defaultModel: defaultModelId
    };

    imageModels.forEach(model => {
      transformedData.modelEndpoints[model.id] = model.id;

      // Store model constraints if available
      if (model.model_spec && model.model_spec.constraints) {
        transformedData.modelConstraints[model.id] = {
          widthHeightDivisor: model.model_spec.constraints.widthHeightDivisor || 16,
          maxSteps: model.model_spec.constraints.steps?.max || 50,
          defaultSteps: model.model_spec.constraints.steps?.default || 20,
          promptCharacterLimit: model.model_spec.constraints.promptCharacterLimit || 1500
        };
      }

      // Store model info (name, traits, source)
      if (model.model_spec) {
        transformedData.modelInfo[model.id] = {
          name: model.model_spec.name || model.id,
          traits: model.model_spec.traits || [],
          modelSource: model.model_spec.modelSource || ""
        };
      }
    });

    modelData = transformedData;
  } else {
    // Old format - merge or replace default data
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
  }
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