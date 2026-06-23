import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, booksTable } from "@workspace/db";
import { cerebras } from "../lib/cerebras";
import {
  analyzeCompetitorBook,
  synthesizeCompetitorIntelligence,
  type CompetitorData,
  type CompetitorBook,
} from "../lib/bookAI";
import { searchAmazonBooksForCompetitors } from "../lib/amazonSearch";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function getCompetitorData(book: { competitorData?: string | null }): CompetitorData {
  try {
    if (book.competitorData) return JSON.parse(book.competitorData) as CompetitorData;
  } catch {}
  return { competitors: [] };
}

function handleAIError(err: unknown, res: Parameters<Parameters<typeof router.post>[1]>[1], label: string): void {
  const status = (err as { status?: number }).status ?? 500;
  if (status === 429) {
    res.status(429).json({ error: "Cerebras rate limit exceeded. Please wait a moment and try again." });
  } else if (status === 401) {
    res.status(401).json({ error: "Invalid Cerebras API key. Please update your CEREBRAS_API_KEY secret." });
  } else {
    const message = (err as { message?: string }).message ?? "Unknown error";
    res.status(500).json({ error: `${label} failed: ${message}` });
  }
}

router.post("/books/:id/competitors/suggest", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid book id" }); return; }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
  if (!book) { res.status(404).json({ error: "Book not found" }); return; }

  const tags: string[] | undefined = Array.isArray(req.body?.tags) ? req.body.tags : undefined;

  try {
    const suggestions = await searchAmazonBooksForCompetitors(book, tags);
    res.json({ suggestions });
  } catch (err) {
    const message = (err as { message?: string }).message ?? "Unknown error";
    res.status(500).json({ error: `Amazon search failed: ${message}` });
  }
});

router.post("/books/:id/competitors/add", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid book id" }); return; }

  const { title, author, amazonUrl, isbn, asin, rating, reviewCount, addedVia } = req.body ?? {};
  if (!title) { res.status(400).json({ error: "title is required" }); return; }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
  if (!book) { res.status(404).json({ error: "Book not found" }); return; }

  const competitorData = getCompetitorData(book);

  const newCompetitor: CompetitorBook = {
    id: randomUUID(),
    title,
    author: author ?? undefined,
    amazonUrl: amazonUrl ?? undefined,
    isbn: isbn ?? undefined,
    asin: asin ?? undefined,
    ratings: rating ?? undefined,
    reviewCount: reviewCount ?? undefined,
    addedVia: addedVia ?? "manual",
    analyzed: false,
  };

  competitorData.competitors.push(newCompetitor);

  let analysisResult;
  try {
    analysisResult = await analyzeCompetitorBook(book, newCompetitor, cerebras);
    Object.assign(newCompetitor, analysisResult, { analyzed: true });
  } catch (err) {
    handleAIError(err, res, "Competitor analysis");
    return;
  }

  const [updatedBook] = await db
    .update(booksTable)
    .set({ competitorData: JSON.stringify(competitorData) })
    .where(eq(booksTable.id, id))
    .returning();

  res.json(updatedBook);
});

router.delete("/books/:id/competitors/:competitorId", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { competitorId } = req.params;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid book id" }); return; }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
  if (!book) { res.status(404).json({ error: "Book not found" }); return; }

  const competitorData = getCompetitorData(book);
  competitorData.competitors = competitorData.competitors.filter((c) => c.id !== competitorId);

  const [updatedBook] = await db
    .update(booksTable)
    .set({ competitorData: JSON.stringify(competitorData) })
    .where(eq(booksTable.id, id))
    .returning();

  res.json(updatedBook);
});

router.post("/books/:id/competitors/analyze", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid book id" }); return; }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
  if (!book) { res.status(404).json({ error: "Book not found" }); return; }

  const competitorData = getCompetitorData(book);
  const analyzedCompetitors = competitorData.competitors.filter((c) => c.analyzed);

  if (analyzedCompetitors.length === 0) {
    res.status(400).json({ error: "Add at least one competitor before synthesizing intelligence." });
    return;
  }

  let synthesis;
  try {
    synthesis = await synthesizeCompetitorIntelligence(book, analyzedCompetitors, cerebras);
  } catch (err) {
    handleAIError(err, res, "Competitor synthesis");
    return;
  }

  competitorData.winningPatterns = synthesis.winningPatterns;
  competitorData.marketGaps = synthesis.marketGaps;
  competitorData.bookAdvantageStrategy = synthesis.bookAdvantageStrategy;
  competitorData.synthesized = true;

  const [updatedBook] = await db
    .update(booksTable)
    .set({ competitorData: JSON.stringify(competitorData) })
    .where(eq(booksTable.id, id))
    .returning();

  res.json(updatedBook);
});

export default router;
