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
    const response = await fetch("https://api.venice.ai/api/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.VENICE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} - ${errorText}`);
      return;
    }

    const result = await response.json();

    // Filter image models
    const imageModels = result.data.filter(model => model.type === "image");

    // Prepare models data
    const modelsData = {
      modelEndpoints: {},
      defaultModel: imageModels.length > 0 
        ? imageModels[0].id 
        : "stable-diffusion-xl-v1-0"
    };

    imageModels.forEach(model => {
      modelsData.modelEndpoints[model.id] = model.id;
    });

    // Write to models.json
    const modelsPath = path.join(__dirname, 'models.json');
    await writeFile(modelsPath, JSON.stringify(modelsData, null, 2), 'utf8');

    // Print out the models
    console.log("Available Venice AI Image Models:");
    imageModels.forEach(model => {
      console.log(`- ${model.id}`);
      console.log(`  Created: ${new Date(model.created * 1000).toISOString()}`);
      console.log(`  Owned by: ${model.owned_by}`);
      
      if (model.model_spec && model.model_spec.traits) {
        console.log(`  Traits: ${model.model_spec.traits.join(", ")}`);
      }
      console.log(); // Empty line for readability
    });

    console.log(`\nModels have been updated in ${modelsPath}`);

  } catch (error) {
    console.error("Error fetching and updating models:", error);
    process.exit(1);
  }
};

fetchModels();
