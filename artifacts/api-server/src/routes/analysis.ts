import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, booksTable } from "@workspace/db";
import { cerebras } from "../lib/cerebras";
import { generateAnalysis } from "../lib/bookAI";

const router: IRouter = Router();

router.post("/books/:id/generate-analysis", async (req, res): Promise<void> => {
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

  let analysis;
  try {
    analysis = await generateAnalysis(book, cerebras);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    if (status === 429) {
      res.status(429).json({ error: "Cerebras rate limit exceeded. Please wait a moment and try again." });
    } else if (status === 401) {
      res.status(401).json({ error: "Invalid Cerebras API key. Please update your CEREBRAS_API_KEY secret." });
    } else {
      const message = (err as { message?: string }).message ?? "Unknown error";
      res.status(500).json({ error: `Analysis generation failed: ${message}` });
    }
    return;
  }

  const [updatedBook] = await db
    .update(booksTable)
    .set({ analysisData: JSON.stringify(analysis), status: "analysis" })
    .where(eq(booksTable.id, id))
    .returning();

  res.json(updatedBook);
});

export default router;
