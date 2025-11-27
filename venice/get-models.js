#!/usr/bin/env node

import fetch from "node-fetch";
import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fetchModels = async () => {
  // Validate API token
  if (!process.env.VENICE_API_TOKEN) {
    console.error("Error: VENICE_API_TOKEN environment variable is not set.");
    process.exit(1);
  }

  try {
    // Fetch models
    const modelsResponse = await fetch("https://api.venice.ai/api/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.VENICE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!modelsResponse.ok) {
      const errorText = await modelsResponse.text();
      console.error(`API Error: ${modelsResponse.status} - ${errorText}`);
      return;
    }

    const result = await modelsResponse.json();

    // Filter to only image models
    const imageModels = result.data.filter(model => model.type === "image");

    // Save the API response format directly (with filtered data)
    const modelsData = {
      data: imageModels,
      object: result.object || "list",
      type: result.type || "image"
    };

    // Write to models.json
    const modelsPath = path.join(__dirname, 'models.json');
    await writeFile(modelsPath, JSON.stringify(modelsData, null, 2), 'utf8');

    // Print out the models
    console.log("\nAvailable Venice AI Image Models:");
    console.log("=".repeat(60));

    // Find default model - prefer wai-Illustrious (anime model)
    const waiModel = imageModels.find(m => m.id === "wai-Illustrious");
    const defaultModelId = waiModel?.id || (imageModels.length > 0 ? imageModels[0].id : "wai-Illustrious");

    imageModels.forEach(model => {
      const name = model.model_spec?.name || model.id;
      const isDefault = model.id === defaultModelId;

      console.log(`\n${model.id} ${isDefault ? "(DEFAULT)" : ""}`);
      console.log(`  Name: ${name}`);

      if (model.model_spec?.constraints) {
        const c = model.model_spec.constraints;
        console.log(`  Constraints:`);
        console.log(`    - Steps: ${c.steps?.default || "?"} (default), ${c.steps?.max || "?"} (max)`);
        console.log(`    - Width/Height Divisor: ${c.widthHeightDivisor || 16}`);
        console.log(`    - Prompt Limit: ${c.promptCharacterLimit || 1500} chars`);
      }

      if (model.model_spec?.traits && model.model_spec.traits.length > 0) {
        console.log(`  Traits: ${model.model_spec.traits.join(", ")}`);
      }

      if (model.model_spec?.modelSource) {
        console.log(`  Source: ${model.model_spec.modelSource}`);
      }
    });

    console.log("\n" + "=".repeat(60));
    console.log(`\nModels saved to: ${modelsPath}`);
    console.log(`Total models: ${imageModels.length}`);

  } catch (error) {
    console.error("Error fetching and updating models:", error);
    process.exit(1);
  }
};

fetchModels();
