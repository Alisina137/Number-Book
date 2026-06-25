import type { Book } from "@workspace/db";

const OPEN_LIBRARY_BASE = "https://openlibrary.org/search.json";
const COVER_BASE = "https://covers.openlibrary.org/b/id";

export interface AmazonBookSuggestion {
  title: string;
  author: string;
  reason: string;
  rating?: number;
  reviewCount?: number;
  asin?: string;
  amazonUrl?: string;
  image?: string;
}

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  ratings_average?: number;
  ratings_count?: number;
  isbn?: string[];
}

interface OpenLibraryResponse {
  docs?: OpenLibraryDoc[];
  numFound?: number;
}

function buildAmazonSearchUrl(title: string, author?: string): string {
  const q = [title, author].filter(Boolean).join(" ");
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=stripbooks`;
}

const TARGET_RESULTS = 24;

async function searchOpenLibrary(query: string): Promise<OpenLibraryDoc[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "50",
    fields: "title,author_name,cover_i,first_publish_year,ratings_average,ratings_count,isbn",
  });

  const resp = await fetch(`${OPEN_LIBRARY_BASE}?${params}`);
  if (!resp.ok) throw new Error(`Open Library API error: ${resp.status}`);

  const data = (await resp.json()) as OpenLibraryResponse;
  return data.docs ?? [];
}

export async function searchAmazonBooksForCompetitors(
  book: Book,
  tags?: string[]
): Promise<AmazonBookSuggestion[]> {
  // Build query list — if tags supplied use them, otherwise generate multiple from book fields
  const queries = tags && tags.length > 0
    ? tags
    : [
        `${book.deepNiche || book.subNiche} ${book.niche}`,
        `${book.subNiche} ${book.niche} guide`,
        `best ${book.subNiche} book`,
        `${book.niche} beginners guide`,
      ];

  const seen = new Set<string>();
  const results: AmazonBookSuggestion[] = [];

  // Run queries in parallel (3 at a time) to fill the pool faster
  const batches: string[][] = [];
  for (let i = 0; i < queries.length; i += 3) batches.push(queries.slice(i, i + 3));

  for (const batch of batches) {
    if (results.length >= TARGET_RESULTS) break;

    const settled = await Promise.allSettled(
      batch.map((q) => searchOpenLibrary(q).then((docs) => ({ q, docs })))
    );

    for (const result of settled) {
      if (result.status === "rejected") {
        console.error("Open Library search error:", result.reason);
        continue;
      }
      const { q, docs } = result.value;

      for (const doc of docs) {
        if (results.length >= TARGET_RESULTS) break;
        if (!doc.title) continue;

        const key = doc.title.toLowerCase().slice(0, 40);
        if (seen.has(key)) continue;
        seen.add(key);

        const author = (doc.author_name ?? []).slice(0, 2).join(", ") || "Unknown Author";
        const coverImage = doc.cover_i
          ? `${COVER_BASE}/${doc.cover_i}-M.jpg`
          : undefined;

        const reasonParts: string[] = [];
        if (doc.ratings_average) reasonParts.push(`★ ${doc.ratings_average.toFixed(1)}`);
        if (doc.ratings_count) reasonParts.push(`${doc.ratings_count.toLocaleString()} ratings`);
        if (doc.first_publish_year) reasonParts.push(`${doc.first_publish_year}`);
        reasonParts.push(`"${q}"`);

        results.push({
          title: doc.title,
          author,
          reason: reasonParts.join(" · "),
          rating: doc.ratings_average ? parseFloat(doc.ratings_average.toFixed(1)) : undefined,
          reviewCount: doc.ratings_count,
          amazonUrl: buildAmazonSearchUrl(doc.title, doc.author_name?.[0]),
          image: coverImage,
        });
      }
    }
  }

  return results.slice(0, TARGET_RESULTS);
}
