import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, booksTable, entriesTable } from "@workspace/db";
import {
  ListEntriesParams,
  GenerateEntryParams,
  UpdateEntryParams,
  UpdateEntryBody,
} from "@workspace/api-zod";
import { groq, GROQ_MODEL } from "../lib/groq";
import { cerebras } from "../lib/cerebras";
import { buildContentPrompt, buildContentSystemPrompt, countWords, regenerateSingleTitle } from "../lib/bookAI";
import type { AnalysisData, ResourceData, CompetitorData } from "../lib/bookAI";

const router: IRouter = Router();

// List entries for a book
router.get("/books/:bookId/entries", async (req, res): Promise<void> => {
  const params = ListEntriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const entries = await db
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.bookId, params.data.bookId))
    .orderBy(entriesTable.position);
  res.json(entries);
});

// Regenerate title for a single entry
router.post("/books/:bookId/entries/:entryId/regenerate-title", async (req, res): Promise<void> => {
  const params = GenerateEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db
    .select()
    .from(entriesTable)
    .where(and(eq(entriesTable.id, params.data.entryId), eq(entriesTable.bookId, params.data.bookId)));

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, params.data.bookId));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const allEntries = await db.select().from(entriesTable).where(eq(entriesTable.bookId, book.id));
  const existingTitles = allEntries
    .sort((a, b) => a.position - b.position)
    .map((e) => e.title);

  let newTitle: string;
  try {
    newTitle = await regenerateSingleTitle(book, entry.position, existingTitles, groq);
  } catch (err: unknown) {
    const message = (err as { message?: string }).message ?? "Unknown error";
    res.status(500).json({ error: `Title regeneration failed: ${message}` });
    return;
  }

  const [updated] = await db
    .update(entriesTable)
    .set({ title: newTitle, status: "pending", content: null, wordCount: null, contentJson: null })
    .where(eq(entriesTable.id, entry.id))
    .returning();

  res.json(updated);
});

// Generate content for a single entry
router.post("/books/:bookId/entries/:entryId/generate", async (req, res): Promise<void> => {
  const params = GenerateEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db
    .select()
    .from(entriesTable)
    .where(and(eq(entriesTable.id, params.data.entryId), eq(entriesTable.bookId, params.data.bookId)));

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  if (entry.isLocked) {
    res.status(400).json({ error: "Entry is locked" });
    return;
  }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, params.data.bookId));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  // Mark as generating
  await db
    .update(entriesTable)
    .set({ status: "generating" })
    .where(eq(entriesTable.id, entry.id));

  // Load analysis, resource, and competitor data if available
  let analysis: AnalysisData | null = null;
  let resources: ResourceData | null = null;
  let competitors: CompetitorData | null = null;
  try {
    if (book.analysisData) analysis = JSON.parse(book.analysisData) as AnalysisData;
    if (book.resourceData) resources = JSON.parse(book.resourceData) as ResourceData;
    if (book.competitorData) competitors = JSON.parse(book.competitorData) as CompetitorData;
  } catch {
    // proceed without enrichment
  }

  // Generate content with retry for word count
  let content = "";
  let wordCount = 0;
  let attempts = 0;
  const maxAttempts = 3;

  try {
    while (attempts < maxAttempts) {
      attempts++;
      const prompt = buildContentPrompt(book, entry.title, analysis, resources, competitors);
      const systemPrompt = buildContentSystemPrompt(book.minWords, book.maxWords);
      const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      });
      content = response.choices[0]?.message?.content ?? "";
      wordCount = countWords(content);
      if (wordCount >= book.minWords && wordCount <= book.maxWords) break;
    }
  } catch (err: unknown) {
    // Mark entry as failed
    await db.update(entriesTable).set({ status: "failed" }).where(eq(entriesTable.id, entry.id));
    const status = (err as { status?: number }).status ?? 500;
    if (status === 429) {
      res.status(429).json({ error: "Groq rate limit exceeded. Please wait a moment and try again." });
    } else if (status === 401) {
      res.status(401).json({ error: "Invalid Groq API key. Please update your GROQ_API_KEY secret." });
    } else {
      const message = (err as { message?: string }).message ?? "Unknown error";
      res.status(500).json({ error: `Entry generation failed: ${message}` });
    }
    return;
  }

  const [updated] = await db
    .update(entriesTable)
    .set({ content, wordCount, status: "done", contentJson: null })
    .where(eq(entriesTable.id, entry.id))
    .returning();

  // Update book status to writing if it was blueprint
  if (book.status === "blueprint") {
    await db.update(booksTable).set({ status: "writing" }).where(eq(booksTable.id, book.id));
  }

  res.json(updated);
});

// Update an entry (lock/unlock, edit content)
router.patch("/books/:bookId/entries/:entryId", async (req, res): Promise<void> => {
  const params = UpdateEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(entriesTable)
    .where(and(eq(entriesTable.id, params.data.entryId), eq(entriesTable.bookId, params.data.bookId)));

  if (!existing) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const updateData: Partial<typeof existing> = { ...parsed.data };
  if (parsed.data.content != null) {
    updateData.wordCount = countWords(parsed.data.content);
  }

  const [updated] = await db
    .update(entriesTable)
    .set(updateData)
    .where(eq(entriesTable.id, existing.id))
    .returning();

  res.json(updated);
});

export default router;
