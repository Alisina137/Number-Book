import { Router, type IRouter } from "express";
import { groq, GROQ_MODEL } from "../lib/groq";

const router: IRouter = Router();

function extractSuggestions(raw: string): string[] {
  const trimmed = raw.trim();

  // 1. Try JSON array directly or wrapped in code block
  const arrayMatch = trimmed.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(String).filter(Boolean).slice(0, 5);
      }
    } catch { /* fall through */ }
  }

  // 2. Parse numbered list: "1. Foo", "2. Bar"
  const numberedLines = trimmed
    .split("\n")
    .map(l => l.replace(/^\s*\d+[\.\)]\s*/, "").trim())
    .filter(l => l.length > 3 && l.length < 100 && !l.startsWith("[") && !l.startsWith("{"));
  if (numberedLines.length >= 3) {
    return numberedLines.slice(0, 5);
  }

  // 3. Parse bullet list: "- Foo", "• Bar"
  const bulletLines = trimmed
    .split("\n")
    .map(l => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(l => l.length > 3 && l.length < 100);
  if (bulletLines.length >= 3) {
    return bulletLines.slice(0, 5);
  }

  return [];
}

router.post("/niches/suggest-deep", async (req, res): Promise<void> => {
  const { niche, subNiche } = req.body ?? {};

  if (!niche || !subNiche) {
    res.status(400).json({ error: "niche and subNiche are required" });
    return;
  }

  const prompt = `You are a KDP book niche expert. Given niche "${niche}" and sub-niche "${subNiche}", list exactly 5 specific deep niche angles for a profitable non-fiction book. Each should be 3-8 words, more specific than the sub-niche, targeting a clear audience or situation.

Respond with ONLY a numbered list, nothing else:
1. 
2. 
3. 
4. 
5. `;

  try {
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.85,
      max_tokens: 500,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const suggestions = extractSuggestions(raw);

    if (suggestions.length === 0) {
      console.error("Unparseable AI output:", JSON.stringify(raw.slice(0, 200)));
      res.status(500).json({ error: "AI returned unexpected format — try again" });
      return;
    }

    res.json({ suggestions });
  } catch (err) {
    const message = (err as { message?: string }).message ?? "Unknown error";
    res.status(500).json({ error: `AI suggestion failed: ${message}` });
  }
});

export default router;
