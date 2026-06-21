import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  niche: text("niche").notNull(),
  subNiche: text("sub_niche").notNull(),
  deepNiche: text("deep_niche").notNull(),
  audience: text("audience").notNull(),
  tone: text("tone").notNull(),
  numEntries: integer("num_entries").notNull(),
  minWords: integer("min_words").notNull(),
  maxWords: integer("max_words").notNull(),
  status: text("status").notNull().default("setup"),
  title: text("title"),
  authorName: text("author_name"),
  analysisData: text("analysis_data"),
  resourceData: text("resource_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBookSchema = createInsertSchema(booksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof booksTable.$inferSelect;
