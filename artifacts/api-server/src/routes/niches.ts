import { Router, type IRouter } from "express";
import { cerebras } from "../lib/cerebras";
import { CEREBRAS_MODEL } from "../lib/cerebras";

const router: IRouter = Router();

router.post("/niches/suggest-deep", async (req, res): Promise<void> => {
  const { niche, subNiche } = req.body ?? {};

  if (!niche || !subNiche) {
    res.status(400).json({ error: "niche and subNiche are required" });
    return;
  }

  const prompt = `You are a KDP (Kindle Direct Publishing) non-fiction book niche expert.

Given:
- Niche: "${niche}"
- Sub-Niche: "${subNiche}"

Generate exactly 5 specific deep niche angles for a profitable non-fiction book. Each deep niche should:
- Be more specific than the sub-niche
- Target a clear audience segment or situation
- Be a realistic, commercially viable book topic on Amazon KDP
- Be concise (3-8 words)

Return ONLY a valid JSON array of 5 strings. No explanation, no markdown, no extra text.

Example format: ["Intermittent Fasting for Women Over 50","7-Day Beginner Keto Meal Plan","Anti-Inflammatory Diet for Arthritis","Low-Carb Recipes for Busy Moms","Mediterranean Diet for Heart Health"]`;

  try {
    const response = await cerebras.chat.completions.create({
      model: CEREBRAS_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 300,
    });

    const raw = (response.choices[0]?.message?.content ?? "").trim();

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      res.status(500).json({ error: "AI returned unexpected format" });
      return;
    }

    const suggestions: string[] = JSON.parse(match[0]);

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      res.status(500).json({ error: "AI returned empty suggestions" });
      return;
    }

    res.json({ suggestions: suggestions.slice(0, 5) });
  } catch (err) {
    const message = (err as { message?: string }).message ?? "Unknown error";
    res.status(500).json({ error: `AI suggestion failed: ${message}` });
  }
});

export default router;
