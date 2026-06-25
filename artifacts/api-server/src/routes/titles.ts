import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, booksTable } from "@workspace/db";
import { groq, GROQ_MODEL } from "../lib/groq";

const router: IRouter = Router();

interface CompetitorBook {
  title?: string;
  author?: string;
  ratings?: number;
  reviewCount?: number;
  analyzed?: boolean;
}

interface CompetitorData {
  competitors?: CompetitorBook[];
}

interface TitleSuggestion {
  title: string;
  subtitle: string;
  fullTitle: string;
  rationale: string;
}

router.post("/books/:id/suggest-titles", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid book id" }); return; }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
  if (!book) { res.status(404).json({ error: "Book not found" }); return; }

  let competitorData: CompetitorData = {};
  try {
    if (book.competitorData) competitorData = JSON.parse(book.competitorData as string);
  } catch { /* ignore */ }

  const competitors = competitorData.competitors ?? [];
  const topCompetitorTitles = competitors
    .filter((c) => c.title)
    .slice(0, 6)
    .map((c) => {
      const parts = [`"${c.title}"`];
      if (c.ratings) parts.push(`(★${c.ratings}`);
      if (c.reviewCount) parts.push(`${c.reviewCount.toLocaleString()} reviews)`);
      return parts.join(" ");
    });

  const competitorContext = topCompetitorTitles.length > 0
    ? `\nTop competitor titles in this space:\n${topCompetitorTitles.map((t) => `- ${t}`).join("\n")}`
    : "";

  const prompt = `You are a KDP (Kindle Direct Publishing) book title expert who understands Amazon market dynamics and what makes titles rank and sell.

Book details:
- Niche: ${book.niche}
- Sub-Niche: ${book.subNiche}
- Deep Niche: ${book.deepNiche || "not specified"}
- Audience: ${book.audience}
- Tone: ${book.tone}
- Number of Entries: ${book.numEntries}${competitorContext}

Generate exactly 3 compelling, commercially-proven KDP book title suggestions. Each title should:
- Use a proven KDP formula (e.g. number-led, promise-based, audience-specific, curiosity-driven)
- Stand out from competitors while fitting market expectations
- Have a clear main title (short, punchy) and a descriptive subtitle that adds specificity and keywords
- Appeal directly to the ${book.audience} audience with a ${book.tone} tone
- Be realistic and something a real author would publish on Amazon

Return ONLY valid JSON in this exact format, no markdown, no explanation:
[
  {
    "title": "Main Title Here",
    "subtitle": "Subtitle That Explains the Book Value and Adds Keywords",
    "fullTitle": "Main Title Here: Subtitle That Explains the Book Value and Adds Keywords",
    "rationale": "One sentence explaining why this title will sell"
  }
]`;

  try {
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.85,
      max_tokens: 600,
    });

    const raw = (response.choices[0]?.message?.content ?? "").trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      res.status(500).json({ error: "AI returned unexpected format" });
      return;
    }

    const suggestions: TitleSuggestion[] = JSON.parse(match[0]);
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      res.status(500).json({ error: "AI returned empty suggestions" });
      return;
    }

    res.json({ suggestions: suggestions.slice(0, 3) });
  } catch (err) {
    const message = (err as { message?: string }).message ?? "Unknown error";
    res.status(500).json({ error: `Title suggestion failed: ${message}` });
  }
});

export default router;
