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

  const nicheLabel = [book.niche, book.subNiche, book.deepNiche].filter(Boolean).join(" › ");

  const prompt = `You are a KDP (Kindle Direct Publishing) book title expert. Generate titles that are laser-focused on the exact book details provided — do NOT use generic filler words or approximate numbers.

Book details:
- Full niche: ${nicheLabel}
- Audience: ${book.audience}
- Tone: ${book.tone}
- Exact number of entries/items in the book: ${book.numEntries}${competitorContext}

Rules you MUST follow:
1. If using a number-led title, the number MUST be exactly ${book.numEntries} — not rounded, not approximated.
2. Every title must directly reflect the specific niche "${nicheLabel}" — avoid generic words like "Amazing", "Fast", "Quick", "Ultimate" unless the tone is "casual" or "funny".
3. The subtitle must add real specificity: who the book is for, what they gain, or how it is structured.
4. Match the tone strictly: ${book.tone} — e.g. if educational, be informative and clear; if funny, be playful; if inspirational, be motivating.
5. Titles must feel like real Amazon bestsellers in the "${book.subNiche}" space.

Generate exactly 3 title suggestions.

Return ONLY valid JSON, no markdown, no explanation:
[
  {
    "title": "Main Title Here",
    "subtitle": "Specific subtitle that adds value and keywords",
    "fullTitle": "Main Title Here: Specific subtitle that adds value and keywords",
    "rationale": "One sentence explaining why this title fits this exact book"
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
