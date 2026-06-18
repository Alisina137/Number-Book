import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, booksTable, entriesTable } from "@workspace/db";
import { GetQualityReportParams } from "@workspace/api-zod";

const router: IRouter = Router();

function similarity(a: string, b: string): number {
  const sa = a.toLowerCase().split(/\s+/);
  const sb = b.toLowerCase().split(/\s+/);
  const setA = new Set(sa);
  const setB = new Set(sb);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

router.get("/books/:id/quality-report", async (req, res): Promise<void> => {
  const params = GetQualityReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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

  const doneEntries = entries.filter((e) => e.status === "done");
  const issues: Array<{
    entryId: number;
    entryTitle: string;
    issueType: string;
    severity: string;
    description: string;
  }> = [];
  const flaggedIds = new Set<number>();

  // Duplicate/near-duplicate content detection
  for (let i = 0; i < doneEntries.length; i++) {
    for (let j = i + 1; j < doneEntries.length; j++) {
      const a = doneEntries[i];
      const b = doneEntries[j];
      if (!a.content || !b.content) continue;

      const sim = similarity(a.content, b.content);
      if (sim > 0.85) {
        if (!flaggedIds.has(b.id)) {
          flaggedIds.add(b.id);
          issues.push({
            entryId: b.id,
            entryTitle: b.title,
            issueType: sim > 0.95 ? "duplicate" : "near_duplicate",
            severity: sim > 0.95 ? "error" : "warning",
            description: `Content is ${Math.round(sim * 100)}% similar to entry #${a.position}: "${a.title}"`,
          });
        }
      }
    }
  }

  // Title near-duplicate detection
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const sim = similarity(a.title, b.title);
      if (sim > 0.7 && !flaggedIds.has(b.id)) {
        issues.push({
          entryId: b.id,
          entryTitle: b.title,
          issueType: "near_duplicate",
          severity: "warning",
          description: `Title is very similar to entry #${a.position}: "${a.title}"`,
        });
      }
    }
  }

  // Word count validation
  for (const entry of doneEntries) {
    const wc = entry.wordCount ?? 0;
    if (wc < book.minWords || wc > book.maxWords) {
      issues.push({
        entryId: entry.id,
        entryTitle: entry.title,
        issueType: "word_count",
        severity: "error",
        description: `Word count is ${wc}, expected ${book.minWords}–${book.maxWords} words`,
      });
    }
  }

  // Audience validation — simple keyword check for children
  if (book.audience === "children") {
    const matureKeywords = ["violence", "death", "murder", "alcohol", "drugs", "sex", "war", "abuse"];
    for (const entry of doneEntries) {
      const text = (entry.content ?? "").toLowerCase();
      const found = matureKeywords.find((kw) => text.includes(kw));
      if (found) {
        issues.push({
          entryId: entry.id,
          entryTitle: entry.title,
          issueType: "audience",
          severity: "warning",
          description: `Contains potentially mature content ("${found}") for a children's book`,
        });
      }
    }
  }

  const failedIds = new Set(issues.map((i) => i.entryId));
  const failedEntries = failedIds.size;
  const passedEntries = doneEntries.length - failedEntries;

  res.json({
    bookId: book.id,
    totalEntries: entries.length,
    passedEntries,
    failedEntries,
    issues,
  });
});

export default router;
