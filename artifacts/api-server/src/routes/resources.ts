import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, booksTable } from "@workspace/db";
import { cerebras } from "../lib/cerebras";
import { generateResources } from "../lib/bookAI";
import type { AnalysisData } from "../lib/bookAI";

const router: IRouter = Router();

router.post("/books/:id/generate-resources", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid book id" });
    return;
  }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  if (!book.analysisData) {
    res.status(400).json({ error: "Analysis must be completed before generating resources." });
    return;
  }

  let analysis: AnalysisData;
  try {
    analysis = JSON.parse(book.analysisData) as AnalysisData;
  } catch {
    res.status(500).json({ error: "Stored analysis data is corrupted. Please re-run analysis." });
    return;
  }

  const lockedSections: string[] = Array.isArray(req.body?.lockedSections) ? req.body.lockedSections : [];

  let existingResources = null;
  if (book.resourceData && lockedSections.length > 0) {
    try {
      existingResources = JSON.parse(book.resourceData);
    } catch {
      // ignore
    }
  }

  let resources;
  try {
    resources = await generateResources(book, analysis, cerebras, lockedSections);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    if (status === 429) {
      res.status(429).json({ error: "Cerebras rate limit exceeded. Please wait a moment and try again." });
    } else if (status === 401) {
      res.status(401).json({ error: "Invalid Cerebras API key. Please update your CEREBRAS_API_KEY secret." });
    } else {
      const message = (err as { message?: string }).message ?? "Unknown error";
      res.status(500).json({ error: `Resource generation failed: ${message}` });
    }
    return;
  }

  // Restore locked section content from existing resources
  if (existingResources && lockedSections.length > 0) {
    const sectionMap: Record<string, keyof typeof resources> = {
      keyConcepts: "keyConcepts",
      expertInsights: "expertInsights",
      frameworks: "frameworks",
      statisticsAreas: "statisticsAreas",
      storyOpportunities: "storyOpportunities",
      quoteThemes: "quoteThemes",
      contentPillars: "contentPillars",
    };
    for (const locked of lockedSections) {
      const key = sectionMap[locked];
      if (key && existingResources[key] !== undefined) {
        (resources as Record<string, unknown>)[key] = existingResources[key];
      }
    }
    resources.lockedSections = lockedSections;
  }

  const [updatedBook] = await db
    .update(booksTable)
    .set({ resourceData: JSON.stringify(resources), status: "resources" })
    .where(eq(booksTable.id, id))
    .returning();

  res.json(updatedBook);
});

export default router;
