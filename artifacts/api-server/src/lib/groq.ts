import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY must be set.");
}

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Fast model for per-entry content generation
export const GROQ_MODEL = "llama-3.3-70b-versatile";
