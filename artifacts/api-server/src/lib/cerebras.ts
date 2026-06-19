import Cerebras from "@cerebras/cerebras_cloud_sdk";

if (!process.env.CEREBRAS_API_KEY) {
  throw new Error("CEREBRAS_API_KEY must be set.");
}

export const cerebras = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
});

// Best available model for blueprint generation
export const CEREBRAS_MODEL = "gpt-oss-120b";
