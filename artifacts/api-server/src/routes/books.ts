import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, booksTable, entriesTable } from "@workspace/db";
import {
  CreateBookBody,
  GetBookParams,
  UpdateBookParams,
  UpdateBookBody,
  DeleteBookParams,
  GenerateBlueprintParams,
  GetBookStatsParams,
  ExportBookParams,
  ExportBookBody,
} from "@workspace/api-zod";
import { cerebras } from "../lib/cerebras";
import { generateBlueprint } from "../lib/bookAI";
import type { AnalysisData, ResourceData } from "../lib/bookAI";

const router: IRouter = Router();

// List all books
router.get("/books", async (_req, res): Promise<void> => {
  const books = await db.select().from(booksTable).orderBy(desc(booksTable.createdAt));
  res.json(books);
});

// Create a book
router.post("/books", async (req, res): Promise<void> => {
  const parsed = CreateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [book] = await db.insert(booksTable).values(parsed.data).returning();
  res.status(201).json(book);
});

// Get a book
router.get("/books/:id", async (req, res): Promise<void> => {
  const params = GetBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, params.data.id));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  res.json(book);
});

// Update a book
router.patch("/books/:id", async (req, res): Promise<void> => {
  const params = UpdateBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [book] = await db.update(booksTable).set(parsed.data).where(eq(booksTable.id, params.data.id)).returning();
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  res.json(book);
});

// Delete a book
router.delete("/books/:id", async (req, res): Promise<void> => {
  const params = DeleteBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [book] = await db.delete(booksTable).where(eq(booksTable.id, params.data.id)).returning();
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  res.sendStatus(204);
});

// Generate blueprint
router.post("/books/:id/generate-blueprint", async (req, res): Promise<void> => {
  const params = GenerateBlueprintParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, params.data.id));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  // Delete any existing entries
  await db.delete(entriesTable).where(eq(entriesTable.bookId, book.id));

  // Load analysis and resource data if available
  let analysis: AnalysisData | null = null;
  let resources: ResourceData | null = null;
  try {
    if (book.analysisData) analysis = JSON.parse(book.analysisData) as AnalysisData;
    if (book.resourceData) resources = JSON.parse(book.resourceData) as ResourceData;
  } catch {
    // proceed without enrichment if data is malformed
  }

  // Generate titles via AI
  let titles: string[];
  try {
    titles = await generateBlueprint(book, cerebras, analysis, resources);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    if (status === 429) {
      res.status(429).json({ error: "Cerebras rate limit exceeded. Please wait a moment and try again." });
    } else if (status === 401) {
      res.status(401).json({ error: "Invalid Cerebras API key. Please update your CEREBRAS_API_KEY secret." });
    } else {
      const message = (err as { message?: string }).message ?? "Unknown error";
      res.status(500).json({ error: `Blueprint generation failed: ${message}` });
    }
    return;
  }

  // Insert entries
  const entryRows = titles.map((title, index) => ({
    bookId: book.id,
    position: index + 1,
    title,
    status: "pending" as const,
    isLocked: false,
  }));

  if (entryRows.length > 0) {
    await db.insert(entriesTable).values(entryRows);
  }

  // Update book status
  const [updatedBook] = await db
    .update(booksTable)
    .set({ status: "blueprint" })
    .where(eq(booksTable.id, book.id))
    .returning();

  res.json(updatedBook);
});

// Get book stats
router.get("/books/:id/stats", async (req, res): Promise<void> => {
  const params = GetBookStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, params.data.id));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  const entries = await db.select().from(entriesTable).where(eq(entriesTable.bookId, book.id));

  const totalEntries = entries.length;
  const completedEntries = entries.filter((e) => e.status === "done").length;
  const lockedEntries = entries.filter((e) => e.isLocked).length;
  const remainingEntries = totalEntries - completedEntries;
  const completionPercentage = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 1000) / 10 : 0;
  const totalWordCount = entries.reduce((sum, e) => sum + (e.wordCount ?? 0), 0);
  const averageWordsPerEntry = completedEntries > 0 ? Math.round(totalWordCount / completedEntries) : 0;

  res.json({
    totalEntries,
    completedEntries,
    remainingEntries,
    completionPercentage,
    totalWordCount,
    averageWordsPerEntry,
    lockedEntries,
  });
});

// Export book
router.post("/books/:id/export", async (req, res): Promise<void> => {
  const params = ExportBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ExportBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, params.data.id));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const entries = await db
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.bookId, book.id))
    .orderBy(entriesTable.position);

  const { format, includeConclusion, authorName } = parsed.data;
  const bookTitle = book.title ?? `${book.deepNiche} ${book.niche} Book`;
  const author = authorName ?? book.authorName ?? "Anonymous";

  let content = "";
  let wordCount = 0;

  if (format === "markdown") {
    content += `# ${bookTitle}\n\n`;
    content += `**Author:** ${author}\n\n`;
    content += `---\n\n`;
    content += `## Introduction\n\nWelcome to this collection of ${book.numEntries} unique ${book.deepNiche} entries.\n\n`;
    content += `---\n\n`;
    content += `## Table of Contents\n\n`;
    entries.forEach((e, i) => {
      content += `${i + 1}. ${e.title}\n`;
    });
    content += `\n---\n\n`;
    entries.forEach((e, i) => {
      content += `## ${i + 1}. ${e.title}\n\n`;
      content += `${e.content ?? "_Content not generated_"}\n\n`;
      content += `---\n\n`;
      wordCount += e.wordCount ?? 0;
    });
    if (includeConclusion) {
      content += `## Conclusion\n\nThank you for reading this collection.\n\n`;
    }
    content += `## About the Author\n\n${author}\n`;
  } else {
    content += `${bookTitle.toUpperCase()}\n`;
    content += `By ${author}\n\n`;
    content += `${"=".repeat(60)}\n\n`;
    content += `INTRODUCTION\n\n`;
    content += `Welcome to this collection of ${book.numEntries} unique ${book.deepNiche} entries.\n\n`;
    content += `${"=".repeat(60)}\n\n`;
    content += `TABLE OF CONTENTS\n\n`;
    entries.forEach((e, i) => {
      content += `${i + 1}. ${e.title}\n`;
    });
    content += `\n${"=".repeat(60)}\n\n`;
    entries.forEach((e, i) => {
      content += `${i + 1}. ${e.title.toUpperCase()}\n\n`;
      content += `${e.content ?? "Content not generated"}\n\n`;
      content += `${"-".repeat(40)}\n\n`;
      wordCount += e.wordCount ?? 0;
    });
    if (includeConclusion) {
      content += `CONCLUSION\n\nThank you for reading this collection.\n\n`;
    }
    content += `ABOUT THE AUTHOR\n\n${author}\n`;
  }

  const ext = format === "markdown" ? "md" : "txt";
  const filename = `${bookTitle.toLowerCase().replace(/\s+/g, "-")}.${ext}`;

  res.json({ format, content, filename, wordCount });
});

export default router;
