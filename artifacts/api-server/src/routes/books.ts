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
import type { AnalysisData, ResourceData, CompetitorData } from "../lib/bookAI";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  UnderlineType,
} from "docx";
import PDFDocument from "pdfkit";

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

  // Load analysis, resource, and competitor data if available
  let analysis: AnalysisData | null = null;
  let resources: ResourceData | null = null;
  let competitors: CompetitorData | null = null;
  try {
    if (book.analysisData) analysis = JSON.parse(book.analysisData) as AnalysisData;
    if (book.resourceData) resources = JSON.parse(book.resourceData) as ResourceData;
    if (book.competitorData) competitors = JSON.parse(book.competitorData) as CompetitorData;
  } catch {
    // proceed without enrichment if data is malformed
  }

  // Generate titles via AI
  let titles: string[];
  try {
    titles = await generateBlueprint(book, cerebras, analysis, resources, competitors);
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

// Helper: generate DOCX as base64
async function buildDocxBase64(
  bookTitle: string,
  author: string,
  deepNiche: string,
  numEntries: number,
  entries: { title: string; content?: string | null; wordCount?: number | null }[],
  includeConclusion: boolean
): Promise<{ base64: string; wordCount: number }> {
  let wordCount = 0;
  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({
      children: [new TextRun({ text: bookTitle, bold: true, size: 56, color: "1a1a2e" })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `By ${author}`, italics: true, size: 28, color: "555555" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `A collection of ${numEntries} ${deepNiche} entries`, size: 22, color: "888888" })],
      alignment: AlignmentType.CENTER,
    })
  );

  // Page break before TOC
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Table of Contents heading
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "Table of Contents", bold: true, size: 36 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );
  entries.forEach((e, i) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${i + 1}.  ${e.title}`, size: 22 })],
        spacing: { after: 100 },
      })
    );
  });

  // Entries
  entries.forEach((e, i) => {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${i + 1}. ${e.title}`, bold: true, size: 36 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 240 },
      })
    );
    const body = e.content ?? "Content not generated.";
    body.split(/\n+/).forEach((para) => {
      if (para.trim()) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: para.trim(), size: 24 })],
            spacing: { after: 160 },
          })
        );
      }
    });
    wordCount += e.wordCount ?? 0;
  });

  if (includeConclusion) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Conclusion", bold: true, size: 36 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 240 },
      })
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Thank you for reading this collection. We hope it has been informative, inspiring, and valuable to you.", size: 24 })],
      })
    );
  }

  // About the author
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "About the Author", bold: true, size: 36 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
    })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: author, size: 24 })],
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 24 },
        },
      },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return { base64: buffer.toString("base64"), wordCount };
}

// Helper: generate PDF as base64
function buildPdfBase64(
  bookTitle: string,
  author: string,
  deepNiche: string,
  numEntries: number,
  entries: { title: string; content?: string | null; wordCount?: number | null }[],
  includeConclusion: boolean
): Promise<{ base64: string; wordCount: number }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    let wordCount = 0;

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve({ base64: buffer.toString("base64"), wordCount });
    });

    // Title page
    doc.moveDown(4);
    doc.fontSize(28).font("Helvetica-Bold").fillColor("#1a1a2e").text(bookTitle, { align: "center" });
    doc.moveDown(1);
    doc.fontSize(14).font("Helvetica-Oblique").fillColor("#555555").text(`By ${author}`, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").fillColor("#888888").text(`A collection of ${numEntries} ${deepNiche} entries`, { align: "center" });

    // Table of contents
    doc.addPage();
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#1a1a2e").text("Table of Contents");
    doc.moveDown(0.8);
    entries.forEach((e, i) => {
      doc.fontSize(11).font("Helvetica").fillColor("#222222").text(`${i + 1}.  ${e.title}`, { lineGap: 4 });
    });

    // Entries
    entries.forEach((e, i) => {
      doc.addPage();
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a1a2e").text(`${i + 1}. ${e.title}`);
      doc.moveDown(0.6);
      const body = e.content ?? "Content not generated.";
      doc.fontSize(11).font("Helvetica").fillColor("#222222").text(body, { align: "justify", lineGap: 3 });
      wordCount += e.wordCount ?? 0;
    });

    if (includeConclusion) {
      doc.addPage();
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a1a2e").text("Conclusion");
      doc.moveDown(0.6);
      doc.fontSize(11).font("Helvetica").fillColor("#222222").text(
        "Thank you for reading this collection. We hope it has been informative, inspiring, and valuable to you.",
        { align: "justify", lineGap: 3 }
      );
    }

    doc.addPage();
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a1a2e").text("About the Author");
    doc.moveDown(0.6);
    doc.fontSize(11).font("Helvetica").fillColor("#222222").text(author);

    doc.end();
  });
}

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

  const { format, includeConclusion = true, authorName } = parsed.data;
  const bookTitle = book.title ?? `${book.deepNiche} ${book.niche} Book`;
  const author = authorName ?? book.authorName ?? "Anonymous";
  const safeSlug = bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  try {
    if (format === "docx") {
      const { base64, wordCount } = await buildDocxBase64(
        bookTitle, author, book.deepNiche, book.numEntries, entries, includeConclusion
      );
      res.json({
        format,
        content: base64,
        filename: `${safeSlug}.docx`,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        wordCount,
      });
    } else {
      const { base64, wordCount } = await buildPdfBase64(
        bookTitle, author, book.deepNiche, book.numEntries, entries, includeConclusion
      );
      res.json({
        format,
        content: base64,
        filename: `${safeSlug}.pdf`,
        mimeType: "application/pdf",
        wordCount,
      });
    }
  } catch (err: unknown) {
    const message = (err as { message?: string }).message ?? "Unknown error";
    res.status(500).json({ error: `Export failed: ${message}` });
  }
});

export default router;
